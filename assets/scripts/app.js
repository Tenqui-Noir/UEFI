import { clearJsonState, loadJsonState, saveJsonState } from "./storage.js";

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const STORAGE_KEY = "aether-uefi-state";

const stage = document.getElementById("stage");
const panelArea = document.querySelector(".panel-area");
const sidebarItems = Array.from(document.querySelectorAll(".sidebar-item"));
const panels = Array.from(document.querySelectorAll(".panel"));
const toggleButtons = Array.from(document.querySelectorAll(".toggle-button"));
const bootToggleButtons = Array.from(document.querySelectorAll(".boot-toggle"));
const bootItems = Array.from(document.querySelectorAll(".boot-item"));
const bootChecks = Array.from(document.querySelectorAll(".boot-check"));
const bootFlashGroups = Array.from(document.querySelectorAll('[data-panel-content="boot"] .boot-flash-group'));
const bootList = document.querySelector(".boot-list");
const bootConfigSection = document.getElementById("bootConfigSection");
const bootConfigListWrap = document.getElementById("bootConfigListWrap");
const dateTimeInput = document.getElementById("dateTimeInput");
const currentDateTimeValue = document.getElementById("currentDateTimeValue");
const secureBootSummary = document.getElementById("secureBootSummary");
const passwordDialog = document.getElementById("passwordDialog");
const passwordDialogOpen = document.querySelector('[data-panel-content="security"] .security-button');
const secureBootDialog = document.getElementById("secureBootDialog");
const secureBootDialogOpen = document.querySelectorAll('[data-panel-content="security"] .security-button')[1] || null;
const deleteBootDialog = document.getElementById("deleteBootDialog");
const deleteBootName = document.getElementById("deleteBootName");
const authPasswordDialog = document.getElementById("authPasswordDialog");
const authPasswordInput = document.querySelector(".auth-password-input");
const authPasswordError = document.getElementById("authPasswordError");
const passwordSetupError = document.getElementById("passwordSetupError");
const uefiShell = document.getElementById("uefiShell");
const restartButton = document.getElementById("restartButton");
const preUefiScreen = document.getElementById("preUefiScreen");
const preUefiMainView = document.getElementById("preUefiMainView");
const devicePageView = document.getElementById("devicePageView");
const preUefiActions = Array.from(document.querySelectorAll(".pre-uefi-interactive"));
const enterUefiButton = document.getElementById("enterUefiButton");
const useDeviceButton = document.getElementById("useDeviceButton");
const devicePageBackButton = document.getElementById("devicePageBackButton");
const modalInputs = passwordDialog ? Array.from(passwordDialog.querySelectorAll(".modal-input")) : [];
const modalActions = passwordDialog ? Array.from(passwordDialog.querySelectorAll(".modal-action")) : [];
const modalConfirmButton = modalActions[0] || null;
const modalCancelButton = modalActions[1] || null;
const secureBootOptions = Array.from(document.querySelectorAll(".modal-option-item"));
const secureBootActions = Array.from(document.querySelectorAll(".secure-boot-action"));
const secureBootConfirmButton = secureBootActions[0] || null;
const secureBootCancelButton = secureBootActions[1] || null;
const deleteBootActions = Array.from(document.querySelectorAll(".delete-boot-action"));
const deleteBootConfirmButton = deleteBootActions[0] || null;
const deleteBootCancelButton = deleteBootActions[1] || null;
const authPasswordActions = Array.from(document.querySelectorAll(".auth-password-action"));
const authPasswordConfirmButton = authPasswordActions[0] || null;
const authPasswordCancelButton = authPasswordActions[1] || null;

let activeModalInputIndex = 0;
let activeModalActionIndex = 0;
let modalEnterPressed = false;
let modalIgnoreInitialEnter = false;
let activeSecureBootOptionIndex = 0;
let activeSecureBootActionIndex = 0;
let secureBootEnterPressed = false;
let secureBootIgnoreInitialEnter = false;
let pendingSecureBootOptionIndex = 0;
let activeDeleteBootActionIndex = 0;
let deleteBootEnterPressed = false;
let deleteBootIgnoreInitialEnter = false;
let pendingDeleteBootId = null;
let activeAuthPasswordActionIndex = 0;
let authPasswordEnterPressed = false;
let authPasswordIgnoreInitialEnter = false;
let restrictedMode = false;
let activePreUefiActionIndex = 0;
let preUefiEnterPressed = false;
let currentPreUefiView = "main";

let dragCandidateItem = null;
let draggedBootItem = null;
let dragHoverItem = null;
let dragStartX = 0;
let dragStartY = 0;
let suppressBootClick = false;

let navigationArea = "sidebar";
let sidebarKeyboardIndex = 0;
const panelKeyboardIndex = {
  security: 0,
  boot: 0,
  "date-time": 0,
  exit: 0
};

function enableKeyboardMode() {
  document.body.classList.add("keyboard-mode");
}

function disableKeyboardMode() {
  document.body.classList.remove("keyboard-mode");
  document.body.classList.remove("sidebar-focus");
}

function syncSidebarFocusMode() {
  document.body.classList.toggle(
    "sidebar-focus",
    navigationArea === "sidebar" && !getOpenModal()
  );
}

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
    secureBootOption: "microsoft-third-party",
    uefiPassword: "",
    bootDeleted: [],
    bootOrder: bootItems.map((item) => item.dataset.bootId),
    bootChecked: bootItems.reduce((result, item) => {
      const check = item.querySelector(".boot-check");
      result[item.dataset.bootId] = Boolean(check?.classList.contains("checked"));
      return result;
    }, {}),
    bootHighlight: bootItems[0]?.dataset.bootId || null,
    dateTimeOffsetMs: 0
  };
}

function getCurrentBootItems() {
  return bootList ? Array.from(bootList.querySelectorAll(".boot-item")) : [];
}

function isBootConfigurationLocked() {
  return Boolean(persistedState.toggles["boot-configuration-lock"]);
}

function isBootInteractionDisabled() {
  return restrictedMode || isBootConfigurationLocked();
}

function clearBootHighlight() {
  getCurrentBootItems().forEach((item) => item.classList.remove("active"));
}

