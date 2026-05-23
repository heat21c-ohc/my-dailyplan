const STORAGE_KEY_PREFIX = "daily-plan-state-v1-";
const LEGACY_STORAGE_KEY = "daily-plan-state-v1";
const THEME_STORAGE_KEY = "daily-plan-theme"; /* 사용자 테마 설정 저장용 키 */
const CLOUD_CONFIG_KEY = "daily-plan-cloud-config"; /* 드라이브 동기화 파일 ID 캐싱용 키 */
const LOCAL_MODIFIED_KEY = "daily-plan-last-modified"; /* 마지막 수정 시각(ms) - 기기 간 충돌 판별용 */
const AUTO_SHEETS_BACKUP_KEY = "daily-plan-last-auto-sheets-backup";
const SYNC_FILE_NAME = "my_dailyplan_sync.json"; /* 사용자 드라이브에 저장되는 동기화 파일명 */
const GOOGLE_CLIENT_ID = "552800594246-klpv3sg3m7tp72r633kuhkeg945ell20.apps.googleusercontent.com"; /* 주군의 Google Client ID */
const ARCHIVE_SHEET_NAME = "Daily Plan Archive";
const ARCHIVE_SHEET_TAB = "Daily Plan";
const BACKUP_WORKER_BASE_URL = "https://daily-plan-backup-api.heat21c.workers.dev";
const NOTION_USER_ID_KEY = "daily-plan-notion-user-id";
const NOTION_USER_SECRET_KEY = "daily-plan-notion-user-secret";
const NOTION_PARENT_PAGE_ID_KEY = "daily-plan-notion-parent-page-id";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets"; /* Drive sync + Sheets archive */
const DEFAULT_TODO_ROWS = 6;
const DEFAULT_TIMELINE_ROWS = 6;
const CLOUD_PULL_INTERVAL_MS = 30000;
const ARCHIVE_SECTION_LABELS = {
  important: "Important",
  todos: "TO DO LIST",
  timeline: "TIME LINE",
  memo: "MEMO",
  thanks: "THANKS GOD",
  summary: "SUMMARY"
};

// 구글 API 연동 런타임 변수
let googleAccessToken = sessionStorage.getItem("google_access_token") || null;
let tokenClient = null;
let userEmail = null; /* 로그인 사용자 이메일 (캘린더 임베드 src용) */
let cloudSyncTimer = 0; /* 드라이브 자동 동기화 디바운스 타이머 */
let cloudPullTimer = 0; /* 로그인 상태에서 다른 기기 변경사항을 주기적으로 가져오는 타이머 */
let autoSheetsBackupTimer = 0;

// 드라이브 동기화 설정 (앱이 생성한 동기화 파일 ID 캐싱)
const cloudConfig = {
  syncFileId: "",
  archiveSheetId: ""
};

const state = {
  planDate: today(),
  todos: [],
  timeline: [],
  editors: {},
  importantDone: { important1: false, important2: false, important3: false } /* 중요 업무 완료 상태 저장용 필드 */
};

function getStorageKeyForDate(date) {
  return `${STORAGE_KEY_PREFIX}${date}`;
}

function migrateLegacyData() {
  const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyData) {
    try {
      const parsed = JSON.parse(legacyData);
      const legacyDate = parsed.planDate || today();
      const targetKey = getStorageKeyForDate(legacyDate);
      if (!localStorage.getItem(targetKey)) {
        localStorage.setItem(targetKey, legacyData);
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }
}

const lists = {
  todos: {
    el: document.querySelector("#todoList"),
    template: document.querySelector("#todoTemplate"),
    dateType: "date"
  },
  timeline: {
    el: document.querySelector("#timelineList"),
    template: document.querySelector("#timelineTemplate"),
    dateType: "datetime"
  }
};

let activeEditor = null;
let saveTimer = 0;
let archiveSearchTimer = 0;

init();

function init() {
  initTheme();
  initCloudConfig();
  migrateLegacyData();
  if (googleAccessToken) {
    loadState();
  } else {
    clearLocalPlanStorage();
    resetStateForCurrentDate();
  }
  ensureRows("todos", DEFAULT_TODO_ROWS);
  ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
  document.querySelector("#planDate").value = state.planDate || today();
  renderList("todos");
  renderList("timeline");
  hydrateEditors();
  hydrateImportantCheckboxes();
  bindPageEvents();
  initGoogleGIS();
  scheduleDailySheetsBackup();
}

/* 테마 초기화 기능 (로컬 저장소 상태 복원) */
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const toggleBtn = document.querySelector("#themeToggle");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (toggleBtn) {
      toggleBtn.textContent = "☀️";
      toggleBtn.title = "라이트 모드로 전환";
    }
  } else {
    document.body.classList.remove("dark-mode");
    if (toggleBtn) {
      toggleBtn.textContent = "🌙";
      toggleBtn.title = "다크 모드로 전환";
    }
  }
}

function bindPageEvents() {
  const themeToggleBtn = document.querySelector("#themeToggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
      themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
      themeToggleBtn.title = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
    });
  }

  document.querySelector("#planDate").addEventListener("input", (event) => {
    saveState();
    state.planDate = event.target.value;
    loadState();
    ensureRows("todos", DEFAULT_TODO_ROWS);
    ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
    renderList("todos");
    renderList("timeline");
    hydrateEditors();
    hydrateImportantCheckboxes();
  });

  document.querySelector("#addTodo").addEventListener("click", () => addRow("todos"));
  document.querySelector("#addTimeline").addEventListener("click", () => addRow("timeline"));

  document.querySelectorAll("[data-toolbar] button").forEach((button) => {
    button.addEventListener("click", () => {
      if (activeEditor) activeEditor.focus();
      document.execCommand(button.dataset.command, false, null);
      scheduleSave();
    });
  });

  /* 에디터 글꼴 크기 선택 시 텍스트 서식 변경 및 플레이스홀더 복원 */
  document.querySelectorAll("[data-toolbar] select").forEach((select) => {
    select.addEventListener("change", () => {
      if (activeEditor) activeEditor.focus();
      document.execCommand(select.dataset.command, false, select.value);
      select.value = "";
      scheduleSave();
    });
  });

  /* 에디터 글자 색상 피커 변경 시 실시간 서식 적용 */
  document.querySelectorAll("[data-toolbar] input[type='color']").forEach((colorInput) => {
    colorInput.addEventListener("input", () => {
      if (activeEditor) activeEditor.focus();
      document.execCommand(colorInput.dataset.command, false, colorInput.value);
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-editor]").forEach((editor) => {
    editor.addEventListener("focus", () => {
      activeEditor = editor;
      updateEditorEmptyState(editor);
    });
    editor.addEventListener("input", () => {
      state.editors[editor.dataset.editor] = normalizeEditorHtml(editor.innerHTML);
      updateEditorEmptyState(editor);
      scheduleSave();
    });

    if (window.MutationObserver) {
      const observer = new MutationObserver(() => {
        updateEditorEmptyState(editor);
      });
      observer.observe(editor, { childList: true, subtree: true, characterData: true });
    }
  });

  /* 중요 업무 체크박스 클릭 시 완료 여부 상태 기록 및 취소선 클래스 토글 */
  document.querySelectorAll(".important-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const field = checkbox.dataset.checkbox;
      state.importantDone[field] = checkbox.checked;

      const card = checkbox.closest(".important-item");
      if (card) {
        if (checkbox.checked) {
          card.classList.add("is-completed");
        } else {
          card.classList.remove("is-completed");
        }
      }
      scheduleSave();
    });
  });

  /* --- 구글 연동 및 동기화 리스너 바인딩 --- */
  const connectBtn = document.querySelector("#connectGoogleBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectGoogle);

  const disconnectBtn = document.querySelector("#disconnectGoogleBtn");
  if (disconnectBtn) disconnectBtn.addEventListener("click", disconnectGoogle);

  /* 헤더의 수동 동기화 버튼 */
  const syncBtn = document.querySelector("#triggerCloudBackup");
  if (syncBtn) {
    syncBtn.addEventListener("click", manualSync);
  }

  window.addEventListener("focus", syncFromCloudIfLinked);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncFromCloudIfLinked();
  });

  bindBackupEvents();
  bindArchiveEvents();
}

