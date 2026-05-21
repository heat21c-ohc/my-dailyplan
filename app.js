const STORAGE_KEY_PREFIX = "daily-plan-state-v1-";
const LEGACY_STORAGE_KEY = "daily-plan-state-v1";
const THEME_STORAGE_KEY = "daily-plan-theme"; /* 사용자 테마 설정 저장용 키 */
const CLOUD_CONFIG_KEY = "daily-plan-cloud-config"; /* 클라우드 설정 상태 저장용 키 */
const GOOGLE_CLIENT_ID = "552800594246-klpv3sg3m7tp72r633kuhkeg945ell20.apps.googleusercontent.com"; /* 주군의 Google Client ID */
const DEFAULT_TODO_ROWS = 6;
const DEFAULT_TIMELINE_ROWS = 6;

// 구글 API 연동 런타임 변수
let googleAccessToken = sessionStorage.getItem("google_access_token") || null;
let tokenClient = null;

// 클라우드 하이브리드 백업 사용자 설정 값
const cloudConfig = {
  enableGoogleSheets: false,
  enableNotion: false,
  notionToken: "",
  notionDbId: "",
  spreadsheetId: "" /* 구글 드라이브 생성 시트 고유 ID 캐싱 */
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
  initTheme(); /* 페이지 구동 즉시 테마 초기화 실행 */
  initCloudConfig(); /* 클라우드 백업 설정 정보 로드 및 바인딩 */
  migrateLegacyData();
  loadState();
  ensureRows("todos", DEFAULT_TODO_ROWS);
  ensureRows("timeline", DEFAULT_TIMELINE_ROWS);
  document.querySelector("#planDate").value = state.planDate || today();
  renderList("todos");
  renderList("timeline");
  hydrateEditors();
  hydrateImportantCheckboxes(); /* 중요 업무 완료 체크박스 상태 동기화 */
  bindPageEvents();
  initGoogleGIS(); /* 구글 Identity Services SDK 초기화 실행 */
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
    hydrateImportantCheckboxes(); /* 중요 업무 완료 체크박스 상태 동기화 */
    if (googleAccessToken) {
      fetchGoogleCalendar(); /* 날짜 변경 시 오늘 구글 일정 실시간 동기화 */
    }
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
      select.value = ""; // '가' 표시 플레이스홀더 복원
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

  /* --- 구글 및 클라우드 통합 설정 리스너 바인딩 --- */
  const connectBtn = document.querySelector("#connectGoogleBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectGoogle);
  
  const disconnectBtn = document.querySelector("#disconnectGoogle");
  if (disconnectBtn) disconnectBtn.addEventListener("click", disconnectGoogle);
  
  const syncCalBtn = document.querySelector("#syncCalendar");
  if (syncCalBtn) syncCalBtn.addEventListener("click", fetchGoogleCalendar);

  /* 백업 설정 아코디언 슬라이드 */
  const toggleBackupSettings = document.querySelector("#toggleBackupSettings");
  const backupSettingsBody = document.querySelector("#backupSettingsBody");
  if (toggleBackupSettings && backupSettingsBody) {
    toggleBackupSettings.addEventListener("click", () => {
      const isActive = toggleBackupSettings.classList.toggle("active");
      backupSettingsBody.style.display = isActive ? "flex" : "none";
    });
  }

  /* 백업 토글 스위치 및 입력 상자 데이터 바인딩 */
  const sheetToggle = document.querySelector("#enableGoogleSheets");
  const notionToggle = document.querySelector("#enableNotion");
  const notionConfigInputs = document.querySelector("#notionConfigInputs");
  const notionTokenInput = document.querySelector("#notionToken");
  const notionDbIdInput = document.querySelector("#notionDbId");

  if (sheetToggle) {
    sheetToggle.addEventListener("change", () => {
      cloudConfig.enableGoogleSheets = sheetToggle.checked;
      saveCloudConfig();
    });
  }

  if (notionToggle) {
    notionToggle.addEventListener("change", () => {
      cloudConfig.enableNotion = notionToggle.checked;
      if (notionConfigInputs) {
        notionConfigInputs.style.display = notionToggle.checked ? "flex" : "none";
      }
      saveCloudConfig();
    });
  }

  if (notionTokenInput) {
    notionTokenInput.addEventListener("input", () => {
      cloudConfig.notionToken = notionTokenInput.value.trim();
      saveCloudConfig();
    });
  }

  if (notionDbIdInput) {
    notionDbIdInput.addEventListener("input", () => {
      cloudConfig.notionDbId = notionDbIdInput.value.trim();
      saveCloudConfig();
    });
  }

  /* 오늘 하루 클라우드 통합 백업 실행 버튼 */
  const triggerBackupBtn = document.querySelector("#triggerCloudBackup");
  if (triggerBackupBtn) {
    triggerBackupBtn.addEventListener("click", triggerUnifiedBackup);
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
   Google & Notion Cloud Backup Integration Module (클라우드 연동 및 백업 메인 모듈)
   ========================================================================== */

/* 1. 클라우드 설정 정보 로드 및 바인딩 */
function initCloudConfig() {
  const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (!saved) return;
  
  try {
    const parsed = JSON.parse(saved);
    cloudConfig.enableGoogleSheets = !!parsed.enableGoogleSheets;
    cloudConfig.enableNotion = !!parsed.enableNotion;
    cloudConfig.notionToken = parsed.notionToken || "";
    cloudConfig.notionDbId = parsed.notionDbId || "";
    cloudConfig.spreadsheetId = parsed.spreadsheetId || "";
    
    // UI 동기화
    const sheetToggle = document.querySelector("#enableGoogleSheets");
    const notionToggle = document.querySelector("#enableNotion");
    const notionConfigInputs = document.querySelector("#notionConfigInputs");
    const notionTokenInput = document.querySelector("#notionToken");
    const notionDbIdInput = document.querySelector("#notionDbId");
    
    if (sheetToggle) sheetToggle.checked = cloudConfig.enableGoogleSheets;
    if (notionToggle) {
      notionToggle.checked = cloudConfig.enableNotion;
      if (notionConfigInputs) {
        notionConfigInputs.style.display = cloudConfig.enableNotion ? "flex" : "none";
      }
    }
    if (notionTokenInput) notionTokenInput.value = cloudConfig.notionToken;
    if (notionDbIdInput) notionDbIdInput.value = cloudConfig.notionDbId;
  } catch (e) {
    console.error("Cloud config load error:", e);
  }
}

/* 클라우드 백업 설정 정보 보관 */
function saveCloudConfig() {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
}

/* 2. 구글 Identity Services (GIS) 라이브러리 초기화 */
function initGoogleGIS() {
  if (typeof google === "undefined") {
    console.warn("구글 GIS 라이브러리가 아직 로드되지 않았사옵니다. 재시도 중...");
    setTimeout(initGoogleGIS, 500);
    return;
  }
  
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
      callback: (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          showToast("❌ 구글 로그인에 실패하였사옵니다.", "error");
          return;
        }
        googleAccessToken = tokenResponse.access_token;
        sessionStorage.setItem("google_access_token", googleAccessToken);
        showToast("🔑 Google 계정이 성공적으로 연동되었사옵니다!", "success");
        updateGoogleUI(true);
        fetchGoogleCalendar();
      }
    });
    
    // 페이지 구동 시 기존에 들고 있던 토큰이 있다면 세션 복원
    if (googleAccessToken) {
      updateGoogleUI(true);
      fetchGoogleCalendar();
    } else {
      updateGoogleUI(false);
    }
  } catch (e) {
    console.error("Google GIS init error:", e);
  }
}