function syncBootConfigurationLockState() {
  const visiblePanelKey = getVisiblePanelKey();
  const isLocked = isBootConfigurationLocked();
  bootConfigSection?.classList.toggle("locked", isLocked);
  bootConfigListWrap?.classList.toggle("locked", isLocked);

  const nextBootControls = getPanelControls("boot");
  const lockToggleIndex = nextBootControls.findIndex((control) => {
    if (!control.classList.contains("toggle-control")) {
      return false;
    }
    return control.querySelector(".toggle-button")?.dataset.toggleKey === "boot-configuration-lock";
  });
  panelKeyboardIndex.boot = lockToggleIndex >= 0 ? lockToggleIndex : 0;

  if (isLocked) {
    clearBootHighlight();
  }

  if (visiblePanelKey === "boot" && navigationArea === "panel" && !getOpenModal()) {
    applyKeyboardSelection();
  }
}

function isRestrictedPanel(panelKey) {
  return restrictedMode && ["security", "boot", "date-time"].includes(panelKey);
}

function syncRestrictedMode() {
  document.body.classList.toggle("restricted-mode", restrictedMode);
  if (isRestrictedPanel(getVisiblePanelKey()) && navigationArea === "panel") {
    navigationArea = "sidebar";
  }
  if (!getOpenModal()) {
    applyKeyboardSelection();
  }
}

function syncPreUefiSelection(index = 0) {
  const controls = getVisiblePreUefiControls();
  if (controls.length === 0) {
    return;
  }
  activePreUefiActionIndex = Math.max(0, Math.min(index, controls.length - 1));
  preUefiActions.forEach((button) => {
    button.classList.remove("is-selected");
  });
  controls.forEach((button, buttonIndex) => {
    button.classList.toggle("is-selected", buttonIndex === activePreUefiActionIndex);
  });
}

function showPreUefiScreen() {
  const waitAppearDelay = 300;
  const waitHoldDelay = 600;
  const authFadeDuration = 300;
  const blackHoldDelay = 300;
  const preUefiFadeDuration = 300;
  const menuDelay = 1000;

  currentPreUefiView = "main";
  preUefiMainView?.classList.remove("is-active", "is-fading-in", "is-fading-out", "is-prep");
  devicePageView?.classList.remove("is-active", "is-fading-in", "is-fading-out", "is-prep");
  document.body.classList.remove(
    "auth-gate-show-wait",
    "auth-gate-fading-out",
    "auth-gate-blackhold",
    "pre-uefi-active",
    "pre-uefi-fading-in"
  );

  window.setTimeout(() => {
    document.body.classList.add("auth-gate-show-wait");

    window.setTimeout(() => {
      document.body.classList.add("auth-gate-fading-out");

      window.setTimeout(() => {
        document.body.classList.remove("auth-gate-show-wait");
        document.body.classList.remove("auth-gate");
        document.body.classList.remove("auth-gate-fading-out");
        document.body.classList.add("auth-gate-blackhold");

        window.setTimeout(() => {
          document.body.classList.remove("auth-gate-blackhold");
          document.body.classList.add("pre-uefi-active");

          window.requestAnimationFrame(() => {
            void preUefiScreen?.offsetWidth;
            document.body.classList.add("pre-uefi-fading-in");

            window.setTimeout(() => {
              window.setTimeout(() => {
                preUefiMainView?.classList.add("is-prep");
                syncPreUefiSelection(0);

                window.requestAnimationFrame(() => {
                  void preUefiMainView?.offsetWidth;
                  preUefiMainView?.classList.remove("is-prep");
                  preUefiMainView?.classList.add("is-fading-in");

                  window.setTimeout(() => {
                    preUefiMainView?.classList.remove("is-fading-in");
                    preUefiMainView?.classList.add("is-active");
                  }, preUefiFadeDuration);
                });
              }, menuDelay);
            }, preUefiFadeDuration);
          });
        }, blackHoldDelay);
      }, authFadeDuration);
    }, waitHoldDelay);
  }, waitAppearDelay);
}

function hidePreUefiScreen() {
  document.body.classList.remove("pre-uefi-active");
  document.body.classList.remove("pre-uefi-fading-in");
  document.body.classList.remove("auth-gate-show-wait", "auth-gate-fading-out", "auth-gate-blackhold");
}

function getVisiblePreUefiControls() {
  if (currentPreUefiView === "device") {
    return Array.from(document.querySelectorAll("#devicePageView .pre-uefi-interactive"));
  }
  return Array.from(document.querySelectorAll("#preUefiMainView .pre-uefi-interactive"));
}

function resetClientState() {
  clearJsonState(STORAGE_KEY);
  window.location.reload();
}

function getSecureBootSummaryText(optionKey) {
  const labels = {
    "microsoft-only": "安全启动已启用，使用 Microsoft 密钥集配置",
    "microsoft-third-party": "安全启动已启用，使用 Microsoft 和第三方 CA 密钥集配置",
    disabled: "安全启动已关闭"
  };
  return labels[optionKey] || labels["microsoft-third-party"];
}

function applySecureBootSummary(optionKey) {
  if (secureBootSummary) {
    secureBootSummary.textContent = getSecureBootSummaryText(optionKey);
  }
}

function loadState() {
  return loadJsonState(STORAGE_KEY, getDefaultState());
}

const persistedState = loadState();

function saveState() {
  saveJsonState(STORAGE_KEY, persistedState);
}

function getEffectiveCurrentDate() {
  return new Date(Date.now() + (persistedState.dateTimeOffsetMs || 0));
}

function updateCurrentDateTime() {
  if (currentDateTimeValue) {
    currentDateTimeValue.textContent = formatDateTime(getEffectiveCurrentDate());
  }
}

function syncToggleText(button) {
  const text = button.parentElement?.querySelector(".toggle-text");
  if (text) {
    text.textContent = button.classList.contains("off") ? "关" : "开";
  }
}

function syncToggleAriaLabel(button) {
  const key = button.dataset.toggleKey;
  if (!key) {
    return;
  }

  const labels = {
    tpm: ["TPM 已开启", "TPM 已关闭"],
    "csm-support": ["CSM 支持已开启", "CSM 支持已关闭"],
    "pxe-ipv6": ["远程唤醒（WoL）已开启", "远程唤醒（WoL）已关闭"],
    "boot-from-usb": ["从 USB 设备启动已开启", "从 USB 设备启动已关闭"],
    "boot-configuration-lock": ["启动配置锁已开启", "启动配置锁已关闭"],
    "battery-limit": ["电池限制已开启", "电池限制已关闭"]
  };

  const pair = labels[key];
  if (pair) {
    button.setAttribute("aria-label", button.classList.contains("off") ? pair[1] : pair[0]);
  }
}