function loadState() {
  const key = getStorageKeyForDate(state.planDate);
  const saved = localStorage.getItem(key);
  if (!saved) {
    state.todos = [];
    state.timeline = [];
    state.editors = {};
    state.importantDone = { important1: false, important2: false, important3: false };
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    const normalized = normalizePlanData(parsed);
    state.todos = Array.isArray(normalized.todos) ? normalized.todos : [];
    state.timeline = Array.isArray(normalized.timeline) ? normalized.timeline : [];
    state.editors = normalized.editors && typeof normalized.editors === "object" ? normalized.editors : {};
    state.importantDone = normalized.importantDone && typeof normalized.importantDone === "object"
      ? normalized.importantDone
      : { important1: false, important2: false, important3: false };
  } catch {
    localStorage.removeItem(key);
    state.todos = [];
    state.timeline = [];
    state.editors = {};
    state.importantDone = { important1: false, important2: false, important3: false };
  }
}

function saveState() {
  if (!googleAccessToken) return;
  const key = getStorageKeyForDate(state.planDate);
  localStorage.setItem(key, JSON.stringify(state));
  localStorage.setItem(LOCAL_MODIFIED_KEY, String(Date.now())); /* 수정 시각 갱신 (충돌 판별용) */
  scheduleCloudSync(); /* 로그인 상태면 드라이브로 자동 업로드 예약 */
}

function resetStateForCurrentDate() {
  state.todos = [];
  state.timeline = [];
  state.editors = {};
  state.importantDone = { important1: false, important2: false, important3: false };
  ensureRows("todos", DEFAULT_TODO_ROWS);
  ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
}

function clearLocalPlanData() {
  clearLocalPlanStorage();
  window.clearTimeout(cloudSyncTimer);
  window.clearTimeout(saveTimer);
  resetStateForCurrentDate();
  renderList("todos");
  renderList("timeline");
  hydrateEditors();
  hydrateImportantCheckboxes();
}

function clearLocalPlanStorage() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) keysToRemove.push(key);
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LOCAL_MODIFIED_KEY);
  localStorage.removeItem(AUTO_SHEETS_BACKUP_KEY);
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveState, 120);
}

function ensureRows(listName, count) {
  while (state[listName].length < count) {
    state[listName].push(createEmptyRow());
  }
}

function addRow(listName) {
  state[listName].push(createEmptyRow());
  renderList(listName);
  scheduleSave();
}

function createEmptyRow() {
  return {
    id: makeId(),
    task: "",
    start: "",
    end: ""
  };
}

function renderList(listName) {
  const config = lists[listName];
  config.el.replaceChildren();

  state[listName].forEach((row) => {
    const node = config.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = row.id;
    node.querySelector('[data-field="task"]').value = row.task;
    node.querySelector('[data-field="start"]').value = row.start;
    node.querySelector('[data-field="end"]').value = row.end;
    bindRowEvents(node, listName);
    autoResizeTitleInput(node.querySelector(".title-input"));
    config.el.appendChild(node);
  });
}

function bindRowEvents(rowEl, listName) {
  rowEl.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("focus", () => fillDefaultDateTime(input, lists[listName].dateType));
    input.addEventListener("input", () => {
      if (input.classList.contains("title-input")) autoResizeTitleInput(input);
      updateRowFromElement(rowEl, listName);
    });
  });

  rowEl.querySelectorAll("[data-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.dataset.clear;
      rowEl.querySelector(`[data-field="${field}"]`).value = "";
      updateRowFromElement(rowEl, listName);
    });
  });

  rowEl.querySelector("[data-delete]").addEventListener("click", () => {
    state[listName] = state[listName].filter((row) => row.id !== rowEl.dataset.id);
    renderList(listName);
    scheduleSave();
  });

  bindPointerReorder(rowEl, listName);
}

function updateRowFromElement(rowEl, listName) {
  const row = state[listName].find((item) => item.id === rowEl.dataset.id);
  if (!row) return;

  rowEl.querySelectorAll("[data-field]").forEach((input) => {
    row[input.dataset.field] = input.value;
  });
  scheduleSave();
}