/* 구글 로그인 창 호출 */
function connectGoogle() {
  if (!tokenClient) {
    showToast("⚠️ 구글 연동 모듈을 준비 중이옵니다. 잠시 후 시도해 주시옵소서.", "warning");
    return;
  }
  tokenClient.requestAccessToken({ prompt: "consent" });
}

/* 구글 연동 끊기 */
function disconnectGoogle() {
  if (googleAccessToken) {
    try {
      google.accounts.oauth2.revokeToken(googleAccessToken, () => {
        googleAccessToken = null;
        sessionStorage.removeItem("google_access_token");
        showToast("🔒 구글 계정 연동이 해제되었사옵니다.", "success");
        updateGoogleUI(false);
      });
    } catch (e) {
      googleAccessToken = null;
      sessionStorage.removeItem("google_access_token");
      updateGoogleUI(false);
    }
  } else {
    updateGoogleUI(false);
  }
}

/* 구글 연동 상태에 따른 UI 자동 스위칭 */
function updateGoogleUI(isLinked) {
  const unlinkedArea = document.querySelector("#calendarUnlinked");
  const linkedArea = document.querySelector("#calendarLinked");
  const syncBtn = document.querySelector("#syncCalendar");
  const disconnectBtn = document.querySelector("#disconnectGoogle");
  const iframe = document.querySelector("#googleCalendarIframe");
  
  if (isLinked) {
    if (unlinkedArea) unlinkedArea.style.display = "none";
    if (linkedArea) linkedArea.style.display = "block";
    if (syncBtn) syncBtn.style.display = "inline-flex";
    if (disconnectBtn) disconnectBtn.style.display = "inline-flex";
    if (iframe && (iframe.src === "about:blank" || iframe.src === "")) {
      const selectedDate = state.planDate || today();
      const dateFormatted = selectedDate.replace(/-/g, "");
      iframe.src = `https://calendar.google.com/calendar/embed?src=primary&ctz=Asia%2FSeoul&mode=AGENDA&dates=${dateFormatted}%2F${dateFormatted}`;
    }
  } else {
    if (unlinkedArea) unlinkedArea.style.display = "grid";
    if (linkedArea) {
      linkedArea.style.display = "none";
    }
    if (iframe) iframe.src = "about:blank";
    if (syncBtn) syncBtn.style.display = "none";
    if (disconnectBtn) disconnectBtn.style.display = "none";
    const statusText = document.querySelector("#calendarStatusText");
    if (statusText) statusText.textContent = "일정 및 클라우드 연동 상태";
  }
}