function persistToggle(button) {
  const key = button.dataset.toggleKey;
  if (!key) {
    return;
  }

  persistedState.toggles[key] = !button.classList.contains("off");
  if (key === "boot-configuration-lock") {
    syncBootConfigurationLockState();
  }
  saveState();
}

function setBootHighlight(targetItem) {
  getCurrentBootItems().forEach((item) => item.classList.remove("active"));
  if (targetItem) {
    targetItem.classList.add("active");
    persistedState.bootHighlight = targetItem.dataset.bootId || null;
    saveState();
  }
}

function resetBootHighlight() {
  const currentItems = getCurrentBootItems();
  if (currentItems.length === 0) {
    return;
  }
  if (currentItems[0]) {
    setBootHighlight(currentItems[0]);
  }
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
  persistedState.bootChecked = getCurrentBootItems().reduce((result, item) => {
    const check = item.querySelector(".boot-check");
    result[item.dataset.bootId] = Boolean(check?.classList.contains("checked"));
    return result;
  }, {});
  saveState();
}

function flashPanelAreaOnModalClose() {
  if (!panelArea) {
    return;
  }

  panelArea.classList.add("modal-close-flash");
  window.setTimeout(() => {
    panelArea.classList.remove("modal-close-flash");
  }, 10);
}

function flashSidebarSwitch() {
  if (!panelArea) {
    return;
  }

  const modes = ["full", "half-top", "half-bottom"];
  const mode = modes[Math.floor(Math.random() * modes.length)];
  let overlay = panelArea.querySelector(".screen-flash-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "screen-flash-overlay";
    panelArea.appendChild(overlay);
  }

  overlay.className = "screen-flash-overlay";
  if (mode !== "full") {
    overlay.classList.add(mode);
  }
  overlay.hidden = false;
  window.setTimeout(() => {
    overlay.hidden = true;
    overlay.className = "screen-flash-overlay";
  }, 10);
}

function getOpenModal() {
  if (authPasswordDialog && !authPasswordDialog.hidden) {
    return authPasswordDialog;
  }
  if (passwordDialog && !passwordDialog.hidden) {
    return passwordDialog;
  }
  if (secureBootDialog && !secureBootDialog.hidden) {
    return secureBootDialog;
  }
  if (deleteBootDialog && !deleteBootDialog.hidden) {
    return deleteBootDialog;
  }
  return null;
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

function clearKeyboardSelection() {
  document.querySelectorAll(".keyboard-selected").forEach((node) => {
    node.classList.remove("keyboard-selected");
  });
}

function getVisiblePanelKey() {
  return panels.find((panel) => panel.classList.contains("active"))?.dataset.panelContent || "device-info";
}

function getPanelControls(panelKey) {
  if (isRestrictedPanel(panelKey)) {
    return [];
  }
  switch (panelKey) {
    case "security":
      return Array.from(document.querySelectorAll('[data-panel-content="security"] .security-button, [data-panel-content="security"] .toggle-control'));
    case "boot":
      if (isBootConfigurationLocked()) {
        return Array.from(document.querySelectorAll('[data-panel-content="boot"] .toggle-control'));
      }
      return [
        ...Array.from(document.querySelectorAll('[data-panel-content="boot"] .boot-item')),
        ...Array.from(document.querySelectorAll('[data-panel-content="boot"] .toggle-control'))
      ];
    case "date-time":
      return dateTimeInput ? [dateTimeInput] : [];
    case "exit":
      return Array.from(document.querySelectorAll('[data-panel-content="exit"] .security-button'));
    default:
      return [];
  }
}

function applyKeyboardSelection() {
  clearKeyboardSelection();
  syncSidebarFocusMode();
  if (getOpenModal()) {
    return;
  }

  if (navigationArea === "sidebar") {
    const item = sidebarItems[sidebarKeyboardIndex];
    if (item) {
      item.classList.add("keyboard-selected");
    }
    return;
  }

  const panelKey = getVisiblePanelKey();
  const controls = getPanelControls(panelKey);
  if (controls.length === 0) {
    return;
  }

  const index = Math.max(0, Math.min(panelKeyboardIndex[panelKey] || 0, controls.length - 1));
  panelKeyboardIndex[panelKey] = index;
  const selectedControl = controls[index];
  selectedControl.classList.add("keyboard-selected");
  if (panelKey === "boot") {
    if (selectedControl.classList.contains("boot-item")) {
      setBootHighlight(selectedControl);
    } else {
      clearBootHighlight();
    }
  }
}

function syncSecureBootOptionSelection(index) {
  if (secureBootOptions.length === 0) {
    return;
  }
  activeSecureBootOptionIndex = Math.max(0, Math.min(index, secureBootOptions.length - 1));
  pendingSecureBootOptionIndex = activeSecureBootOptionIndex;
  secureBootOptions.forEach((option, optionIndex) => {
    option.classList.toggle("is-active", optionIndex === activeSecureBootOptionIndex);
  });
}

function getSecureBootOptionIndexByKey(optionKey) {
  const index = secureBootOptions.findIndex((option) => option.dataset.secureBootOption === optionKey);
  return index >= 0 ? index : 1;
}

function persistSecureBootOption() {
  const selectedOption = secureBootOptions[pendingSecureBootOptionIndex];
  if (!selectedOption) {
    return;
  }
  const optionKey = selectedOption.dataset.secureBootOption || "microsoft-third-party";
  persistedState.secureBootOption = optionKey;
  saveState();
  applySecureBootSummary(optionKey);
}

function syncSecureBootActionSelection(index) {
  if (secureBootActions.length === 0) {
    return;
  }
  activeSecureBootActionIndex = Math.max(0, Math.min(index, secureBootActions.length - 1));
  secureBootActions.forEach((button, buttonIndex) => {
    button.classList.toggle("is-selected", buttonIndex === activeSecureBootActionIndex);
  });
}

function syncDeleteBootActionSelection(index) {
  if (deleteBootActions.length === 0) {
    return;
  }
  activeDeleteBootActionIndex = Math.max(0, Math.min(index, deleteBootActions.length - 1));
  deleteBootActions.forEach((button, buttonIndex) => {
    button.classList.toggle("is-selected", buttonIndex === activeDeleteBootActionIndex);
  });
}

function setActivePanel(panelKey, options = {}) {
  const { flash = true } = options;
  if (dateTimeInput) {
    dateTimeInput.value = "";
  }

  sidebarItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelKey);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panelContent === panelKey);
  });

  sidebarKeyboardIndex = Math.max(
    0,
    sidebarItems.findIndex((button) => button.dataset.panel === panelKey)
  );
  navigationArea = "sidebar";
  if (panelKey === "boot") {
    resetBootHighlight();
  }
  applyKeyboardSelection();
  if (flash) {
    flashSidebarSwitch();
  }
}