function fillDefaultDateTime(input, dateType) {
  if (input.value) return;

  if (input.type === "date") {
    input.value = today();
  } else if (input.type === "datetime-local") {
    input.value = localDateTime();
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function bindPointerReorder(rowEl, listName) {
  const handle = rowEl.querySelector(".drag-handle");

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const listEl = lists[listName].el;
    const dragged = rowEl;
    let dropTarget = null;
    let dropPosition = "after";

    handle.setPointerCapture(event.pointerId);
    listEl.classList.add("is-reordering");
    dragged.classList.add("is-dragging");

    const onMove = (moveEvent) => {
      const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest("[data-row]");
      if (!target || target === dragged || target.parentElement !== listEl) return;

      const targetRect = target.getBoundingClientRect();
      dropTarget = target;
      dropPosition = moveEvent.clientY > targetRect.top + targetRect.height / 2 ? "after" : "before";
      clearDropIndicators(listEl);
      target.classList.add(dropPosition === "after" ? "drop-after" : "drop-before");
    };

    const onUp = () => {
      if (dropTarget) {
        listEl.insertBefore(dragged, dropPosition === "after" ? dropTarget.nextSibling : dropTarget);
      }

      clearDropIndicators(listEl);
      dragged.classList.remove("is-dragging");
      listEl.classList.remove("is-reordering");
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      syncOrderFromDom(listName);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

function clearDropIndicators(listEl) {
  listEl.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
    row.classList.remove("drop-before", "drop-after");
  });
}

function syncOrderFromDom(listName) {
  const orderedIds = [...lists[listName].el.querySelectorAll("[data-row]")].map((row) => row.dataset.id);
  state[listName].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
  scheduleSave();
}

function hydrateEditors() {
  document.querySelectorAll("[data-editor]").forEach((editor) => {
    const html = normalizeEditorHtml(state.editors[editor.dataset.editor]);
    state.editors[editor.dataset.editor] = html;
    editor.innerHTML = html;
    updateEditorEmptyState(editor);
  });
}

function updateEditorEmptyState(editor) {
  if (!editor) return;
  editor.classList.toggle("is-editor-empty", !htmlToText(editor.innerHTML));
}

function autoResizeTitleInput(input) {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 80)}px`;
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function localDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function padTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function formatBackupDateTime(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      padTwoDigits(value.getMonth() + 1),
      padTwoDigits(value.getDate())
    ].join("-") + `-${padTwoDigits(value.getHours())}:${padTwoDigits(value.getMinutes())}`;
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s|-)(\d{2}):(\d{2})/);
  if (match) return `${match[1]}-${match[2]}:${match[3]}`;
  return text;
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* 중요 업무 완료 체크박스 및 카드 취소선 상태를 데이터에 맞게 복원(Hydrate) */
function hydrateImportantCheckboxes() {
  document.querySelectorAll(".important-checkbox").forEach((checkbox) => {
    const field = checkbox.dataset.checkbox;
    const isChecked = !!(state.importantDone && state.importantDone[field]);
    checkbox.checked = isChecked;

    const card = checkbox.closest(".important-item");
    if (card) {
      if (isChecked) {
        card.classList.add("is-completed");
      } else {
        card.classList.remove("is-completed");
      }
    }
  });
}

function bindBackupEvents() {
  const openBtn = document.querySelector("#openBackupPanel");
  const closeBtn = document.querySelector("#closeBackupPanel");
  const modal = document.querySelector("#backupModal");
  const sheetsBtn = document.querySelector("#backupToSheets");
  const openSheetBtn = document.querySelector("#openArchiveSheet");
  const notionConnectBtn = document.querySelector("#connectNotionBackup");
  const notionBackupBtn = document.querySelector("#backupToNotion");
  const notionPageInput = document.querySelector("#notionParentPageId");

  if (!openBtn || !modal) return;

  openBtn.addEventListener("click", openBackupPanel);
  if (closeBtn) closeBtn.addEventListener("click", closeBackupPanel);

  modal.querySelectorAll("[data-backup-close]").forEach((el) => {
    el.addEventListener("click", closeBackupPanel);
  });

  if (sheetsBtn) sheetsBtn.addEventListener("click", () => backupCurrentPlanToSheets({ auto: false }));
  if (openSheetBtn) openSheetBtn.addEventListener("click", openArchiveSheet);
  if (notionConnectBtn) notionConnectBtn.addEventListener("click", connectNotionBackup);
  if (notionBackupBtn) notionBackupBtn.addEventListener("click", backupCurrentPlanToNotion);
  if (notionPageInput) {
    notionPageInput.value = localStorage.getItem(NOTION_PARENT_PAGE_ID_KEY) || "";
    notionPageInput.addEventListener("input", () => {
      localStorage.setItem(NOTION_PARENT_PAGE_ID_KEY, notionPageInput.value.trim());
    });
  }
}

function openBackupPanel() {
  const modal = document.querySelector("#backupModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("backup-open");
  updateBackupStatus();
}

function closeBackupPanel() {
  const modal = document.querySelector("#backupModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("backup-open");
}

function updateBackupStatus(message) {
  const status = document.querySelector("#backupStatusText");
  const openSheetBtn = document.querySelector("#openArchiveSheet");
  if (status) {
    status.textContent = message || (cloudConfig.archiveSheetId
      ? "Google Sheets archive is connected."
      : "Google Sheets archive will be created on first backup.");
  }
  if (openSheetBtn) openSheetBtn.disabled = !cloudConfig.archiveSheetId;
  updateNotionBackupStatus();
}

function updateNotionBackupStatus(message) {
  const status = document.querySelector("#notionBackupStatusText");
  const backupBtn = document.querySelector("#backupToNotion");
  const pageId = getNotionParentPageId();
  const connected = !!localStorage.getItem(NOTION_USER_ID_KEY) && !!localStorage.getItem(NOTION_USER_SECRET_KEY);

  if (status) {
    status.textContent = message || (connected
      ? "Notion 연결 정보가 이 브라우저에 저장되어 있습니다."
      : "Notion 백업은 먼저 Notion 페이지 ID 입력 후 연결해야 합니다.");
  }
  if (backupBtn) backupBtn.disabled = !connected || !pageId;
}

function bindArchiveEvents() {
  const openBtn = document.querySelector("#openArchiveSearch");
  const closeBtn = document.querySelector("#closeArchiveSearch");
  const modal = document.querySelector("#archiveModal");
  const dateInput = document.querySelector("#archiveDateFilter");
  const sectionSelect = document.querySelector("#archiveSectionFilter");
  const keywordInput = document.querySelector("#archiveKeyword");
  const clearBtn = document.querySelector("#clearArchiveSearch");

  if (!openBtn || !modal) return;

  openBtn.addEventListener("click", openArchiveSearch);
  if (closeBtn) closeBtn.addEventListener("click", closeArchiveSearch);

  modal.querySelectorAll("[data-archive-close]").forEach((el) => {
    el.addEventListener("click", closeArchiveSearch);
  });

  [dateInput, sectionSelect, keywordInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", scheduleArchiveSearch);
    input.addEventListener("change", scheduleArchiveSearch);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (dateInput) dateInput.value = "";
      if (sectionSelect) sectionSelect.value = "all";
      if (keywordInput) keywordInput.value = "";
      renderArchiveResults();
      if (keywordInput) keywordInput.focus();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeArchiveSearch();
  });
}

async function openArchiveSearch() {
  const modal = document.querySelector("#archiveModal");
  const keywordInput = document.querySelector("#archiveKeyword");
  if (!modal) return;

  saveState();
  modal.hidden = false;
  document.body.classList.add("archive-open");
  renderArchiveLoading();

  if (googleAccessToken) {
    try {
      await pullFromDrive();
    } catch (e) {
      if (e && e.status === 401) handleAuthExpired();
      else showToast(`Archive 최신 동기화 실패: ${e.message || "오류"}`, "warning");
    }
  }

  renderArchiveResults();
  if (keywordInput) keywordInput.focus();
}

function closeArchiveSearch() {
  const modal = document.querySelector("#archiveModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("archive-open");
}

function scheduleArchiveSearch() {
  window.clearTimeout(archiveSearchTimer);
  archiveSearchTimer = window.setTimeout(renderArchiveResults, 120);
}

function renderArchiveLoading() {
  const meta = document.querySelector("#archiveResultMeta");
  const results = document.querySelector("#archiveResults");
  if (meta) meta.textContent = "현재 저장된 계획을 불러오는 중입니다. Sheets/Notion 백업 기록은 포함하지 않습니다.";
  if (results) results.replaceChildren();
}

function renderArchiveResults() {
  const meta = document.querySelector("#archiveResultMeta");
  const results = document.querySelector("#archiveResults");
  if (!meta || !results) return;

  const matches = searchArchivePlans();
  results.replaceChildren();

  if (!matches.length) {
    meta.textContent = "현재 저장된 계획 검색 결과 0건 · Sheets/Notion 백업 제외";
    const empty = document.createElement("div");
    empty.className = "archive-empty";
    empty.textContent = "조건에 맞는 저장 기록이 없습니다.";
    results.appendChild(empty);
    return;
  }

  meta.textContent = `현재 저장된 계획 검색 결과 ${matches.length}건 · Sheets/Notion 백업 제외`;
  matches.forEach((match) => {
    const card = document.createElement("button");
    card.className = "archive-result-card";
    card.type = "button";
    card.dataset.date = match.date;

    const topline = document.createElement("div");
    topline.className = "archive-result-topline";

    const date = document.createElement("span");
    date.className = "archive-result-date";
    date.textContent = match.date;

    const section = document.createElement("span");
    section.className = "archive-result-section";
    section.textContent = match.sectionLabel;

    const snippet = document.createElement("div");
    snippet.className = "archive-result-snippet";
    snippet.textContent = match.snippet;

    topline.append(date, section);
    card.append(topline, snippet);
    card.addEventListener("click", () => goToArchiveDate(match.date));
    results.appendChild(card);
  });
}

function searchArchivePlans() {
  const dateFilter = document.querySelector("#archiveDateFilter")?.value || "";
  const sectionFilter = document.querySelector("#archiveSectionFilter")?.value || "all";
  const keyword = (document.querySelector("#archiveKeyword")?.value || "").trim().toLowerCase();
  const localData = gatherAllLocalData();
  const plans = localData.plans || {};

  return Object.keys(plans)
    .filter((date) => !dateFilter || date === dateFilter)
    .sort((a, b) => b.localeCompare(a))
    .flatMap((date) => {
      const plan = plans[date];
      return getArchiveSections(plan)
        .filter((section) => sectionFilter === "all" || section.id === sectionFilter)
        .filter((section) => !keyword || section.text.toLowerCase().includes(keyword))
        .map((section) => ({
          date,
          sectionLabel: section.label,
          snippet: makeArchiveSnippet(section.text, keyword)
        }));
    });
}

function getArchiveSections(plan) {
  if (!plan || typeof plan !== "object") return [];

  const editors = plan.editors && typeof plan.editors === "object" ? plan.editors : {};
  const importantText = ["important1", "important2", "important3"]
    .map((key) => htmlToText(editors[key]))
    .filter(Boolean)
    .join(" / ");

  const sections = [
    {
      id: "important",
      label: ARCHIVE_SECTION_LABELS.important,
      text: importantText
    },
    {
      id: "todos",
      label: ARCHIVE_SECTION_LABELS.todos,
      text: rowsToArchiveText(plan.todos)
    },
    {
      id: "timeline",
      label: ARCHIVE_SECTION_LABELS.timeline,
      text: rowsToArchiveText(plan.timeline)
    },
    {
      id: "memo",
      label: ARCHIVE_SECTION_LABELS.memo,
      text: htmlToText(editors.memo)
    },
    {
      id: "thanks",
      label: ARCHIVE_SECTION_LABELS.thanks,
      text: htmlToText(editors.thanks)
    },
    {
      id: "summary",
      label: ARCHIVE_SECTION_LABELS.summary,
      text: htmlToText(editors.summary)
    }
  ];

  return sections.filter((section) => section.text);
}

function rowsToArchiveText(rows) {
  if (!Array.isArray(rows)) return "";
  return rows
    .map((row) => [row.task, row.start, row.end].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" / ");
}

function htmlToText(html) {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEditorHtml(html) {
  return htmlToText(html) ? html : "";
}

function normalizePlanData(plan) {
  if (!plan || typeof plan !== "object") return plan;
  const editors = plan.editors && typeof plan.editors === "object" ? plan.editors : {};
  const normalizedEditors = {};
  Object.keys(editors).forEach((key) => {
    normalizedEditors[key] = normalizeEditorHtml(editors[key]);
  });
  return { ...plan, editors: normalizedEditors };
}

function htmlToBackupText(html) {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = html;
  el.querySelectorAll("br").forEach((node) => {
    node.replaceWith(document.createTextNode("\n"));
  });
  el.querySelectorAll("p, div, li").forEach((node) => {
    node.appendChild(document.createTextNode("\n"));
  });
  return (el.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeArchiveSnippet(text, keyword) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "내용 없음";
  if (!keyword) return clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;

  const lower = clean.toLowerCase();
  const index = lower.indexOf(keyword);
  if (index < 0) return clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;

  const start = Math.max(0, index - 45);
  const end = Math.min(clean.length, index + keyword.length + 90);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < clean.length ? "..." : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function goToArchiveDate(date) {
  saveState();
  state.planDate = date;
  const planDateInput = document.querySelector("#planDate");
  if (planDateInput) planDateInput.value = date;
  reloadCurrentView();
  closeArchiveSearch();
  showToast(`${date} 기록으로 이동했습니다.`, "success");
}

/* ==========================================================================
   Google Drive Sync Module (구글 드라이브 기반 기기 간 동기화 모듈)
   - 권한: userinfo.email + drive.file (둘 다 비민감, 구글 검증 불필요)
   - 저장: 사용자 본인 드라이브의 단일 JSON 파일에 전체 날짜 데이터 보관
   - 동기화: 로그인 시 pull, 변경 시 debounce push (전체 문서 last-write-wins)
   - 캘린더: 본인 구글 캘린더를 iframe으로 보기만 (편집은 구글 캘린더로 이동)
   ========================================================================== */

/* 1. 드라이브 동기화 설정(파일 ID) 로드 */
function initCloudConfig() {
  const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    cloudConfig.syncFileId = parsed.syncFileId || "";
    cloudConfig.archiveSheetId = parsed.archiveSheetId || "";
  } catch (e) {
    console.error("Cloud config load error:", e);
  }
}

/* 동기화 설정 보관 */
function saveCloudConfig() {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
}

/* 2. 구글 Identity Services (GIS) 초기화 */
function initGoogleGIS() {
  if (typeof google === "undefined") {
    setTimeout(initGoogleGIS, 500);
    return;
  }

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          showToast("구글 로그인에 실패했습니다.", "error");
          return;
        }
        googleAccessToken = tokenResponse.access_token;
        sessionStorage.setItem("google_access_token", googleAccessToken);
        showToast("Google 계정이 연동되었습니다.", "success");
        onGoogleLinked();
      }
    });

    if (googleAccessToken) {
      onGoogleLinked();
    } else {
      updateGoogleUI(false);
    }
  } catch (e) {
    console.error("Google GIS init error:", e);
  }
}

/* 로그인 직후: 이메일 조회, 캘린더 임베드, 드라이브에서 데이터 pull */
async function onGoogleLinked() {
  updateGoogleUI(true);
  try {
    await fetchUserEmail();
    embedCalendar();
    showToast("Google Drive에서 데이터를 불러오는 중입니다.", "info");
    await pullFromDrive({ preferRemote: true });
    startCloudPullLoop();
  } catch (e) {
    if (e && e.status === 401) {
      handleAuthExpired();
    } else {
      console.error("post-login sync error:", e);
      showToast(`동기화 실패: ${e.message || "오류"}`, "warning");
    }
  }
}

/* 사용자 이메일 조회 (캘린더 임베드 src로 사용) */
async function fetchUserEmail() {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { "Authorization": `Bearer ${googleAccessToken}` }
  });
  if (!res.ok) throw { status: res.status };
  const info = await res.json();
  userEmail = info.email || null;
}

/* 본인 구글 캘린더를 iframe으로 임베드 (보기 전용) */
function embedCalendar() {
  const frame = document.querySelector("#calendarFrame");
  if (!frame || !userEmail) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  frame.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(userEmail)}`
    + `&ctz=${encodeURIComponent(tz)}&mode=WEEK&showTitle=0&showPrint=0&showCalendars=0&showTz=0`;
}