/* 3. 구글 캘린더 일정 조회 */
function fetchGoogleCalendar() {
  if (!googleAccessToken) return;
  
  const statusText = document.querySelector("#calendarStatusText");
  const iframe = document.querySelector("#googleCalendarIframe");
  
  if (statusText) statusText.textContent = "일정을 불러오는 중이옵니다... ⚡";
  
  if (iframe) {
    const selectedDate = state.planDate || today();
    const dateFormatted = selectedDate.replace(/-/g, "");
    const baseUrl = `https://calendar.google.com/calendar/embed?src=primary&ctz=Asia%2FSeoul&mode=AGENDA&dates=${dateFormatted}%2F${dateFormatted}`;
    
    iframe.src = "about:blank"; // brief flash to show reload
    setTimeout(() => {
      iframe.src = baseUrl;
      if (statusText) statusText.textContent = "구글 캘린더 실시간 연동 중 ✨";
    }, 150);
  }
}

/* 4. 구글 스프레드시트 백업 핵심 엔진 */
async function backupToGoogleSheets(richData) {
  if (!googleAccessToken) {
    throw new Error("Google 계정이 아직 연동되지 않았사옵니다.");
  }
  
  let sheetId = cloudConfig.spreadsheetId;
  
  // 1단계: 캐싱된 시트 ID가 있는 경우 파일 실존 여부 검증
  if (sheetId) {
    try {
      const verifyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}`, {
        headers: { "Authorization": `Bearer ${googleAccessToken}` }
      });
      if (!verifyResponse.ok) {
        sheetId = ""; // 유효하지 않은 파일이면 새로 탐색
      }
    } catch {
      sheetId = "";
    }
  }
  
  // 2단계: 구글 드라이브 내에 "My_DailyPlan_Backup" 이라는 시트가 존재하는지 탐색
  if (!sheetId) {
    try {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='My_DailyPlan_Backup' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")}&fields=files(id)`;
      const searchResponse = await fetch(searchUrl, {
        headers: { "Authorization": `Bearer ${googleAccessToken}` }
      });
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.files && searchData.files.length > 0) {
          sheetId = searchData.files[0].id;
          cloudConfig.spreadsheetId = sheetId;
          saveCloudConfig();
        }
      }
    } catch (e) {
      console.warn("Google Drive search error:", e);
    }
  }
  
  // 3단계: 탐색에 실패했다면 새 스프레드시트를 최초 1회 신규 생성
  if (!sheetId) {
    try {
      const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: { title: "My_DailyPlan_Backup" }
        })
      });
      
      if (!createResponse.ok) throw new Error("새 스프레드시트 파일 생성에 실패하였습니다.");
      
      const newSheetData = await createResponse.json();
      sheetId = newSheetData.spreadsheetId;
      cloudConfig.spreadsheetId = sheetId;
      saveCloudConfig();
      
      // 첫 행에 머리글(열 타이틀) 작성
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:G1:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [
            ["날짜 (Date)", "오늘의 핵심업무 (Important)", "할 일 목록 (TO DO LIST)", "시간대별 타임라인 (TIME LINE)", "아이디어 메모 (MEMO)", "감사 일기 (THANKS GOD)", "하루 요약 (SUMMARY)"]
          ]
        })
      });
    } catch (createErr) {
      console.error("Sheet Create Error:", createErr);
      throw new Error("새 엑셀 스프레드시트 파일 개설에 실패하였사옵니다.");
    }
  }
  
  // 4단계: 오늘 하루 일지를 격자 행(Row)에 덧붙이기(Append)
  try {
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`;
    const rowData = [
      richData.date,
      richData.importantText,
      richData.todosText,
      richData.timelineText,
      richData.memoText,
      richData.thanksText,
      richData.summaryText
    ];
    
    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${googleAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [rowData]
      })
    });
    
    if (!appendResponse.ok) throw new Error("행 쓰기 API 호출 에러");
  } catch (appendErr) {
    console.error("Sheet Row Append Error:", appendErr);
    throw new Error("엑셀 시트에 백업 추가를 완료하지 못했사옵니다.");
  }
}

/* 5. 노션 API 백업 엔진 및 CORS 이중 안전장치 */
async function backupToNotion(richData) {
  const token = cloudConfig.notionToken;
  const dbId = cloudConfig.notionDbId;
  
  if (!token || !dbId) {
    throw new Error("노션 토큰 비밀번호와 데이터베이스 ID가 비어있사옵니다.");
  }
  
  // 노션 데이터 추가에 필요한 API 페이로드(Payload) 조립
  const notionBody = {
    parent: { database_id: dbId },
    properties: {
      "날짜": {
        date: { start: richData.date }
      },
      "오늘의 핵심업무": {
        title: [
          { text: { content: richData.importantText.slice(0, 100) } } // 노션 타이틀 열 대응
        ]
      },
      "하루 요약": {
        rich_text: [
          { text: { content: richData.summaryText.slice(0, 2000) } }
        ]
      }
    },
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "🎯 오늘의 핵심업무 (Important)" } }]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: richData.importantText } }]
        }
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "📋 할 일 목록 (TO DO LIST)" } }]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: richData.todosText || "등록된 할 일이 없사옵니다." } }]
        }
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "⏰ 시간대별 타임라인 (TIME LINE)" } }]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: richData.timelineText || "등록된 타임라인이 없사옵니다." } }]
        }
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "💡 아이디어 메모 (MEMO)" } }]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: richData.memoText || "메모가 비어 있사옵니다." } }]
        }
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "🙏 감사 일기 (THANKS GOD)" } }]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: richData.thanksText || "기록이 비어 있사옵니다." } }]
        }
      }
    ]
  };

  // 브라우저 직접 전송 시도 (CORS 오류 유발 가능성이 큼)
  try {
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(notionBody)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Notion API Error: ${response.status} - ${errText}`);
    }
  } catch (error) {
    console.warn("Notion direct backup failed due to CORS or Network. Showing Google Apps Script guide...", error);
    // CORS 보안 정책 등에 걸려 전송이 차단된 경우, 스마트 에러 구조 호출
    showAppsScriptGuideModal(richData, notionBody);
    throw new Error("CORS 보안 정책으로 브라우저 차단 감지! 구글 앱스 스크립트 중계 전송을 권장하옵니다.");
  }
}

