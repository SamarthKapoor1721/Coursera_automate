const MUTE_ABOVE = 4;
const PRESETS = [1, 1.5, 2, 3, 4, 6, 8, 10, 16];
const SEEK_PRESETS = [10, 25, 50, 75];
const STORAGE_KEY = "csb_speed";
const POS_KEY = "csb_overlay_pos";
const AUTO_ADVANCE_KEY = "csb_auto_advance";

let currentSpeed = 1;
let autoAdvance = false;
let overlayClosed = false;

function applyToVideo(video) {
  if (!video || video.readyState < 1) return;
  try {
    if (video.playbackRate !== currentSpeed) video.playbackRate = currentSpeed;
    video.muted = currentSpeed > MUTE_ABOVE;
    video.defaultPlaybackRate = currentSpeed;
  } catch (err) {
    // Coursera's player may briefly own the video element during init; ignore transient failures.
  }
}

function applyToAllVideos() {
  document.querySelectorAll("video").forEach(applyToVideo);
}

function observeVideos() {
  const observer = new MutationObserver(() => applyToAllVideos());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener(
    "loadedmetadata",
    (e) => {
      if (e.target instanceof HTMLVideoElement) applyToVideo(e.target);
    },
    true
  );

  document.addEventListener(
    "ratechange",
    (e) => {
      const v = e.target;
      if (v instanceof HTMLVideoElement && v.playbackRate !== currentSpeed) {
        v.playbackRate = currentSpeed;
      }
    },
    true
  );
}

function setSpeed(speed) {
  currentSpeed = speed;
  chrome.storage.sync.set({ [STORAGE_KEY]: speed });
  applyToAllVideos();
}

chrome.storage.sync.get([STORAGE_KEY, AUTO_ADVANCE_KEY], (result) => {
  currentSpeed = result[STORAGE_KEY] || 1;
  autoAdvance = Boolean(result[AUTO_ADVANCE_KEY]);
  applyToAllVideos();
  observeVideos();
  observeVideoEnd();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    currentSpeed = changes[STORAGE_KEY].newValue;
    applyToAllVideos();
  }
});

function seekToPercent(percent) {
  document.querySelectorAll("video").forEach((video) => {
    if (video.readyState < 1 || !video.duration || !isFinite(video.duration)) return;
    try {
      video.currentTime = video.duration * (percent / 100);
    } catch (err) {
      // ignore transient failures during player init
    }
  });
}

function findNextButton() {
  const candidates = document.querySelectorAll(
    'a[data-testid="rc-WeekItemNext"], a[aria-label*="Next" i], button[aria-label*="Next" i]'
  );
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return null;
}

function goToNextItem() {
  const btn = findNextButton();
  if (btn) btn.click();
}

function observeVideoEnd() {
  document.addEventListener(
    "ended",
    (e) => {
      if (e.target instanceof HTMLVideoElement && autoAdvance) {
        goToNextItem();
      }
    },
    true
  );
}

function setAutoAdvance(value) {
  autoAdvance = value;
  chrome.storage.sync.set({ [AUTO_ADVANCE_KEY]: value });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "cycle-speed") {
    const idx = PRESETS.indexOf(currentSpeed);
    const next = PRESETS[(idx + 1) % PRESETS.length];
    setSpeed(next);
  }
  if (msg.type === "seek-percent") {
    seekToPercent(msg.percent);
  }
});

function buildOverlay() {
  if (document.getElementById("csb-overlay")) return;

  const box = document.createElement("div");
  box.id = "csb-overlay";
  box.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 2147483647;
    background: rgba(20, 20, 20, 0.92);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    border-radius: 10px;
    padding: 10px;
    width: 200px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    user-select: none;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
  `;

  const handle = document.createElement("div");
  handle.textContent = "⠿ Coursera Speed Boost";
  handle.style.cssText = `cursor: move; font-weight: 600;`;
  header.appendChild(handle);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.title = "Close";
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #fff;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 0 0 8px;
  `;
  closeBtn.addEventListener("click", () => {
    overlayClosed = true;
    box.remove();
  });
  header.appendChild(closeBtn);

  box.appendChild(header);

  const speedRow = document.createElement("div");
  speedRow.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;";
  PRESETS.forEach((speed) => {
    const btn = document.createElement("button");
    btn.textContent = `${speed}x`;
    btn.dataset.speed = speed;
    btn.style.cssText = btnStyle();
    btn.addEventListener("click", () => {
      setSpeed(speed);
      refreshActive();
    });
    speedRow.appendChild(btn);
  });
  box.appendChild(speedRow);

  const seekLabel = document.createElement("div");
  seekLabel.textContent = "Seek";
  seekLabel.style.cssText = "font-weight: 600; margin: 6px 0 4px;";
  box.appendChild(seekLabel);

  const seekRow = document.createElement("div");
  seekRow.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px;";
  SEEK_PRESETS.forEach((percent) => {
    const btn = document.createElement("button");
    btn.textContent = `${percent}%`;
    btn.style.cssText = btnStyle();
    btn.addEventListener("click", () => seekToPercent(percent));
    seekRow.appendChild(btn);
  });
  box.appendChild(seekRow);

  const advanceRow = document.createElement("label");
  advanceRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    cursor: pointer;
  `;
  const advanceCheckbox = document.createElement("input");
  advanceCheckbox.type = "checkbox";
  advanceCheckbox.checked = autoAdvance;
  advanceCheckbox.addEventListener("change", () => {
    setAutoAdvance(advanceCheckbox.checked);
  });
  advanceRow.appendChild(advanceCheckbox);
  advanceRow.appendChild(document.createTextNode("Auto-advance to next item"));
  box.appendChild(advanceRow);

  document.documentElement.appendChild(box);

  function refreshActive() {
    speedRow.querySelectorAll("button").forEach((btn) => {
      const active = Number(btn.dataset.speed) === currentSpeed;
      btn.style.background = active ? "#0056d2" : "rgba(255,255,255,0.08)";
      btn.style.borderColor = active ? "#0056d2" : "rgba(255,255,255,0.2)";
    });
  }
  refreshActive();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) refreshActive();
  });

  makeDraggable(box, handle);
  restorePosition(box);
}

function btnStyle() {
  return `
    flex: 1 0 calc(25% - 4px);
    padding: 5px 0;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 5px;
    background: rgba(255,255,255,0.08);
    color: #fff;
    cursor: pointer;
    font-size: 11px;
  `;
}

function makeDraggable(box, handle) {
  let dragging = false;
  let startX, startY, startTop, startLeft;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = box.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startTop = rect.top;
    startLeft = rect.left;
    box.style.right = "auto";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const newTop = startTop + (e.clientY - startY);
    const newLeft = startLeft + (e.clientX - startX);
    box.style.top = `${newTop}px`;
    box.style.left = `${newLeft}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    chrome.storage.sync.set({
      [POS_KEY]: { top: box.style.top, left: box.style.left },
    });
  });
}

function restorePosition(box) {
  chrome.storage.sync.get([POS_KEY], (result) => {
    const pos = result[POS_KEY];
    if (pos && pos.top && pos.left) {
      box.style.top = pos.top;
      box.style.left = pos.left;
      box.style.right = "auto";
    }
  });
}

let lastUrl = location.href;

function ensureOverlay() {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    overlayClosed = false;
  }
  if (overlayClosed) return;
  if (document.querySelector("video")) buildOverlay();
}

ensureOverlay();
new MutationObserver(ensureOverlay).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