/* 로그인 창 호출 */
function connectGoogle() {
  if (!tokenClient) {
    showToast("구글 연동 모듈 준비 중입니다. 잠시 후 다시 시도해 주세요.", "warning");
    return;
  }
  tokenClient.requestAccessToken({ prompt: "consent" });
}

/* 연동 해제 */
function disconnectGoogle() {
  const token = googleAccessToken;
  googleAccessToken = null;
  userEmail = null;
  sessionStorage.removeItem("google_access_token");
  stopCloudPullLoop();
  clearLocalPlanData();
  updateGoogleUI(false);
  const frame = document.querySelector("#calendarFrame");
  if (frame) frame.src = "";
  if (token) {
    try {
      google.accounts.oauth2.revokeToken(token, () => {
        showToast("구글 계정 연동을 해제하고 로컬 데이터를 비웠습니다.", "success");
      });
    } catch (e) {
      /* 취소 실패해도 로컬 상태는 이미 초기화됨 */
    }
  } else {
    showToast("로그아웃 상태로 전환하고 로컬 데이터를 비웠습니다.", "success");
  }
}

/* 토큰 만료 처리 */
function handleAuthExpired() {
  googleAccessToken = null;
  userEmail = null;
  sessionStorage.removeItem("google_access_token");
  stopCloudPullLoop();
  clearLocalPlanData();
  updateGoogleUI(false);
  showToast("로그인이 만료되었습니다. 다시 로그인해 주세요.", "warning");
}

