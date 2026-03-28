const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

const stage = document.getElementById("stage");
const sidebarItems = document.querySelectorAll(".sidebar-item");
const panels = document.querySelectorAll(".panel");
const toggleButtons = document.querySelectorAll(".toggle-button");
const bootToggleButtons = document.querySelectorAll(".boot-toggle");
const bootItems = document.querySelectorAll(".boot-item");
const bootChecks = document.querySelectorAll(".boot-check");
const bootFlashGroups = Array.from(document.querySelectorAll('[data-panel-content="boot"] .boot-flash-group'));
const panelArea = document.querySelector(".panel-area");
const bootList = document.querySelector(".boot-list");

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

function setBootHighlight(targetItem) {
  bootItems.forEach((item) => item.classList.remove("active"));
  if (targetItem) {
    targetItem.classList.add("active");
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

function flashBootDirtyRegion(options = {}) {
  const { resetHighlight = false } = options;

  if (bootFlashGroups.length === 0) {
    return;
  }

  const shouldFlash = Math.random() >= 0.35;
  if (!shouldFlash) {
    if (resetHighlight) {
      window.setTimeout(() => {
        resetBootHighlight();
      }, 10);
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
  const flashWholePanel = Math.random() >= 0.5;

  if (flashWholePanel) {
    flashWholePanelWithDelayedElement(options);
  } else {
    flashRandomSingleBootElement(options);
  }
}

resizeStage();
window.addEventListener("resize", resizeStage);

sidebarItems.forEach((item) => {
  item.addEventListener("click", () => {
    sidebarItems.forEach((button) => button.classList.remove("active"));
    item.classList.add("active");

    const targetPanel = item.dataset.panel;
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panelContent === targetPanel);
    });

    if (targetPanel === "boot") {
      resetBootHighlight();
    }
  });
});

toggleButtons.forEach((button) => {
  if (button.classList.contains("boot-toggle")) {
    return;
  }

  button.addEventListener("click", () => {
    const isOff = button.classList.toggle("off");
    button.setAttribute("aria-label", isOff ? "TPM 已关闭" : "TPM 已开启");
  });
});

bootToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const isOff = button.classList.toggle("off");
    const labelMap = {
      "备用启动顺序已关闭": "备用启动顺序已开启",
      "PXE 网络启动 IPv6 已关闭": "PXE 网络启动 IPv6 已开启",
      "从 USB 设备启动已开启": "从 USB 设备启动已关闭",
      "启动配置锁已关闭": "启动配置锁已开启",
      "电池限制已关闭": "电池限制已开启"
    };
    const current = button.getAttribute("aria-label") || "";
    const next = isOff
      ? current.replace("已开启", "已关闭")
      : (labelMap[current] || current.replace("已关闭", "已开启"));
    button.setAttribute("aria-label", next);
    flashBootToggleResult();
  });
});

bootItems.forEach((item) => {
  item.addEventListener("mousedown", () => {
    item.dataset.wasActive = item.classList.contains("active") ? "true" : "false";
    setBootHighlight(item);
    dragCandidateItem = item;
  });

  item.addEventListener("click", () => {
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
    flashBootDirtyRegion({ resetHighlight: true });
  }

  dragCandidateItem = null;
  draggedBootItem = null;
  dragHoverItem = null;
});

window.addEventListener("mousedown", (event) => {
  dragStartX = event.clientX;
  dragStartY = event.clientY;
});

bootChecks.forEach((check) => {
  check.addEventListener("click", (event) => {
    event.stopPropagation();
    const targetItem = check.closest(".boot-item");
    setBootHighlight(targetItem);
    check.classList.toggle("checked");
    flashBootDirtyRegion({ resetHighlight: true });
  });
});