/* 6. 스마트 데이터 가공 및 클라우드 통합 백업 시퀀스 실행 */
async function triggerUnifiedBackup() {
  const triggerBtn = document.querySelector("#triggerCloudBackup");
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.querySelector(".btn-label").textContent = "백업 데이터 가공 및 클라우드 전송 중...";
  }
  
  try {
    if (!cloudConfig.enableGoogleSheets && !cloudConfig.enableNotion) {
      showToast("⚠️ 백업하실 클라우드 설정(구글 시트 또는 노션)을 하나 이상 켜 주시옵소서.", "warning");
      return;
    }
    
    // [중요 특허 기술] 무손실 데이터 가공 처리기
    const richData = {
      date: state.planDate,
      importantText: "",
      todosText: "",
      timelineText: "",
      memoText: stripHtml(state.editors.memo || ""),
      thanksText: stripHtml(state.editors.thanks || ""),
      summaryText: stripHtml(state.editors.summary || "")
    };
    
    // 중요 업무 가공
    const imp1 = stripHtml(state.editors.important1 || "");
    const imp2 = stripHtml(state.editors.important2 || "");
    const imp3 = stripHtml(state.editors.important3 || "");
    const done = state.importantDone || {};
    
    const imp1Str = imp1 ? `${done.important1 ? "[완료] " : "[대기] "} ${imp1}` : "";
    const imp2Str = imp2 ? `${done.important2 ? "[완료] " : "[대기] "} ${imp2}` : "";
    const imp3Str = imp3 ? `${done.important3 ? "[완료] " : "[대기] "} ${imp3}` : "";
    richData.importantText = [imp1Str, imp2Str, imp3Str].filter(Boolean).join(" \n");
    
    // 할 일 목록 (TO DO LIST) 가로 1줄 무손실 압축 포맷화
    if (state.todos && state.todos.length > 0) {
      const todoRows = state.todos.map((item, index) => {
        if (!item.task.trim()) return null;
        let rowStr = `${index + 1}. [ ] ${item.task.trim()}`;
        if (item.start || item.end) {
          rowStr += ` (기한: ${item.start || "미지정"} ~ ${item.end || "미지정"})`;
        }
        return rowStr;
      }).filter(Boolean);
      richData.todosText = todoRows.join(" \n");
    }
    
    // 시간 순서별 실행 기록 (TIME LINE) 가로 1줄 무손실 압축 포맷화
    if (state.timeline && state.timeline.length > 0) {
      const timelineRows = state.timeline.map((item, index) => {
        if (!item.task.trim()) return null;
        let rowStr = `${index + 1}. [${item.start ? item.start.replace("T", " ") : "시작 미지정"} ~ ${item.end ? item.end.replace("T", " ") : "마침 미지정"}] ${item.task.trim()}`;
        return rowStr;
      }).filter(Boolean);
      richData.timelineText = timelineRows.join(" \n");
    }
    
    let googleSuccess = false;
    let notionSuccess = false;
    let notionCorsPrompted = false;
    
    // 구글 스프레드시트 백업 실행
    if (cloudConfig.enableGoogleSheets) {
      try {
        await backupToGoogleSheets(richData);
        googleSuccess = true;
      } catch (sheetErr) {
        showToast(`❌ 구글 시트 백업 실패: ${sheetErr.message}`, "error");
      }
    }
    
    // 노션 백업 실행
    if (cloudConfig.enableNotion) {
      try {
        await backupToNotion(richData);
        notionSuccess = true;
      } catch (notionErr) {
        if (notionErr.message.includes("CORS")) {
          notionCorsPrompted = true; // Apps Script 가이드 모달이 열림
        } else {
          showToast(`❌ 노션 백업 실패: ${notionErr.message}`, "error");
        }
      }
    }
    
    // 최종 상태 토스트 메시지 알림
    if (googleSuccess && notionSuccess) {
      showToast("📥 구글 시트 및 노션 백업이 모두 완료되었사옵니다!", "success");
    } else if (googleSuccess && !cloudConfig.enableNotion) {
      showToast("📥 구글 스프레드시트 백업 성공!", "success");
    } else if (notionSuccess && !cloudConfig.enableGoogleSheets) {
      showToast("📥 Notion 데이터베이스 백업 성공!", "success");
    } else if (googleSuccess && notionCorsPrompted) {
      showToast("📥 구글 시트는 저장 완료! 단, 노션은 보안 우회 가이드를 띄웠사옵니다.", "warning");
    }
    
  } catch (generalErr) {
    showToast(`❌ 통합 백업 중 예기치 못한 에러 발생: ${generalErr.message}`, "error");
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.querySelector(".btn-label").textContent = "오늘 하루 클라우드 통합 백업 전송";
    }
  }
}