function syncModalInputSelection(index) {
  if (modalInputs.length === 0) {
    return;
  }
  activeModalInputIndex = Math.max(0, Math.min(index, modalInputs.length - 1));
  modalInputs.forEach((input, inputIndex) => {
    input.classList.toggle("is-active", inputIndex === activeModalInputIndex);
  });
}

function syncModalActionSelection(index) {
  if (modalActions.length === 0) {
    return;
  }
  activeModalActionIndex = Math.max(0, Math.min(index, modalActions.length - 1));
  modalActions.forEach((button, buttonIndex) => {
    button.classList.toggle("is-selected", buttonIndex === activeModalActionIndex);
  });
}

function resetModalState() {
  syncModalInputSelection(0);
  syncModalActionSelection(0);
  modalActions.forEach((button) => button.classList.remove("is-pressed"));
  modalEnterPressed = false;
  modalIgnoreInitialEnter = false;
}

function resetSecureBootDialogState() {
  pendingSecureBootOptionIndex = getSecureBootOptionIndexByKey(persistedState.secureBootOption);
  syncSecureBootOptionSelection(pendingSecureBootOptionIndex);
  syncSecureBootActionSelection(0);
  secureBootActions.forEach((button) => button.classList.remove("is-pressed"));
  secureBootEnterPressed = false;
  secureBootIgnoreInitialEnter = false;
}

function resetDeleteBootDialogState() {
  syncDeleteBootActionSelection(0);
  deleteBootActions.forEach((button) => button.classList.remove("is-pressed"));
  deleteBootEnterPressed = false;
  deleteBootIgnoreInitialEnter = false;
}

function syncAuthPasswordActionSelection(index) {
  if (authPasswordActions.length === 0) {
    return;
  }
  activeAuthPasswordActionIndex = Math.max(0, Math.min(index, authPasswordActions.length - 1));
  authPasswordActions.forEach((button, buttonIndex) => {
    button.classList.toggle("is-selected", buttonIndex === activeAuthPasswordActionIndex);
  });
}

function resetAuthPasswordDialogState() {
  syncAuthPasswordActionSelection(0);
  authPasswordActions.forEach((button) => button.classList.remove("is-pressed"));
  authPasswordEnterPressed = false;
  authPasswordIgnoreInitialEnter = false;
  if (authPasswordInput) {
    authPasswordInput.value = "";
    authPasswordInput.classList.add("is-active");
  }
  if (authPasswordError) {
    authPasswordError.hidden = true;
  }
}

function startAuthGate() {
  document.body.classList.add("auth-gate");
  document.body.classList.remove(
    "auth-gate-reveal",
    "auth-gate-reveal-fast",
    "auth-gate-show-wait",
    "auth-gate-fading-out",
    "auth-gate-blackhold",
    "pre-uefi-active",
    "pre-uefi-fading-in"
  );
}

function finishAuthGateReveal() {
  showPreUefiScreen();
}

function finishAuthGateRevealFast() {
  document.body.classList.remove("auth-gate");
  hidePreUefiScreen();
  document.body.classList.add("auth-gate-reveal-fast");
  window.setTimeout(() => {
    document.body.classList.remove("auth-gate-reveal-fast");
  }, 90);
}

function enterUefiFromPreScreen() {
  finishAuthGateRevealFast();
}

function switchPreUefiView(nextView) {
  const currentViewElement = currentPreUefiView === "device" ? devicePageView : preUefiMainView;
  const nextViewElement = nextView === "device" ? devicePageView : preUefiMainView;
  if (!currentViewElement || !nextViewElement || currentViewElement === nextViewElement) {
    return;
  }

  currentViewElement.classList.remove("is-active", "is-fading-in");
  currentViewElement.classList.add("is-fading-out");

  window.setTimeout(() => {
    currentViewElement.classList.remove("is-fading-out");
    nextViewElement.classList.add("is-prep");
    currentPreUefiView = nextView;
    activePreUefiActionIndex = 0;
    syncPreUefiSelection(0);
    window.requestAnimationFrame(() => {
      void nextViewElement.offsetWidth;
      nextViewElement.classList.remove("is-prep");
      nextViewElement.classList.add("is-fading-in");
      window.setTimeout(() => {
        nextViewElement.classList.remove("is-fading-in");
        nextViewElement.classList.add("is-active");
      }, 300);
    });
  }, 300);
}

function setDevicePageNavPressed(pressed) {
  if (!devicePageBackButton) {
    return;
  }
  devicePageBackButton.classList.toggle("is-pressed", pressed);
}

if (devicePageBackButton) {
  devicePageBackButton.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    setDevicePageNavPressed(true);
  });

  devicePageBackButton.addEventListener("mouseup", (event) => {
    if (event.button !== 0) {
      return;
    }
    setDevicePageNavPressed(false);
  });

  devicePageBackButton.addEventListener("mouseleave", () => {
    setDevicePageNavPressed(false);
  });

  devicePageBackButton.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    setDevicePageNavPressed(false);
  });
}

function setPreUefiPressed(button, pressed) {
  if (!button) {
    return;
  }
  button.classList.toggle("is-pressed", pressed);
}

function restartIntoUefi() {
  restrictedMode = false;
  syncRestrictedMode();
  startAuthGate();
  clearKeyboardSelection();
  navigationArea = "sidebar";
  sidebarKeyboardIndex = 0;
  setActivePanel("device-info", { flash: false });
  finishAuthGateReveal();
}

