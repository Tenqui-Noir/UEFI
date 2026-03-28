const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const STORAGE_KEY = "aether-uefi-state";

const stage = document.getElementById("stage");
const panelArea = document.querySelector(".panel-area");
const sidebarItems = document.querySelectorAll(".sidebar-item");
const panels = document.querySelectorAll(".panel");
const toggleButtons = document.querySelectorAll(".toggle-button");
const bootToggleButtons = document.querySelectorAll(".boot-toggle");
const bootItems = document.querySelectorAll(".boot-item");
const bootChecks = document.querySelectorAll(".boot-check");
const bootFlashGroups = Array.from(document.querySelectorAll('[data-panel-content="boot"] .boot-flash-group'));
const bootList = document.querySelector(".boot-list");
const dateTimeInput = document.getElementById("dateTimeInput");
const currentDateTimeValue = document.getElementById("currentDateTimeValue");

let dragCandidateItem = null;
let draggedBootItem = null;
let dragHoverItem = null;
let dragStartX = 0;
let dragStartY = 0;
let suppressBootClick = false;

function resizeStage() {
  const scale = Math.min(
    window.innerWidth / DESIGN_WIDTH,
    window.innerHeight / DESIGN_HEIGHT
  );
  const offsetX = (window.innerWidth - DESIGN_WIDTH * scale) / 2;
  const offsetY = (window.innerHeight - DESIGN_HEIGHT * scale) / 2;

  stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeDateTimeInput(value) {
  const fullwidthMap = {
    "／": "/",
    "：": ":",
    "　": " "
  };

  let normalized = "";

  for (const char of value) {
    if (char >= "０" && char <= "９") {
      normalized += String.fromCharCode(char.charCodeAt(0) - 65248);
      continue;
    }

    normalized += fullwidthMap[char] || char;
  }

  return normalized.replace(/[^0-9/: ]/g, "");
}

function parseDateTimeInput(rawValue, baseDate) {
  const value = normalizeDateTimeInput(rawValue).trim().replace(/\s+/g, " ");
  if (!value) {
    return null;
  }

  const firstSpaceIndex = value.indexOf(" ");
  const datePart = firstSpaceIndex === -1 ? value : value.slice(0, firstSpaceIndex);
  const timePart = firstSpaceIndex === -1 ? "" : value.slice(firstSpaceIndex + 1).trim();

  const dateFields = datePart.split("/");
  if (dateFields.length < 1 || dateFields.length > 3) {
    return null;
  }

  if (!/^\d{4}$/.test(dateFields[0])) {
    return null;
  }

  if (dateFields.slice(1).some((field) => !/^\d{1,2}$/.test(field))) {
    return null;
  }

  const result = new Date(baseDate.getTime());
  const year = Number(dateFields[0]);
  const month = dateFields[1] === undefined ? result.getMonth() + 1 : Number(dateFields[1]);
  const day = dateFields[2] === undefined ? result.getDate() : Number(dateFields[2]);

  if (month < 1 || month > 12) {
    return null;
  }

  result.setFullYear(year, month - 1, 1);
  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  if (day < 1 || day > maxDay) {
    return null;
  }

  let timeFields = [];
  if (timePart) {
    timeFields = timePart.replace(/:/g, " ").split(" ").filter(Boolean);
    if (timeFields.length < 1 || timeFields.length > 3) {
      return null;
    }

    if (timeFields.some((field) => !/^\d{1,2}$/.test(field))) {
      return null;
    }
  }

  const hours = timeFields[0] === undefined ? result.getHours() : Number(timeFields[0]);
  const minutes = timeFields[1] === undefined ? result.getMinutes() : Number(timeFields[1]);
  const seconds = timeFields[2] === undefined ? result.getSeconds() : Number(timeFields[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  result.setFullYear(year, month - 1, day);
  result.setHours(hours, minutes, seconds, 0);
  return result;
}

function getDefaultState() {
  return {
    toggles: {},
    bootOrder: Array.from(bootItems).map((item) => item.dataset.bootId),
    bootChecked: Array.from(bootItems).reduce((result, item) => {
      const check = item.querySelector(".boot-check");
      result[item.dataset.bootId] = Boolean(check?.classList.contains("checked"));
      return result;
    }, {}),
    bootHighlight: bootItems[0]?.dataset.bootId || null,
    dateTimeOffsetMs: 0
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...getDefaultState(), ...JSON.parse(raw) } : getDefaultState();
  } catch (error) {
    return getDefaultState();
  }
}

const persistedState = loadState();

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  } catch (error) {
    // Ignore storage failures and keep the UI functional.
  }
}

function getEffectiveCurrentDate() {
  return new Date(Date.now() + (persistedState.dateTimeOffsetMs || 0));
}

function updateCurrentDateTime() {
  if (!currentDateTimeValue) {
    return;
  }

  currentDateTimeValue.textContent = formatDateTime(getEffectiveCurrentDate());
}

function syncToggleText(button) {
  const text = button.parentElement?.querySelector(".toggle-text");
  if (!text) {
    return;
  }

  text.textContent = button.classList.contains("off") ? "关" : "开";
}

