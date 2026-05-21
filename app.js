const STORAGE_KEY_PREFIX = "daily-plan-state-v1-";
const LEGACY_STORAGE_KEY = "daily-plan-state-v1";
const THEME_STORAGE_KEY = "daily-plan-theme"; /* 사용자 테마 설정 저장용 키 */
const CLOUD_CONFIG_KEY = "daily-plan-cloud-config"; /* 드라이브 동기화 파일 ID 캐싱용 키 */
const LOCAL_MODIFIED_KEY = "daily-plan-last-modified"; /* 마지막 수정 시각(ms) - 기기 간 충돌 판별용 */
const SYNC_FILE_NAME = "my_dailyplan_sync.json"; /* 사용자 드라이브에 저장되는 동기화 파일명 */
const GOOGLE_CLIENT_ID = "552800594246-klpv3sg3m7tp72r633kuhkeg945ell20.apps.googleusercontent.com"; /* 주군의 Google Client ID */
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file"; /* 비민감 권한만 사용, 구글 검증 불필요 */
const DEFAULT_TODO_ROWS = 6;
const DEFAULT_TIMELINE_ROWS = 6;

// 구글 API 연동 런타임 변수
let googleAccessToken = sessionStorage.getItem("google_access_token") || null;
let tokenClient = null;
let userEmail = null; /* 로그인 사용자 이메일 (캘린더 임베드 src용) */
let cloudSyncTimer = 0; /* 드라이브 자동 동기화 디바운스 타이머 */

// 드라이브 동기화 설정 (앱이 생성한 동기화 파일 ID 캐싱)
const cloudConfig = {
  syncFileId: ""
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

init();

function init() {
  initTheme();
  initCloudConfig();
  migrateLegacyData();
  loadState();
  ensureRows("todos", DEFAULT_TODO_ROWS);
  ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
  document.querySelector("#planDate").value = state.planDate || today();
  renderList("todos");
  renderList("timeline");
  hydrateEditors();
  hydrateImportantCheckboxes();
  bindPageEvents();
  initGoogleGIS();
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
    });
    editor.addEventListener("input", () => {
      state.editors[editor.dataset.editor] = editor.innerHTML;
      scheduleSave();
    });
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
    state.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
    state.timeline = Array.isArray(parsed.timeline) ? parsed.timeline : [];
    state.editors = parsed.editors && typeof parsed.editors === "object" ? parsed.editors : {};
    state.importantDone = parsed.importantDone && typeof parsed.importantDone === "object"
      ? parsed.importantDone
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
  const key = getStorageKeyForDate(state.planDate);
  localStorage.setItem(key, JSON.stringify(state));
  localStorage.setItem(LOCAL_MODIFIED_KEY, String(Date.now())); /* 수정 시각 갱신 (충돌 판별용) */
  scheduleCloudSync(); /* 로그인 상태면 드라이브로 자동 업로드 예약 */
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
    editor.innerHTML = state.editors[editor.dataset.editor] || "";
  });
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
    await pullFromDrive();
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
  updateGoogleUI(false);
  const frame = document.querySelector("#calendarFrame");
  if (frame) frame.src = "";
  if (token) {
    try {
      google.accounts.oauth2.revokeToken(token, () => {
        showToast("구글 계정 연동이 해제되었습니다.", "success");
      });
    } catch (e) {
      /* 취소 실패해도 로컬 상태는 이미 초기화됨 */
    }
  }
}

/* 토큰 만료 처리 */
function handleAuthExpired() {
  googleAccessToken = null;
  sessionStorage.removeItem("google_access_token");
  updateGoogleUI(false);
  showToast("로그인이 만료되었습니다. 다시 로그인해 주세요.", "warning");
}

/* 연동 상태에 따른 UI 자동 스위칭 */
function updateGoogleUI(isLinked) {
  const unlinkedArea = document.querySelector("#calendarUnlinked");
  const linkedArea = document.querySelector("#calendarLinked");
  const statusText = document.querySelector("#calendarStatusText");

  if (isLinked) {
    if (unlinkedArea) unlinkedArea.style.display = "none";
    if (linkedArea) linkedArea.style.display = "block";
    if (statusText) statusText.textContent = "Google 연동 완료 / 자동 동기화 중";
  } else {
    if (unlinkedArea) unlinkedArea.style.display = "flex";
    if (linkedArea) linkedArea.style.display = "none";
    if (statusText) statusText.textContent = "로그인하면 기기 간 자동 동기화됩니다";
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
        plans[date] = JSON.parse(localStorage.getItem(k));
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
    localStorage.setItem(getStorageKeyForDate(date), JSON.stringify(remote.plans[date]));
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
async function pullFromDrive() {
  if (!googleAccessToken) return;
  const fileId = await ensureSyncFile();
  const remote = await downloadSyncContent(fileId);
  const localMod = Number(localStorage.getItem(LOCAL_MODIFIED_KEY) || 0);
  const remoteMod = remote && remote.__meta ? Number(remote.__meta.lastModified || 0) : 0;

  if (remote && remoteMod > localMod) {
    applyRemoteData(remote);
    localStorage.setItem(LOCAL_MODIFIED_KEY, String(remoteMod));
    reloadCurrentView();
    showToast("최신 데이터를 불러왔습니다.", "success");
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