/* 연동 상태에 따른 UI 자동 스위칭 */
function updateGoogleUI(isLinked) {
  const unlinkedArea = document.querySelector("#calendarUnlinked");
  const linkedArea = document.querySelector("#calendarLinked");
  const connectBtn = document.querySelector("#connectGoogleBtn");
  const disconnectBtn = document.querySelector("#disconnectGoogleBtn");
  const statusText = document.querySelector("#calendarStatusText");

  if (isLinked) {
    if (unlinkedArea) unlinkedArea.style.display = "none";
    if (linkedArea) linkedArea.style.display = "block";
    if (connectBtn) connectBtn.style.display = "none";
    if (disconnectBtn) disconnectBtn.style.display = "inline-flex";
    if (statusText) statusText.textContent = "Google 연동 완료 / 자동 동기화 중";
  } else {
    if (unlinkedArea) unlinkedArea.style.display = "flex";
    if (linkedArea) linkedArea.style.display = "none";
    if (connectBtn) connectBtn.style.display = "inline-flex";
    if (disconnectBtn) disconnectBtn.style.display = "none";
    if (statusText) statusText.textContent = "로그인하면 기기 간 자동 동기화됩니다";
  }
}

function startCloudPullLoop() {
  stopCloudPullLoop();
  if (!googleAccessToken) return;
  cloudPullTimer = window.setInterval(syncFromCloudIfLinked, CLOUD_PULL_INTERVAL_MS);
}

function stopCloudPullLoop() {
  if (cloudPullTimer) {
    window.clearInterval(cloudPullTimer);
    cloudPullTimer = 0;
  }
}

async function syncFromCloudIfLinked() {
  if (!googleAccessToken) return;
  try {
    await pullFromDrive({ silent: true });
  } catch (e) {
    if (e && e.status === 401) handleAuthExpired();
    else console.error("cloud pull error:", e);
  }
}

/* ---- 드라이브 동기화 핵심 로직 ---- */

/* 로컬의 모든 날짜 데이터를 하나의 페이로드로 수집 */
function gatherAllLocalData() {
  const plans = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_KEY_PREFIX)) {
      const date = k.slice(STORAGE_KEY_PREFIX.length);
      try {
        plans[date] = normalizePlanData(JSON.parse(localStorage.getItem(k)));
      } catch {
        /* 손상된 항목은 건너뜀 */
      }
    }
  }
  const lastModified = Number(localStorage.getItem(LOCAL_MODIFIED_KEY) || Date.now());
  return { __meta: { lastModified, app: "daily-plan" }, plans };
}