function syncToggleAriaLabel(button) {
  const key = button.dataset.toggleKey;
  if (!key) {
    return;
  }

  const labels = {
    tpm: ["TPM 已开启", "TPM 已关闭"],
    "csm-support": ["CSM 支持已开启", "CSM 支持已关闭"],
    "pxe-ipv6": ["PXE 网络启动 IPv6 已开启", "PXE 网络启动 IPv6 已关闭"],
    "boot-from-usb": ["从 USB 设备启动已开启", "从 USB 设备启动已关闭"],
    "boot-configuration-lock": ["启动配置锁已开启", "启动配置锁已关闭"],
    "battery-limit": ["电池限制已开启", "电池限制已关闭"]
  };

  const pair = labels[key];
  if (!pair) {
    return;
  }

  button.setAttribute("aria-label", button.classList.contains("off") ? pair[1] : pair[0]);
}

function persistToggle(button) {
  const key = button.dataset.toggleKey;
  if (!key) {
    return;
  }

  persistedState.toggles[key] = !button.classList.contains("off");
  saveState();
}

function setBootHighlight(targetItem) {
  bootItems.forEach((item) => item.classList.remove("active"));
  if (targetItem) {
    targetItem.classList.add("active");
    persistedState.bootHighlight = targetItem.dataset.bootId || null;
    saveState();
  }
}

function resetBootHighlight() {
  if (!bootList) {
    return;
  }

  const currentItems = bootList.querySelectorAll(".boot-item");
  if (currentItems.length === 0) {
    return;
  }

  setBootHighlight(currentItems[0]);
}

function persistBootOrder() {
  if (!bootList) {
    return;
  }

  persistedState.bootOrder = Array.from(bootList.querySelectorAll(".boot-item")).map(
    (item) => item.dataset.bootId
  );
  saveState();
}

function persistBootChecked() {
  persistedState.bootChecked = Array.from(bootItems).reduce((result, item) => {
    const check = item.querySelector(".boot-check");
    result[item.dataset.bootId] = Boolean(check?.classList.contains("checked"));
    return result;
  }, {});
  saveState();
}

function flashBootDirtyRegion(options = {}) {
  const { resetHighlight = false } = options;

  if (bootFlashGroups.length === 0) {
    return;
  }

  const shouldFlash = Math.random() >= 0.35;
  if (!shouldFlash) {
    if (resetHighlight) {
      window.setTimeout(resetBootHighlight, 10);
    }
    return;
  }

  const endIndex = Math.floor(Math.random() * bootFlashGroups.length);
  const groupsToFlash = bootFlashGroups.slice(0, endIndex + 1);

  groupsToFlash.forEach((group) => group.classList.add("flashing"));
  window.setTimeout(() => {
    groupsToFlash.forEach((group) => group.classList.remove("flashing"));
    if (resetHighlight) {
      resetBootHighlight();
    }
  }, 10);
}

function flashWholePanelWithDelayedElement(options = {}) {
  const { resetHighlight = false } = options;

  if (!panelArea || bootFlashGroups.length === 0) {
    return;
  }

  const delayedTarget = bootFlashGroups[Math.floor(Math.random() * bootFlashGroups.length)];
  panelArea.classList.add("flashing");
  window.setTimeout(() => {
    panelArea.classList.remove("flashing");
    delayedTarget.classList.add("delay-reveal");
    window.setTimeout(() => {
      delayedTarget.classList.remove("delay-reveal");
      if (resetHighlight) {
        resetBootHighlight();
      }
    }, 10);
  }, 10);
}

function flashRandomSingleBootElement(options = {}) {
  const { resetHighlight = false } = options;

  if (bootFlashGroups.length === 0) {
    return;
  }

  const target = bootFlashGroups[Math.floor(Math.random() * bootFlashGroups.length)];
  target.classList.add("flashing");
  window.setTimeout(() => {
    target.classList.remove("flashing");
    if (resetHighlight) {
      resetBootHighlight();
    }
  }, 10);
}

function flashBootToggleResult(options = {}) {
  if (Math.random() >= 0.5) {
    flashWholePanelWithDelayedElement(options);
  } else {
    flashRandomSingleBootElement(options);
  }
}

function setActivePanel(panelKey) {
  if (dateTimeInput) {
    dateTimeInput.value = "";
  }

  sidebarItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelKey);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panelContent === panelKey);
  });

  if (panelKey === "boot") {
    resetBootHighlight();
  }
}

function applyPersistedState() {
  toggleButtons.forEach((button) => {
    const key = button.dataset.toggleKey;
    const isOn = persistedState.toggles[key];
    if (typeof isOn === "boolean") {
      button.classList.toggle("off", !isOn);
    }

    syncToggleAriaLabel(button);
    syncToggleText(button);
  });

  if (bootList && Array.isArray(persistedState.bootOrder)) {
    persistedState.bootOrder.forEach((bootId) => {
      const item = bootList.querySelector(`[data-boot-id="${bootId}"]`);
      if (item) {
        bootList.appendChild(item);
      }
    });
  }

  bootItems.forEach((item) => {
    const check = item.querySelector(".boot-check");
    const isChecked = persistedState.bootChecked[item.dataset.bootId];
    if (check && typeof isChecked === "boolean") {
      check.classList.toggle("checked", isChecked);
    }
  });

  setActivePanel("device-info");

  const highlightItem = persistedState.bootHighlight
    ? bootList?.querySelector(`[data-boot-id="${persistedState.bootHighlight}"]`)
    : null;
  setBootHighlight(highlightItem || bootList?.querySelector(".boot-item") || null);
}