function enterUefiOnLoad() {
  startAuthGate();
  finishAuthGateReveal();
}

function clearModalInputs() {
  modalInputs.forEach((input) => {
    input.value = "";
  });
  if (passwordSetupError) {
    passwordSetupError.hidden = true;
  }
}

function finishModalClose(dialog) {
  if (!dialog) {
    return;
  }
  dialog.hidden = true;
  dialog.classList.remove("closing-wipe", "closing-instant");
  if (dialog === passwordDialog) {
    clearModalInputs();
    resetModalState();
  }
  if (dialog === secureBootDialog) {
    resetSecureBootDialogState();
  }
  if (dialog === deleteBootDialog) {
    resetDeleteBootDialogState();
    pendingDeleteBootId = null;
  }
  if (dialog === authPasswordDialog) {
    resetAuthPasswordDialogState();
  }
  applyKeyboardSelection();
}

function closeModal(dialog) {
  if (!dialog || dialog.hidden) {
    return;
  }

  const mode = Math.floor(Math.random() * 3);
  if (mode === 0) {
    dialog.classList.add("closing-wipe");
    window.setTimeout(() => {
      finishModalClose(dialog);
      flashPanelAreaOnModalClose();
    }, 140);
    return;
  }

  if (mode === 1) {
    dialog.classList.add("closing-instant");
    window.setTimeout(() => {
      finishModalClose(dialog);
      flashPanelAreaOnModalClose();
    }, 10);
    return;
  }

  finishModalClose(dialog);
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

  if (Array.isArray(persistedState.bootDeleted) && bootList) {
    persistedState.bootDeleted.forEach((bootId) => {
      const item = bootList.querySelector(`[data-boot-id="${bootId}"]`);
      if (item) {
        item.remove();
      }
    });
  }

  syncBootConfigurationLockState();
  syncRestrictedMode();
  applySecureBootSummary(persistedState.secureBootOption);

  setActivePanel("device-info");

  const highlightItem = persistedState.bootHighlight
    ? bootList?.querySelector(`[data-boot-id="${persistedState.bootHighlight}"]`)
    : null;
  setBootHighlight(highlightItem || bootList?.querySelector(".boot-item") || null);
}

function submitDateTimeInput() {
  if (!dateTimeInput) {
    return;
  }

  const parsed = parseDateTimeInput(dateTimeInput.value, getEffectiveCurrentDate());
  if (!parsed) {
    dateTimeInput.value = "";
    return;
  }

  persistedState.dateTimeOffsetMs = parsed.getTime() - Date.now();
  saveState();
  updateCurrentDateTime();
  dateTimeInput.value = "";
}

function handleDateTimeKeyboardInput(event) {
  if (
    !dateTimeInput ||
    getVisiblePanelKey() !== "date-time" ||
    navigationArea !== "panel" ||
    restrictedMode
  ) {
    return false;
  }

  const key = event.key;
  if (key === "Enter") {
    event.preventDefault();
    submitDateTimeInput();
    return true;
  }

  if (key === "Backspace") {
    event.preventDefault();
    dateTimeInput.value = dateTimeInput.value.slice(0, -1);
    return true;
  }

  if (key.length === 1) {
    const normalized = normalizeDateTimeInput(key);
    if (normalized) {
      event.preventDefault();
      dateTimeInput.value += normalized;
      return true;
    }
  }

  return false;
}

function handleModalKeyboardInput(event) {
  if (!passwordDialog || passwordDialog.hidden || modalInputs.length === 0) {
    return false;
  }

  const input = modalInputs[activeModalInputIndex];
  if (!input) {
    return false;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    input.value = input.value.slice(0, -1);
    return true;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    if (input.value.length < 128) {
      input.value += event.key;
    }
    return true;
  }

  return false;
}

function handleAuthPasswordKeyboardInput(event) {
  if (!authPasswordDialog || authPasswordDialog.hidden || !authPasswordInput) {
    return false;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    authPasswordInput.value = authPasswordInput.value.slice(0, -1);
    if (authPasswordError) {
      authPasswordError.hidden = true;
    }
    return true;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    if (authPasswordInput.value.length < 128) {
      authPasswordInput.value += event.key;
      if (authPasswordError) {
        authPasswordError.hidden = true;
      }
    }
    return true;
  }

  return false;
}

function activatePanelControl(element) {
  if (!element) {
    return;
  }

  const panelKey = getVisiblePanelKey();
  if (panelKey === "boot" && element.classList.contains("boot-item")) {
    if (isBootConfigurationLocked()) {
      return;
    }
    const check = element.querySelector(".boot-check");
    if (!check) {
      return;
    }
    setBootHighlight(element);
    check.classList.toggle("checked");
    persistBootChecked();
    flashBootDirtyRegion();
    return;
  }

  if (
    (panelKey === "boot" || panelKey === "security") &&
    element.classList.contains("toggle-control")
  ) {
    if (isRestrictedPanel(panelKey)) {
      return;
    }
    element.querySelector(".toggle-button")?.click();
    return;
  }

  if (isRestrictedPanel(panelKey)) {
    return;
  }
  element.click();
}

function moveBootItemByKeyboard(direction) {
  if (!bootList || getVisiblePanelKey() !== "boot" || navigationArea !== "panel" || isBootInteractionDisabled()) {
    return false;
  }

  const controls = getPanelControls("boot");
  const currentIndex = panelKeyboardIndex.boot || 0;
  const currentControl = controls[currentIndex];
  if (!currentControl || !currentControl.classList.contains("boot-item")) {
    return false;
  }

  const currentItems = Array.from(bootList.querySelectorAll(".boot-item"));
  const itemIndex = currentItems.indexOf(currentControl);
  if (itemIndex === -1) {
    return false;
  }

  const targetIndex = direction < 0 ? itemIndex - 1 : itemIndex + 1;
  if (targetIndex < 0 || targetIndex >= currentItems.length) {
    return true;
  }

  const targetItem = currentItems[targetIndex];
  if (direction < 0) {
    bootList.insertBefore(currentControl, targetItem);
  } else {
    bootList.insertBefore(currentControl, targetItem.nextSibling);
  }

  persistBootOrder();
  const reorderedControls = getPanelControls("boot");
  const reorderedIndex = reorderedControls.indexOf(currentControl);
  panelKeyboardIndex.boot = reorderedIndex >= 0 ? reorderedIndex : currentIndex;
  setBootHighlight(currentControl);
  applyKeyboardSelection();
  flashBootDirtyRegion();
  window.setTimeout(applyKeyboardSelection, 10);
  return true;
}