/* 원격 페이로드를 로컬에 반영 (원격에 있는 날짜 키를 덮어씀) */
function applyRemoteData(remote) {
  if (!remote || !remote.plans) return;
  Object.keys(remote.plans).forEach((date) => {
    localStorage.setItem(getStorageKeyForDate(date), JSON.stringify(normalizePlanData(remote.plans[date])));
  });
}

async function buildGoogleApiError(response, fallbackMessage) {
  let detail = "";
  try {
    const body = await response.json();
    const error = body && body.error ? body.error : null;
    const reason = error && Array.isArray(error.errors) && error.errors[0] ? error.errors[0].reason : "";
    const message = error && error.message ? error.message : "";
    detail = [reason, message].filter(Boolean).join(" / ");
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
  }

  let hint = fallbackMessage;
  if (response.status === 403) {
    hint = "Drive API 권한 또는 Google Cloud 설정을 확인해 주세요.";
  } else if (response.status === 400) {
    hint = "Drive API 요청 형식 또는 OAuth 설정을 확인해 주세요.";
  }

  const suffix = detail ? ` (${response.status}: ${detail})` : ` (${response.status})`;
  return new Error(`${hint}${suffix}`);
}

/* 동기화 파일 ID 확보 (캐시 검증, 검색, 없으면 생성) */
async function ensureSyncFile() {
  if (cloudConfig.syncFileId) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${cloudConfig.syncFileId}?fields=id,trashed`, {
      headers: { "Authorization": `Bearer ${googleAccessToken}` }
    });
    if (check.status === 401) throw { status: 401 };
    if (check.ok) {
      const meta = await check.json();
      if (!meta.trashed) return cloudConfig.syncFileId;
    } else if (check.status !== 404) {
      throw await buildGoogleApiError(check, "동기화 파일 확인에 실패했습니다.");
    }
    cloudConfig.syncFileId = "";
  }

  const q = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,modifiedTime)`, {
    headers: { "Authorization": `Bearer ${googleAccessToken}` }
  });
  if (searchRes.status === 401) throw { status: 401 };
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      cloudConfig.syncFileId = data.files[0].id;
      saveCloudConfig();
      return cloudConfig.syncFileId;
    }
  } else {
    throw await buildGoogleApiError(searchRes, "동기화 파일 검색에 실패했습니다.");
  }

  const boundary = "dpsync" + Date.now();
  const metadata = { name: SYNC_FILE_NAME, mimeType: "application/json" };
  const initialBody = JSON.stringify(gatherAllLocalData());
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    initialBody +
    `\r\n--${boundary}--`;

  const createRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${googleAccessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipart
  });
  if (createRes.status === 401) throw { status: 401 };
  if (!createRes.ok) throw await buildGoogleApiError(createRes, "동기화 파일 생성에 실패했습니다.");
  const created = await createRes.json();
  cloudConfig.syncFileId = created.id;
  saveCloudConfig();
  return cloudConfig.syncFileId;
}

/* 드라이브 파일 내용 다운로드 */
async function downloadSyncContent(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { "Authorization": `Bearer ${googleAccessToken}` }
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* 드라이브 파일 내용 업로드(덮어쓰기) */
async function uploadSyncContent(fileId, payload) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${googleAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) throw await buildGoogleApiError(res, "동기화 업로드에 실패했습니다.");
}

/* pull: 원격이 더 최신이면 로컬을 갱신, 아니면 로컬을 push */
async function pullFromDrive(options = {}) {
  if (!googleAccessToken) return;
  const fileId = await ensureSyncFile();
  const remote = await downloadSyncContent(fileId);
  const localMod = Number(localStorage.getItem(LOCAL_MODIFIED_KEY) || 0);
  const remoteMod = remote && remote.__meta ? Number(remote.__meta.lastModified || 0) : 0;

  if (remote && (options.preferRemote || remoteMod > localMod)) {
    applyRemoteData(remote);
    localStorage.setItem(LOCAL_MODIFIED_KEY, String(remoteMod || Date.now()));
    reloadCurrentView();
    if (!options.silent) showToast("최신 데이터를 불러왔습니다.", "success");
  } else {
    await pushToDrive();
  }
}

/* push: 로컬 전체 데이터를 드라이브에 업로드 */
async function pushToDrive() {
  if (!googleAccessToken) return;
  const fileId = await ensureSyncFile();
  await uploadSyncContent(fileId, gatherAllLocalData());
}

/* 변경 시 디바운스 자동 동기화 (로그인 상태에서만 동작) */
function scheduleCloudSync() {
  if (!googleAccessToken) return;
  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(() => {
    pushToDrive().catch((e) => {
      if (e && e.status === 401) handleAuthExpired();
      else console.error("cloud sync error:", e);
    });
  }, 2000);
}

/* pull로 로컬이 갱신된 경우 현재 보고 있는 날짜 화면을 다시 그림 */
function reloadCurrentView() {
  loadState();
  ensureRows("todos", DEFAULT_TODO_ROWS);
  ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
  renderList("todos");
  renderList("timeline");
  hydrateEditors();
  hydrateImportantCheckboxes();
}

/* 헤더의 수동 동기화 버튼 (강제 pull + push) */
async function manualSync() {
  if (!googleAccessToken) {
    showToast("먼저 구글 계정으로 로그인해 주세요.", "warning");
    return;
  }
  const btn = document.querySelector("#triggerCloudBackup");
  const label = btn ? btn.querySelector(".btn-label") : null;
  if (btn) btn.disabled = true;
  if (label) label.textContent = "동기화 중...";
  try {
    await pullFromDrive();
    showToast("동기화 완료", "success");
  } catch (e) {
    if (e && e.status === 401) handleAuthExpired();
    else showToast(`동기화 실패: ${e.message || "오류"}`, "error");
  } finally {
    if (btn) btn.disabled = false;
    if (label) label.textContent = "동기화";
  }
}

