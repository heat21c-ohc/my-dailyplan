const STORAGE_KEY_PREFIX = "daily-plan-state-v1-";
const LEGACY_STORAGE_KEY = "daily-plan-state-v1";
const THEME_STORAGE_KEY = "daily-plan-theme"; /* 사용자 테마 설정 저장용 키 */
const DEFAULT_TODO_ROWS = 6;
const DEFAULT_TIMELINE_ROWS = 6;

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