function handleKeyboardNavigation(event) {
  if (event.key === "Home") {
    event.preventDefault();
    resetClientState();
    return;
  }

  if (document.body.classList.contains("pre-uefi-active") && !getOpenModal()) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      if (currentPreUefiView === "device") {
        syncPreUefiSelection(0);
      } else {
        const preUefiMoves = {
          ArrowUp: [0, 0, 1, 3],
          ArrowDown: [1, 2, 2, 3],
          ArrowLeft: [0, 1, 2, 0],
          ArrowRight: [3, 3, 3, 3]
        };
        syncPreUefiSelection(preUefiMoves[event.key][activePreUefiActionIndex] ?? 0);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const controls = getVisiblePreUefiControls();
      const targetButton = controls[activePreUefiActionIndex];
      if (event.repeat || preUefiEnterPressed || !targetButton) {
        return;
      }
      preUefiEnterPressed = true;
      setPreUefiPressed(targetButton, true);
      return;
    }
  }

  if (getOpenModal()) {
    return;
  }

  const navigationKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
    " "
  ];
  if (navigationKeys.includes(event.key)) {
    enableKeyboardMode();
  }

  if (handleDateTimeKeyboardInput(event)) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    sidebarKeyboardIndex = Math.max(
      0,
      sidebarItems.findIndex((button) => button.classList.contains("active"))
    );
    navigationArea = "sidebar";
    applyKeyboardSelection();
    return;
  }

  if (event.key === "ArrowRight") {
    const controls = getPanelControls(getVisiblePanelKey());
    if (controls.length > 0) {
      event.preventDefault();
      panelKeyboardIndex[getVisiblePanelKey()] = 0;
      navigationArea = "panel";
      applyKeyboardSelection();
    }
    return;
  }

  if (navigationArea === "sidebar") {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -1 : 1;
      sidebarKeyboardIndex = Math.max(0, Math.min(sidebarKeyboardIndex + delta, sidebarItems.length - 1));
      applyKeyboardSelection();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      sidebarItems[sidebarKeyboardIndex]?.click();
      return;
    }
  }

  const panelKey = getVisiblePanelKey();
  const controls = getPanelControls(panelKey);
  if (navigationArea !== "panel" || controls.length === 0) {
    return;
  }

  if (panelKey === "boot") {
    const currentBootControls = getPanelControls("boot");
    const currentBootControl = currentBootControls[panelKeyboardIndex.boot || 0];

    if (event.key === "Delete") {
      if (currentBootControl && currentBootControl.classList.contains("boot-item")) {
        event.preventDefault();
        openDeleteBootDialog(currentBootControl, true);
        return;
      }
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      if (moveBootItemByKeyboard(-1)) {
        return;
      }
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      if (moveBootItemByKeyboard(1)) {
        return;
      }
    }
  }

  const currentIndex = panelKeyboardIndex[panelKey] || 0;

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    const delta = event.key === "ArrowUp" ? -1 : 1;
    panelKeyboardIndex[panelKey] = Math.max(0, Math.min(currentIndex + delta, controls.length - 1));
    applyKeyboardSelection();
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activatePanelControl(controls[currentIndex]);
  }
}

resizeStage();
applyPersistedState();
updateCurrentDateTime();
applyKeyboardSelection();
enterUefiOnLoad();

window.addEventListener("resize", resizeStage);
window.setInterval(updateCurrentDateTime, 1000);
window.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("keydown", handleKeyboardNavigation);
window.addEventListener("mousedown", () => {
  disableKeyboardMode();
});

document.querySelectorAll("button, input").forEach((element) => {
  element.addEventListener("mousedown", (event) => {
    if (element === dateTimeInput) {
      return;
    }
    event.preventDefault();
  });
});

sidebarItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    if (event.button !== 0) {
      return;
    }
    if (item.classList.contains("active")) {
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
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (restrictedMode && getVisiblePanelKey() === "security") {
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
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (restrictedMode && getVisiblePanelKey() === "boot") {
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
  const trashIcon = item.querySelector(".trash-icon");

  item.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    if (isBootInteractionDisabled()) {
      return;
    }
    item.dataset.wasActive = item.classList.contains("active") ? "true" : "false";
    setBootHighlight(item);
    dragCandidateItem = item;
  });

  item.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (isBootInteractionDisabled()) {
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
    if (isBootInteractionDisabled()) {
      return;
    }
    if (!draggedBootItem || draggedBootItem === item) {
      return;
    }

    dragHoverItem = item;
    setBootHighlight(item);
  });

  trashIcon?.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    if (isBootInteractionDisabled()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setBootHighlight(item);
    openDeleteBootDialog(item, false);
  });

  trashIcon?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
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
  if (isBootInteractionDisabled()) {
    return;
  }
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
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (isBootInteractionDisabled()) {
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
  dateTimeInput.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    navigationArea = "panel";
    panelKeyboardIndex["date-time"] = 0;
    applyKeyboardSelection();
  });

  dateTimeInput.addEventListener("beforeinput", (event) => {
    if (event.data && normalizeDateTimeInput(event.data).length === 0) {
      event.preventDefault();
    }
  });

  dateTimeInput.addEventListener("compositionstart", (event) => {
    event.preventDefault();
  });

  dateTimeInput.addEventListener("input", () => {
    const normalized = normalizeDateTimeInput(dateTimeInput.value);
    if (dateTimeInput.value !== normalized) {
      dateTimeInput.value = normalized;
    }
  });
}

function openPasswordDialog(ignoreInitialEnter = false) {
  if (!passwordDialog) {
    return;
  }
  resetModalState();
  modalIgnoreInitialEnter = ignoreInitialEnter;
  passwordDialog.hidden = false;
}

function openSecureBootDialog(ignoreInitialEnter = false) {
  if (!secureBootDialog) {
    return;
  }
  resetSecureBootDialogState();
  secureBootIgnoreInitialEnter = ignoreInitialEnter;
  secureBootDialog.hidden = false;
}