async function backupCurrentPlanToSheets(options = {}) {
  if (!googleAccessToken) {
    if (options.auto) return;
    showToast("먼저 Google 계정으로 로그인해 주세요.", "warning");
    return;
  }

  const btn = document.querySelector("#backupToSheets");
  if (btn && !options.auto) btn.disabled = true;
  updateBackupStatus("Google Sheets에 기록을 저장하는 중입니다...");

  try {
    saveState();
    const sheetId = await ensureArchiveSheet();
    const backupDate = today();
    const rows = buildDailyArchiveRows(backupDate, state.planDate, state);

    if (!rows.length) {
      updateBackupStatus("백업할 완료 기록이 없습니다.");
      if (!options.auto) showToast("백업할 완료 기록이 없습니다.", "warning");
      return;
    }

    await appendArchiveSheetRows(sheetId, rows);
    clearBackedUpCompletedItems();
    saveState();
    renderList("todos");
    renderList("timeline");
    hydrateEditors();
    hydrateImportantCheckboxes();

    if (options.auto) {
      localStorage.setItem(AUTO_SHEETS_BACKUP_KEY, backupDate);
    }
    updateBackupStatus(`Google Sheets 백업 완료: 오늘 기록 ${rows.length}행 추가 저장`);
    if (!options.auto) showToast("Google Sheets 백업 완료", "success");
  } catch (e) {
    if (e && e.status === 401) handleAuthExpired();
    else {
      updateBackupStatus(`Google Sheets 백업 실패: ${e.message || "오류"}`);
      if (!options.auto) showToast(`Google Sheets 백업 실패: ${e.message || "오류"}`, "error");
    }
  } finally {
    if (btn && !options.auto) btn.disabled = false;
    scheduleDailySheetsBackup();
  }
}

async function ensureArchiveSheet() {
  if (cloudConfig.archiveSheetId) {
    const check = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cloudConfig.archiveSheetId}?fields=spreadsheetId`, {
      headers: { "Authorization": `Bearer ${googleAccessToken}` }
    });
    if (check.status === 401) throw { status: 401 };
    if (check.ok) return cloudConfig.archiveSheetId;
    if (check.status !== 404) throw await buildGoogleApiError(check, "Google Sheets 백업 파일 확인에 실패했습니다.");
    cloudConfig.archiveSheetId = "";
    saveCloudConfig();
  }

  const foundId = await findArchiveSheet();
  if (foundId) {
    cloudConfig.archiveSheetId = foundId;
    saveCloudConfig();
    await ensureArchiveHeader(foundId);
    await ensureArchiveLayout(foundId);
    return foundId;
  }

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${googleAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { title: ARCHIVE_SHEET_NAME },
      sheets: [{ properties: { title: ARCHIVE_SHEET_TAB } }]
    })
  });
  if (createRes.status === 401) throw { status: 401 };
  if (!createRes.ok) throw await buildGoogleApiError(createRes, "Google Sheets 백업 파일 생성에 실패했습니다.");

  const created = await createRes.json();
  cloudConfig.archiveSheetId = created.spreadsheetId;
  saveCloudConfig();
  await ensureArchiveHeader(cloudConfig.archiveSheetId);
  await ensureArchiveLayout(cloudConfig.archiveSheetId);
  return cloudConfig.archiveSheetId;
}

async function findArchiveSheet() {
  const q = encodeURIComponent(`name='${ARCHIVE_SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`, {
    headers: { "Authorization": `Bearer ${googleAccessToken}` }
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) throw await buildGoogleApiError(res, "Google Sheets 백업 파일 검색에 실패했습니다.");

  const data = await res.json();
  return data.files && data.files.length ? data.files[0].id : "";
}

async function ensureArchiveHeader(sheetId) {
  const range = encodeURIComponent(`'${ARCHIVE_SHEET_TAB}'!A1:I1`);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${googleAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [["Backup Date", "Plan Date", "Important", "TO DO LIST", "TIME LINE", "MEMO", "THANKS GOD", "SUMMARY", "Updated At"]]
    })
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) throw await buildGoogleApiError(res, "Google Sheets 제목 행 저장에 실패했습니다.");
}

async function getArchiveSheetTabId(sheetId) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title))`, {
    headers: { "Authorization": `Bearer ${googleAccessToken}` }
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) throw await buildGoogleApiError(res, "Google Sheets 탭 정보 확인에 실패했습니다.");

  const data = await res.json();
  const sheet = (data.sheets || []).find((item) => item.properties && item.properties.title === ARCHIVE_SHEET_TAB);
  return sheet && sheet.properties ? sheet.properties.sheetId : null;
}

async function ensureArchiveLayout(sheetId) {
  const tabId = await getArchiveSheetTabId(sheetId);
  if (tabId === null) return;

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${googleAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [{
        repeatCell: {
          range: {
            sheetId: tabId,
            startColumnIndex: 0,
            endColumnIndex: 9
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: "WRAP",
              verticalAlignment: "MIDDLE"
            }
          },
          fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"
        }
      }]
    })
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) throw await buildGoogleApiError(res, "Google Sheets 줄바꿈 서식 적용에 실패했습니다.");
}

async function appendArchiveSheetRows(sheetId, rows) {
  await ensureArchiveHeader(sheetId);
  await ensureArchiveLayout(sheetId);
  const range = encodeURIComponent(`'${ARCHIVE_SHEET_TAB}'!A:I`);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${googleAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: rows })
  });
  if (res.status === 401) throw { status: 401 };
  if (!res.ok) throw await buildGoogleApiError(res, "Google Sheets 행 추가에 실패했습니다.");
}

function buildDailyArchiveRows(backupDate, planDate, plan) {
  const editors = plan && plan.editors && typeof plan.editors === "object" ? plan.editors : {};
  const updatedAt = formatBackupDateTime(new Date());
  const importantItems = [];

  ["important1", "important2", "important3"].forEach((key) => {
    const text = htmlToBackupText(editors[key]);
    if (plan.importantDone && plan.importantDone[key] && text) {
      importantItems.push(text);
    }
  });

  const todoItems = buildTodoBackupCells(plan.todos || []);
  const timelineItems = buildTimelineBackupCells(plan.timeline || []);
  const memoText = htmlToBackupText(editors.memo);
  const thanksText = htmlToBackupText(editors.thanks);
  const summaryText = htmlToBackupText(editors.summary);

  const rowCount = Math.max(
    importantItems.length,
    todoItems.length,
    timelineItems.length,
    memoText ? 1 : 0,
    thanksText ? 1 : 0,
    summaryText ? 1 : 0
  );
  if (!rowCount) return [];

  return Array.from({ length: rowCount }, (_, index) => [
    backupDate,
    planDate,
    importantItems[index] || "",
    todoItems[index] || "",
    timelineItems[index] || "",
    index === 0 ? memoText : "",
    index === 0 ? thanksText : "",
    index === 0 ? summaryText : "",
    updatedAt
  ]);
}

function buildTodoBackupCells(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row.end && row.task)
    .map((row, index) => [
      `#${index + 1}`,
      `내용: ${row.task}`,
      `시작: ${formatBackupDateTime(row.start) || "-"}`,
      `완료: ${formatBackupDateTime(row.end)}`
    ].join("\n"));
}

