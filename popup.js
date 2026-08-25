const PRESETS = [1, 1.5, 2, 3, 4, 6, 8, 10, 16];
const SEEK_PRESETS = [10, 25, 50, 75, 93];
const STORAGE_KEY = "csb_speed";
const AUTO_ADVANCE_KEY = "csb_auto_advance";

const slider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const presetsEl = document.getElementById("presets");
const seekPresetsEl = document.getElementById("seekPresets");
const nextItemBtn = document.getElementById("nextItemBtn");
const autoAdvanceCheckbox = document.getElementById("autoAdvanceCheckbox");

function render(speed) {
  slider.value = speed;
  speedValue.textContent = `${speed}x`;
  presetsEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.speed) === speed);
  });
}

function setSpeed(speed) {
  chrome.storage.sync.set({ [STORAGE_KEY]: speed });
  render(speed);
}

PRESETS.forEach((speed) => {
  const btn = document.createElement("button");
  btn.className = "preset-btn";
  btn.textContent = `${speed}x`;
  btn.dataset.speed = speed;
  btn.addEventListener("click", () => setSpeed(speed));
  presetsEl.appendChild(btn);
});

slider.addEventListener("input", () => setSpeed(Number(slider.value)));

SEEK_PRESETS.forEach((percent) => {
  const btn = document.createElement("button");
  btn.className = "preset-btn";
  btn.textContent = `${percent}%`;
  btn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "seek-percent", percent }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  });
  seekPresetsEl.appendChild(btn);
});

nextItemBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "next-item" }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
});

autoAdvanceCheckbox.addEventListener("change", () => {
  chrome.storage.sync.set({ [AUTO_ADVANCE_KEY]: autoAdvanceCheckbox.checked });
});

chrome.storage.sync.get([STORAGE_KEY, AUTO_ADVANCE_KEY], (result) => {
  render(result[STORAGE_KEY] || 1);
  autoAdvanceCheckbox.checked = Boolean(result[AUTO_ADVANCE_KEY]);
});
