const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

const stage = document.getElementById("stage");
const sidebarItems = document.querySelectorAll(".sidebar-item");
const panels = document.querySelectorAll(".panel");
const toggleButtons = document.querySelectorAll(".toggle-button");
const bootItems = document.querySelectorAll(".boot-item");
const bootChecks = document.querySelectorAll(".boot-check");
const bootList = document.querySelector(".boot-list");

function resizeStage() {
  const scale = Math.min(
    window.innerWidth / DESIGN_WIDTH,
    window.innerHeight / DESIGN_HEIGHT
  );
  const offsetX = (window.innerWidth - DESIGN_WIDTH * scale) / 2;
  const offsetY = (window.innerHeight - DESIGN_HEIGHT * scale) / 2;

  stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

function flashBootList() {
  if (!bootList) {
    return;
  }

  const shouldFlash = Math.random() >= 0.5;
  if (!shouldFlash) {
    return;
  }

  bootList.classList.add("flashing");
  window.setTimeout(() => {
    bootList.classList.remove("flashing");
  }, 10);
}

function resetBootHighlight() {
  if (bootItems.length === 0) {
    return;
  }

  bootItems.forEach((item) => item.classList.remove("active"));
  bootItems[0].classList.add("active");
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
  button.addEventListener("click", () => {
    const isOff = button.classList.toggle("off");
    button.setAttribute("aria-label", isOff ? "TPM 已关闭" : "TPM 已开启");
  });
});

bootItems.forEach((item) => {
  item.addEventListener("click", () => {
    bootItems.forEach((button) => button.classList.remove("active"));
    item.classList.add("active");
    flashBootList();
  });
});

bootChecks.forEach((check) => {
  check.addEventListener("click", (event) => {
    event.stopPropagation();
    check.classList.toggle("checked");
    resetBootHighlight();
    flashBootList();
  });
});