function buildTimelineBackupCells(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row.end && row.task)
    .map((row, index) => [
      `#${index + 1}`,
      `내용: ${row.task}`,
      `시작: ${formatBackupDateTime(row.start) || "-"}`,
      `마침: ${formatBackupDateTime(row.end)}`
    ].join("\n"));
}

function buildBackupPlanPayload(backupDate, planDate, plan) {
  const rows = buildDailyArchiveRows(backupDate, planDate, plan);
  if (!rows.length) return null;
  return {
    backupDate,
    planDate,
    rows: rows.map((row) => ({
      backupDate: row[0],
      planDate: row[1],
      important: row[2],
      todo: row[3],
      timeline: row[4],
      memo: row[5],
      thanks: row[6],
      summary: row[7],
      updatedAt: row[8]
    })),
    important: rows.map((row) => row[2]).filter(Boolean).join("\n\n"),
    todos: rows.map((row) => row[3]).filter(Boolean).join("\n\n"),
    timeline: rows.map((row) => row[4]).filter(Boolean).join("\n\n"),
    memo: rows[0][5],
    thanks: rows[0][6],
    summary: rows[0][7],
    updatedAt: rows[0][8]
  };
}

function clearBackedUpCompletedItems() {
  state.todos = (state.todos || []).filter((row) => !row.end || !row.task);
  state.timeline = (state.timeline || []).filter((row) => !row.end || !row.task);

  ["important1", "important2", "important3"].forEach((key) => {
    if (state.importantDone && state.importantDone[key] && htmlToText(state.editors[key])) {
      state.editors[key] = "";
      state.importantDone[key] = false;
    }
  });

  ["memo", "thanks", "summary"].forEach((key) => {
    if (htmlToText(state.editors[key])) state.editors[key] = "";
  });

  ensureRows("todos", DEFAULT_TODO_ROWS);
  ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
}

function openArchiveSheet() {
  if (!cloudConfig.archiveSheetId) {
    showToast("먼저 Google Sheets 백업을 실행해 주세요.", "warning");
    return;
  }
  window.open(`https://docs.google.com/spreadsheets/d/${cloudConfig.archiveSheetId}/edit`, "_blank", "noopener");
}

function getOrCreateNotionUserId() {
  let userId = localStorage.getItem(NOTION_USER_ID_KEY);
  if (!userId) {
    userId = window.crypto?.randomUUID ? window.crypto.randomUUID() : makeId();
    localStorage.setItem(NOTION_USER_ID_KEY, userId);
  }
  return userId;
}

function getOrCreateNotionUserSecret() {
  let secret = localStorage.getItem(NOTION_USER_SECRET_KEY);
  if (!secret) {
    const bytes = new Uint8Array(24);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    secret = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("") || makeId();
    localStorage.setItem(NOTION_USER_SECRET_KEY, secret);
  }
  return secret;
}

function getNotionParentPageId() {
  return (document.querySelector("#notionParentPageId")?.value || localStorage.getItem(NOTION_PARENT_PAGE_ID_KEY) || "").trim();
}

function connectNotionBackup() {
  const parentPageId = getNotionParentPageId();
  if (!parentPageId) {
    showToast("Notion 페이지 ID를 먼저 입력해 주세요.", "warning");
    return;
  }

  localStorage.setItem(NOTION_PARENT_PAGE_ID_KEY, parentPageId);
  const url = new URL(`${BACKUP_WORKER_BASE_URL}/auth/notion/start`);
  url.searchParams.set("userId", getOrCreateNotionUserId());
  url.searchParams.set("userSecret", getOrCreateNotionUserSecret());
  url.searchParams.set("parentPageId", parentPageId);
  window.open(url.toString(), "_blank", "noopener");
  updateNotionBackupStatus("Notion 승인 창을 열었습니다. 승인 후 돌아와 백업을 실행하세요.");
}

async function backupCurrentPlanToNotion() {
  const parentPageId = getNotionParentPageId();
  if (!parentPageId) {
    showToast("Notion 페이지 ID를 먼저 입력해 주세요.", "warning");
    return;
  }

  const btn = document.querySelector("#backupToNotion");
  if (btn) btn.disabled = true;
  updateNotionBackupStatus("Notion에 백업하는 중입니다...");

  try {
    saveState();
    const plan = buildBackupPlanPayload(today(), state.planDate, state);
    if (!plan) {
      updateNotionBackupStatus("백업할 완료 기록이 없습니다.");
      showToast("백업할 완료 기록이 없습니다.", "warning");
      return;
    }

    const res = await fetch(`${BACKUP_WORKER_BASE_URL}/backup/notion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: getOrCreateNotionUserId(),
        userSecret: getOrCreateNotionUserSecret(),
        plan
      })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || `Notion backup failed (${res.status})`);
    if (result.failedCount) {
      const firstFailure = result.failed && result.failed[0] ? `: ${result.failed[0].error}` : "";
      throw new Error(`${result.error || "Notion backup partially failed"}${firstFailure}`);
    }

    clearBackedUpCompletedItems();
    saveState();
    renderList("todos");
    renderList("timeline");
    hydrateEditors();
    hydrateImportantCheckboxes();
    updateNotionBackupStatus("Notion 백업 완료");
    showToast("Notion 백업 완료", "success");
  } catch (e) {
    updateNotionBackupStatus(`Notion 백업 실패: ${e.message || "오류"}`);
    showToast(`Notion 백업 실패: ${e.message || "오류"}`, "error");
  } finally {
    if (btn) btn.disabled = false;
    updateNotionBackupStatus();
  }
}

function scheduleDailySheetsBackup() {
  window.clearTimeout(autoSheetsBackupTimer);
  const now = new Date();
  const target = new Date(now);
  target.setHours(23, 59, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  autoSheetsBackupTimer = window.setTimeout(runScheduledSheetsBackup, target.getTime() - now.getTime());
}

async function runScheduledSheetsBackup() {
  const backupDate = today();
  if (localStorage.getItem(AUTO_SHEETS_BACKUP_KEY) === backupDate) {
    scheduleDailySheetsBackup();
    return;
  }
  await backupCurrentPlanToSheets({ auto: true });
}

/* 사용자 피드백 미니 토스트 알림창 */
function showToast(message, type = "success") {
  let toast = document.querySelector("#appToastContainer");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToastContainer";
    toast.className = "toast-container";
    document.body.appendChild(toast);
  }

  let icon = "🔔";
  if (type === "success") icon = "🟢";
  else if (type === "error") icon = "🔴";
  else if (type === "warning") icon = "🟡";

  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}