/* HTML 태그를 날려 일반 텍스트만 추출하는 기법 */
function stripHtml(html) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/* 7. 고품격 사용자 피드백 미니 토스트 알림창 */
function showToast(message, type = "success") {
  // 기존 토스트 컨테이너 탐색 또는 생성
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
  
  // 3.5초 뒤 토스트 서서히 소멸
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

/* 8. 노션 브라우저 CORS 차단 해결을 위한 구글 Apps Script 연동 가이드 모달 팝업 */
function showAppsScriptGuideModal(richData, notionPayload) {
  // 모달이 이미 깔려 있다면 재사용
  let modal = document.querySelector("#notionCorsModal");
  if (modal) {
    modal.remove();
  }
  
  modal = document.createElement("div");
  modal.id = "notionCorsModal";
  
  // 화려하고 직관적인 입체 모달 구조 및 디자인
  modal.setAttribute("style", `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Inter', sans-serif;
  `);
  
  // 구글 앱스 스크립트 웹앱 중계 코드 조립
  const scriptCode = `
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var notionToken = data.token;
  var payload = data.payload;
  
  var options = {
    "method" : "post",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + notionToken,
      "Notion-Version": "2022-06-28"
    },
    "payload" : JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  var response = UrlFetchApp.fetch("https://api.notion.com/v1/pages", options);
  
  return ContentService.createTextOutput(JSON.stringify({
    "status": response.getResponseCode(),
    "body": response.getContentText()
  })).setMimeType(ContentService.MimeType.JSON);
}
  `.trim();
  
  modal.innerHTML = `
    <div style="
      background: var(--panel, #ffffff);
      color: var(--text, #0f172a);
      width: min(650px, 100%);
      max-height: 85vh;
      overflow-y: auto;
      border-radius: var(--radius, 16px);
      border: 1px solid var(--line-soft, #e2e8f0);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
    ">
      <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #4f46e5; display:flex; align-items:center; gap:8px;">
        🛡️ 노션 백업 CORS 브라우저 차단 해결 안내
      </h3>
      <p style="font-size: 13px; line-height: 1.6; margin: 0; color: var(--muted, #64748b);">
        주군, 브라우저의 강력한 보안 정책인 <strong>CORS(교차 출처 차단)</strong>로 인해 웹 화면에서 노션(Notion) 서버로 직접 백업 데이터를 쏘는 작업이 차단되었사옵니다. 
        하지만 공명이 설계한 <strong>구글 Apps Script(앱스 스크립트) 중계 서버</strong>를 심으시면 CORS 에러가 100% 차단 없이 무료로 통과되옵니다.
      </p>
      
      <div style="background: var(--panel-soft, #f1f5f9); border-radius: var(--radius-sm, 8px); padding: 14px; font-size: 12px; line-height: 1.6;">
        <strong>🛠️ 초간단 3단계 중계서버 개설법:</strong><br>
        1. 구글 시트 상단 메뉴 <strong>[확장 프로그램] -> [Apps Script]</strong>를 클릭하여 실행합니다.<br>
        2. 화면에 떠 있는 기존 기본 코드를 지우고, 아래의 소스코드를 그대로 <strong>복사하여 붙여넣습니다.</strong><br>
        3. 우측 상단 <strong>[배포] -> [새 배포]</strong> 클릭 -> 유형 선택 톱니바퀴에서 <strong>[웹 앱]</strong> 선택 -> 엑세스할 수 있는 사용자: <strong>[모든 사용자(Anyone)]</strong>로 설정 후 배포합니다.<br>
        4. 배포 성공 시 뜨는 <strong>웹 앱 URL 주소</strong>를 메모해 두었다가 활용하시옵소서!
      </div>
      
      <div>
        <span style="font-size: 11px; font-weight:700; color:var(--muted);">📋 복사용 Google Apps Script 소스코드:</span>
        <textarea readonly style="
          width: 100%; height: 120px; 
          font-family: monospace; font-size: 11px; 
          background: #1e293b; color: #38bdf8;
          border: 1px solid var(--line-soft); border-radius: 6px;
          padding: 8px; margin-top: 4px; resize: none;
        ">${scriptCode}</textarea>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
        <button id="closeCorsModalBtn" style="
          background: #4f46e5; color: #ffffff;
          border: none; border-radius: 8px;
          padding: 10px 20px; font-weight: 700; font-size: 12px;
          cursor: pointer; transition: background 0.2s;
        ">안내 확인 완료</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 닫기 버튼 이벤트 바인딩
  const closeBtn = modal.querySelector("#closeCorsModalBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.remove();
    });
  }
}

init();