function openDeleteBootDialog(bootItem, ignoreInitialEnter = false) {
  if (!deleteBootDialog || !bootItem) {
    return;
  }
  pendingDeleteBootId = bootItem.dataset.bootId || null;
  if (deleteBootName) {
    deleteBootName.textContent =
      bootItem.querySelector(".boot-label")?.textContent?.trim() || "";
  }
  resetDeleteBootDialogState();
  deleteBootIgnoreInitialEnter = ignoreInitialEnter;
  deleteBootDialog.hidden = false;
}

function openAuthPasswordDialog(ignoreInitialEnter = false) {
  if (!authPasswordDialog) {
    return;
  }
  resetAuthPasswordDialogState();
  authPasswordIgnoreInitialEnter = ignoreInitialEnter;
  authPasswordDialog.hidden = false;
}

function closeAuthPasswordDialog() {
  if (!authPasswordDialog) {
    return;
  }
  authPasswordDialog.hidden = true;
  resetAuthPasswordDialogState();
  applyKeyboardSelection();
}

function saveUefiPassword() {
  const newPassword = modalInputs[0]?.value || "";
  const confirmPassword = modalInputs[1]?.value || "";
  if (passwordSetupError) {
    passwordSetupError.hidden = true;
  }

  if (!newPassword && !confirmPassword) {
    persistedState.uefiPassword = "";
    saveState();
    return true;
  }

  if (newPassword !== confirmPassword) {
    if (passwordSetupError) {
      passwordSetupError.textContent = "密码不一致。";
      passwordSetupError.hidden = false;
    }
    return false;
  }

  if (newPassword.length < 6 || newPassword.length > 128) {
    if (passwordSetupError) {
      passwordSetupError.textContent = "密码未满足要求。";
      passwordSetupError.hidden = false;
    }
    return false;
  }

  persistedState.uefiPassword = newPassword;
  saveState();
  return true;
}

function submitAuthPassword() {
  if (!authPasswordInput) {
    return false;
  }
  const password = authPasswordInput.value;
  if (password === persistedState.uefiPassword) {
    restrictedMode = false;
    syncRestrictedMode();
    closeAuthPasswordDialog();
    enterUefiFromPreScreen();
    return true;
  }
  if (authPasswordError) {
    authPasswordError.hidden = false;
  }
  return false;
}

function deletePendingBootItem() {
  if (!pendingDeleteBootId || !bootList) {
    return;
  }

  const targetItem = bootList.querySelector(`[data-boot-id="${pendingDeleteBootId}"]`);
  if (!targetItem) {
    return;
  }

  targetItem.remove();
  persistedState.bootDeleted = Array.from(new Set([...(persistedState.bootDeleted || []), pendingDeleteBootId]));
  delete persistedState.bootChecked[pendingDeleteBootId];
  persistBootOrder();
  persistBootChecked();
  resetBootHighlight();
  panelKeyboardIndex.boot = 0;
}

if (passwordDialogOpen && passwordDialog) {
  passwordDialogOpen.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (restrictedMode) {
      return;
    }
    openPasswordDialog(event.detail === 0);
  });
}