resizeStage();
applyPersistedState();
updateCurrentDateTime();
window.addEventListener("resize", resizeStage);
window.setInterval(updateCurrentDateTime, 1000);
window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

sidebarItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    if (event.button !== 0) {
      return;
    }
    setActivePanel(item.dataset.panel);
  });
});

toggleButtons.forEach((button) => {
  if (button.classList.contains("boot-toggle")) {
    return;
  }

  button.addEventListener("click", (event) => {
    if (event.button !== 0) {
      return;
    }
    button.classList.toggle("off");
    syncToggleAriaLabel(button);
    syncToggleText(button);
    persistToggle(button);
  });
});

bootToggleButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    if (event.button !== 0) {
      return;
    }
    button.classList.toggle("off");
    syncToggleAriaLabel(button);
    syncToggleText(button);
    persistToggle(button);
    flashBootToggleResult();
  });
});

bootItems.forEach((item) => {
  item.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    item.dataset.wasActive = item.classList.contains("active") ? "true" : "false";
    setBootHighlight(item);
    dragCandidateItem = item;
  });

  item.addEventListener("click", (event) => {
    if (event.button !== 0) {
      return;
    }

    if (suppressBootClick) {
      suppressBootClick = false;
      item.dataset.wasActive = "false";
      return;
    }

    if (item.dataset.wasActive === "true") {
      item.dataset.wasActive = "false";
      return;
    }

    setBootHighlight(item);
    flashBootDirtyRegion();
    item.dataset.wasActive = "false";
  });

  item.addEventListener("mouseenter", () => {
    if (!draggedBootItem || draggedBootItem === item) {
      return;
    }

    dragHoverItem = item;
    setBootHighlight(item);
  });
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }

  dragStartX = event.clientX;
  dragStartY = event.clientY;
});

window.addEventListener("mousemove", (event) => {
  if (!dragCandidateItem && !draggedBootItem) {
    return;
  }

  if (!draggedBootItem && dragCandidateItem) {
    const movedEnough =
      Math.abs(event.clientX - dragStartX) > 4 ||
      Math.abs(event.clientY - dragStartY) > 4;

    if (!movedEnough) {
      return;
    }

    draggedBootItem = dragCandidateItem;
    dragHoverItem = dragCandidateItem;
    suppressBootClick = true;
  }
});

window.addEventListener("mouseup", () => {
  if (draggedBootItem && dragHoverItem && draggedBootItem !== dragHoverItem && bootList) {
    const currentItems = Array.from(bootList.querySelectorAll(".boot-item"));
    const draggedIndex = currentItems.indexOf(draggedBootItem);
    const hoverIndex = currentItems.indexOf(dragHoverItem);

    if (draggedIndex < hoverIndex) {
      bootList.insertBefore(draggedBootItem, dragHoverItem.nextSibling);
    } else {
      bootList.insertBefore(draggedBootItem, dragHoverItem);
    }

    setBootHighlight(dragHoverItem);
    persistBootOrder();
    flashBootDirtyRegion({ resetHighlight: true });
  }

  dragCandidateItem = null;
  draggedBootItem = null;
  dragHoverItem = null;
});

bootChecks.forEach((check) => {
  check.addEventListener("click", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    const targetItem = check.closest(".boot-item");
    setBootHighlight(targetItem);
    check.classList.toggle("checked");
    persistBootChecked();
    flashBootDirtyRegion({ resetHighlight: true });
  });
});

if (dateTimeInput) {
  dateTimeInput.addEventListener("beforeinput", (event) => {
    if (!event.data) {
      return;
    }

    if (normalizeDateTimeInput(event.data).length === 0) {
      event.preventDefault();
    }
  });

  dateTimeInput.addEventListener("compositionstart", (event) => {
    event.preventDefault();
  });

  dateTimeInput.addEventListener("input", () => {
    const normalized = normalizeDateTimeInput(dateTimeInput.value);
    if (dateTimeInput.value !== normalized) {
      const cursor = Math.min(dateTimeInput.selectionStart || normalized.length, normalized.length);
      dateTimeInput.value = normalized;
      dateTimeInput.setSelectionRange(cursor, cursor);
    }
  });

  dateTimeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const parsed = parseDateTimeInput(dateTimeInput.value, getEffectiveCurrentDate());
    if (!parsed) {
      dateTimeInput.value = "";
      return;
    }

    persistedState.dateTimeOffsetMs = parsed.getTime() - Date.now();
    saveState();
    updateCurrentDateTime();
    dateTimeInput.value = "";
  });
}