if (secureBootDialogOpen && secureBootDialog) {
  secureBootDialogOpen.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (restrictedMode) {
      return;
    }
    openSecureBootDialog(event.detail === 0);
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Home") {
    event.preventDefault();
    resetClientState();
    return;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) {
    enableKeyboardMode();
  }
  if (!getOpenModal()) {
    return;
  }

  if (authPasswordDialog && !authPasswordDialog.hidden) {
    if (event.key === "Escape") {
      event.preventDefault();
      restrictedMode = true;
      syncRestrictedMode();
      closeAuthPasswordDialog();
      enterUefiFromPreScreen();
      return;
    }

    if (authPasswordIgnoreInitialEnter && event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (handleAuthPasswordKeyboardInput(event)) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      syncAuthPasswordActionSelection(activeAuthPasswordActionIndex - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      syncAuthPasswordActionSelection(activeAuthPasswordActionIndex + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (event.repeat || authPasswordEnterPressed || !authPasswordActions[activeAuthPasswordActionIndex]) {
        return;
      }

      authPasswordEnterPressed = true;
      authPasswordActions[activeAuthPasswordActionIndex].classList.add("is-pressed");
    }
    return;
  }

  if (passwordDialog && !passwordDialog.hidden) {
    if (event.key === "Escape") {
      closeModal(passwordDialog);
      return;
    }

    if (modalIgnoreInitialEnter && event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (handleModalKeyboardInput(event)) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      syncModalInputSelection(activeModalInputIndex - 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      syncModalInputSelection(activeModalInputIndex + 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      syncModalActionSelection(activeModalActionIndex - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      syncModalActionSelection(activeModalActionIndex + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (event.repeat || modalEnterPressed || !modalActions[activeModalActionIndex]) {
        return;
      }

      modalEnterPressed = true;
      modalActions[activeModalActionIndex].classList.add("is-pressed");
    }
    return;
  }

  if (secureBootDialog && !secureBootDialog.hidden) {
    if (event.key === "Escape") {
      closeModal(secureBootDialog);
      return;
    }

    if (secureBootIgnoreInitialEnter && event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      syncSecureBootOptionSelection(activeSecureBootOptionIndex - 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      syncSecureBootOptionSelection(activeSecureBootOptionIndex + 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      syncSecureBootActionSelection(activeSecureBootActionIndex - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      syncSecureBootActionSelection(activeSecureBootActionIndex + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (event.repeat || secureBootEnterPressed || !secureBootActions[activeSecureBootActionIndex]) {
        return;
      }

      secureBootEnterPressed = true;
      secureBootActions[activeSecureBootActionIndex].classList.add("is-pressed");
    }
    return;
  }

  if (deleteBootDialog && !deleteBootDialog.hidden) {
    if (event.key === "Escape") {
      closeModal(deleteBootDialog);
      return;
    }

    if (deleteBootIgnoreInitialEnter && event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      syncDeleteBootActionSelection(activeDeleteBootActionIndex - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      syncDeleteBootActionSelection(activeDeleteBootActionIndex + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (event.repeat || deleteBootEnterPressed || !deleteBootActions[activeDeleteBootActionIndex]) {
        return;
      }

      deleteBootEnterPressed = true;
      deleteBootActions[activeDeleteBootActionIndex].classList.add("is-pressed");
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (
    document.body.classList.contains("pre-uefi-active") &&
    !getOpenModal() &&
    (event.key === "Enter" || event.key === " ") &&
    preUefiEnterPressed
  ) {
    event.preventDefault();
    preUefiEnterPressed = false;
    const targetButton = getVisiblePreUefiControls()[activePreUefiActionIndex];
    setPreUefiPressed(targetButton, false);
    targetButton?.click();
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  if (authPasswordDialog && !authPasswordDialog.hidden) {
    if (authPasswordIgnoreInitialEnter) {
      authPasswordIgnoreInitialEnter = false;
      return;
    }

    if (!authPasswordEnterPressed) {
      return;
    }

    authPasswordEnterPressed = false;
    const targetButton = authPasswordActions[activeAuthPasswordActionIndex];
    if (!targetButton) {
      return;
    }

    targetButton.classList.remove("is-pressed");
    targetButton.click();
    return;
  }

  if (passwordDialog && !passwordDialog.hidden) {
    if (modalIgnoreInitialEnter) {
      modalIgnoreInitialEnter = false;
      return;
    }

    if (!modalEnterPressed) {
      return;
    }

    modalEnterPressed = false;
    const targetButton = modalActions[activeModalActionIndex];
    if (!targetButton) {
      return;
    }

    targetButton.classList.remove("is-pressed");
    targetButton.click();
    return;
  }

  if (secureBootDialog && !secureBootDialog.hidden) {
    if (secureBootIgnoreInitialEnter) {
      secureBootIgnoreInitialEnter = false;
      return;
    }

    if (!secureBootEnterPressed) {
      return;
    }

    secureBootEnterPressed = false;
    const targetButton = secureBootActions[activeSecureBootActionIndex];
    if (!targetButton) {
      return;
    }

    targetButton.classList.remove("is-pressed");
    targetButton.click();
    return;
  }

  if (deleteBootDialog && !deleteBootDialog.hidden) {
    if (deleteBootIgnoreInitialEnter) {
      deleteBootIgnoreInitialEnter = false;
      return;
    }

    if (!deleteBootEnterPressed) {
      return;
    }

    deleteBootEnterPressed = false;
    const targetButton = deleteBootActions[activeDeleteBootActionIndex];
    if (!targetButton) {
      return;
    }

    targetButton.classList.remove("is-pressed");
    targetButton.click();
  }
});

modalInputs.forEach((input, index) => {
  input.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    syncModalInputSelection(index);
  });
});

modalActions.forEach((button, index) => {
  button.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    syncModalActionSelection(index);
  });

  button.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    syncModalActionSelection(index);
    button.classList.remove("is-pressed");
    modalEnterPressed = false;
  });
});

secureBootOptions.forEach((option, index) => {
  option.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    pendingSecureBootOptionIndex = index;
    syncSecureBootOptionSelection(index);
  });

  option.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    pendingSecureBootOptionIndex = index;
    syncSecureBootOptionSelection(index);
  });
});

secureBootActions.forEach((button, index) => {
  button.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    syncSecureBootActionSelection(index);
  });

  button.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    syncSecureBootActionSelection(index);
    button.classList.remove("is-pressed");
    secureBootEnterPressed = false;
  });
});

authPasswordActions.forEach((button, index) => {
  button.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    syncAuthPasswordActionSelection(index);
  });

  button.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    syncAuthPasswordActionSelection(index);
    button.classList.remove("is-pressed");
    authPasswordEnterPressed = false;
  });
});

deleteBootActions.forEach((button, index) => {
  button.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    syncDeleteBootActionSelection(index);
  });

  button.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    syncDeleteBootActionSelection(index);
    button.classList.remove("is-pressed");
    deleteBootEnterPressed = false;
  });
});

authPasswordInput?.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }
  if (authPasswordError) {
    authPasswordError.hidden = true;
  }
});

if (modalConfirmButton) {
  modalConfirmButton.addEventListener("click", () => {
    if (saveUefiPassword()) {
      closeModal(passwordDialog);
    }
  });
}

if (modalCancelButton) {
  modalCancelButton.addEventListener("click", () => {
    closeModal(passwordDialog);
  });
}

if (secureBootConfirmButton) {
  secureBootConfirmButton.addEventListener("click", () => {
    persistSecureBootOption();
    closeModal(secureBootDialog);
  });
}

if (secureBootCancelButton) {
  secureBootCancelButton.addEventListener("click", () => {
    closeModal(secureBootDialog);
  });
}

if (deleteBootConfirmButton) {
  deleteBootConfirmButton.addEventListener("click", () => {
    deletePendingBootItem();
    closeModal(deleteBootDialog);
  });
}

if (deleteBootCancelButton) {
  deleteBootCancelButton.addEventListener("click", () => {
    closeModal(deleteBootDialog);
  });
}

if (restartButton) {
  restartButton.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    restartIntoUefi();
  });
}

preUefiActions.forEach((button, index) => {
  button.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    setPreUefiPressed(button, true);
  });

  button.addEventListener("mouseup", (event) => {
    if (event.button !== 0) {
      return;
    }
    setPreUefiPressed(button, false);
  });

  button.addEventListener("mouseleave", () => {
    setPreUefiPressed(button, false);
  });
});

if (enterUefiButton) {
  enterUefiButton.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    if (persistedState.uefiPassword) {
      openAuthPasswordDialog(false);
      return;
    }
    enterUefiFromPreScreen();
  });
}

if (useDeviceButton) {
  useDeviceButton.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    switchPreUefiView("device");
  });
}

if (devicePageBackButton) {
  devicePageBackButton.addEventListener("click", (event) => {
    if (event.button !== 0 && event.detail !== 0) {
      return;
    }
    switchPreUefiView("main");
  });
}

if (authPasswordConfirmButton) {
  authPasswordConfirmButton.addEventListener("click", () => {
    submitAuthPassword();
  });
}

if (authPasswordCancelButton) {
  authPasswordCancelButton.addEventListener("click", () => {
    restrictedMode = true;
    syncRestrictedMode();
    closeAuthPasswordDialog();
    enterUefiFromPreScreen();
  });
}
