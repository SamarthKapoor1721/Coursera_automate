const MUTE_ABOVE = 4;
const PRESETS = [1, 1.5, 2, 3, 4, 6, 8, 10, 16];
const SEEK_PRESETS = [10, 25, 50, 75, 93];
const STORAGE_KEY = "csb_speed";
const POS_KEY = "csb_overlay_pos";
const AUTO_ADVANCE_KEY = "csb_auto_advance";
const SEEK_PERCENT_KEY = "csb_seek_percent";

let currentSpeed = 1;
let autoAdvance = false;
let overlayClosed = false;
let savedSeekPercent = null;
let seekAppliedForVideo = new WeakSet();
let handledReadingUrls = new Set();
let isAdvancing = false;
let readingCheckTimer = null;

function applyToVideo(video) {
  if (!video || video.readyState < 1) return;
  try {
    if (video.playbackRate !== currentSpeed) video.playbackRate = currentSpeed;
    video.muted = currentSpeed > MUTE_ABOVE;
    video.defaultPlaybackRate = currentSpeed;
  } catch (err) {
    // Coursera's player may briefly own the video element during init; ignore transient failures.
  }

  if (
    savedSeekPercent !== null &&
    !seekAppliedForVideo.has(video) &&
    video.duration &&
    isFinite(video.duration)
  ) {
    seekAppliedForVideo.add(video);
    try {
      video.currentTime = video.duration * (savedSeekPercent / 100);
    } catch (err) {
      // ignore transient failures during player init
    }
  }
}

function applyToAllVideos() {
  document.querySelectorAll("video").forEach(applyToVideo);
}

function observeVideos() {
  const observer = new MutationObserver(() => {
    applyToAllVideos();
    checkReadingAutoAdvance();
  });
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

function seekToPercent(percent, persist = true) {
  document.querySelectorAll("video").forEach((video) => {
    if (video.readyState < 1 || !video.duration || !isFinite(video.duration)) return;
    try {
      video.currentTime = video.duration * (percent / 100);
      seekAppliedForVideo.add(video);
    } catch (err) {
      // ignore transient failures during player init
    }
  });
  if (persist) {
    savedSeekPercent = percent;
    chrome.storage.sync.set({ [SEEK_PERCENT_KEY]: percent });
  }
}

function isElementVisible(el) {
  if (!el) return false;
  if (el.closest && el.closest("#csb-overlay")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return (rect.width > 0 && rect.height > 0) || el.offsetParent !== null;
}

function findMarkCompleteButton() {
  // 1. Selector-based lookup for "Mark as completed"
  const selectors = [
    '[data-testid="mark-complete"]',
    '[data-testid="mark-as-completed-button"]',
    '[data-testid="mark-complete-button"]',
    '[data-testid="mark-as-completed"]',
    'button[aria-label*="mark as complete" i]',
    'button[aria-label*="mark as completed" i]',
    'button[aria-label*="mark completed" i]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && isElementVisible(el) && !el.disabled) {
      return el;
    }
  }

  // 2. Text-based lookup across all clickable elements
  const candidates = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
  for (const el of candidates) {
    if (!isElementVisible(el) || el.disabled) continue;
    const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
    if (
      txt === "mark as completed" ||
      txt === "mark as complete" ||
      txt === "mark completed" ||
      txt === "mark complete" ||
      txt === "i'm done reading" ||
      txt === "mark as done" ||
      txt === "mark done" ||
      txt.startsWith("mark as complete") ||
      txt.startsWith("mark as completed")
    ) {
      return el;
    }
  }
  return null;
}

function findNextButton() {
  // 1. Selector lookup for Coursera next item buttons
  const selectors = [
    '[data-testid="next-item"]',
    '[data-testid="next-item-button"]',
    '[data-testid="item-next-button"]',
    '[data-testid="navigation-next-item"]',
    '[data-testid="cml-viewer-next-item-button"]',
    'button[aria-label*="go to next item" i]',
    'a[aria-label*="go to next item" i]',
    'button[aria-label*="next item" i]',
    'a[aria-label*="next item" i]'
  ];
  for (const sel of selectors) {
    const matches = document.querySelectorAll(sel);
    for (const el of matches) {
      if (isElementVisible(el) && !el.disabled) {
        return el;
      }
    }
  }

  // 2. Exact or prefix text matches: "Go to next item" or "Next item"
  const candidates = document.querySelectorAll('button, a, [role="button"]');
  for (const el of candidates) {
    if (!isElementVisible(el) || el.disabled) continue;
    const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
    if (
      txt === "go to next item" ||
      txt.startsWith("go to next item") ||
      txt === "next item" ||
      txt.startsWith("next item") ||
      txt === "next module" ||
      txt === "next lesson"
    ) {
      return el;
    }
  }

  // 3. Aria-label containing "next"
  for (const el of candidates) {
    if (!isElementVisible(el) || el.disabled) continue;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    if (aria.includes("next item") || aria.includes("go to next item") || aria === "next") {
      return el;
    }
  }

  // 4. Exact text matches like "Next", "Next →", "Next >"
  for (const el of candidates) {
    if (!isElementVisible(el) || el.disabled) continue;
    const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
    if (txt === "next" || txt === "next →" || txt === "next >" || txt.startsWith("next ")) {
      return el;
    }
  }

  return null;
}

function goToNextItem(onDone) {
  if (isAdvancing) return;
  isAdvancing = true;

  const markBtn = findMarkCompleteButton();
  if (markBtn) {
    try {
      markBtn.click();
    } catch (e) {
      console.warn("CSB: Could not click mark as complete button:", e);
    }
  }

  setTimeout(() => {
    const nextBtn = findNextButton();
    if (nextBtn) {
      try {
        nextBtn.click();
      } catch (e) {
        console.warn("CSB: Could not click next item button:", e);
      }
    }
    setTimeout(() => {
      isAdvancing = false;
      if (typeof onDone === "function") onDone();
    }, 400);
  }, markBtn ? 350 : 50);
}

function checkReadingAutoAdvance() {
  if (!autoAdvance) return;
  
  // If there's an active video on page, let video handler handle it
  if (document.querySelector("video")) return;

  const currentUrl = location.href;
  if (handledReadingUrls.has(currentUrl)) return;

  const markBtn = findMarkCompleteButton();
  const nextBtn = findNextButton();

  if (markBtn || nextBtn) {
    handledReadingUrls.add(currentUrl);
    if (handledReadingUrls.size > 50) {
      const first = handledReadingUrls.values().next().value;
      handledReadingUrls.delete(first);
    }

    // Schedule auto-advance with a brief delay so Coursera registers the read
    if (readingCheckTimer) clearTimeout(readingCheckTimer);
    readingCheckTimer = setTimeout(() => {
      goToNextItem();
    }, 800);
  }
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
  if (value) {
    checkReadingAutoAdvance();
  }
}

chrome.storage.sync.get([STORAGE_KEY, AUTO_ADVANCE_KEY, SEEK_PERCENT_KEY], (result) => {
  currentSpeed = result[STORAGE_KEY] || 1;
  autoAdvance = Boolean(result[AUTO_ADVANCE_KEY]);
  savedSeekPercent = typeof result[SEEK_PERCENT_KEY] === "number" ? result[SEEK_PERCENT_KEY] : null;
  applyToAllVideos();
  observeVideos();
  observeVideoEnd();
  checkReadingAutoAdvance();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    currentSpeed = changes[STORAGE_KEY].newValue;
    applyToAllVideos();
  }
  if (changes[AUTO_ADVANCE_KEY]) {
    autoAdvance = Boolean(changes[AUTO_ADVANCE_KEY].newValue);
    const chk = document.getElementById("csb-advance-chk");
    if (chk) chk.checked = autoAdvance;
    if (autoAdvance) checkReadingAutoAdvance();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "cycle-speed") {
    const idx = PRESETS.indexOf(currentSpeed);
    const next = PRESETS[(idx + 1) % PRESETS.length];
    setSpeed(next);
  }
  if (msg.type === "seek-percent") {
    seekToPercent(msg.percent);
  }
  if (msg.type === "next-item") {
    goToNextItem();
    sendResponse({ success: true });
  }
});

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
    transition: background 0.15s ease, border-color 0.15s ease;
  `;
}

function buildOverlay() {
  if (document.getElementById("csb-overlay")) return;

  const box = document.createElement("div");
  box.id = "csb-overlay";
  box.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 2147483647;
    background: rgba(20, 20, 20, 0.94);
    backdrop-filter: blur(8px);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    border-radius: 10px;
    padding: 12px;
    width: 210px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.45);
    user-select: none;
    border: 1px solid rgba(255,255,255,0.12);
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
  handle.textContent = "⠿ Coursera Skippy";
  handle.style.cssText = `cursor: move; font-weight: 600; font-size: 12px; letter-spacing: 0.2px;`;
  header.appendChild(handle);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.title = "Close";
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #bbb;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 0 0 0 8px;
  `;
  closeBtn.addEventListener("mouseenter", () => (closeBtn.style.color = "#fff"));
  closeBtn.addEventListener("mouseleave", () => (closeBtn.style.color = "#bbb"));
  closeBtn.addEventListener("click", () => {
    overlayClosed = true;
    box.remove();
  });
  header.appendChild(closeBtn);

  box.appendChild(header);

  // Speed controls
  const speedLabel = document.createElement("div");
  speedLabel.textContent = "Speed";
  speedLabel.style.cssText = "font-weight: 600; margin: 4px 0 4px; color: #ccc;";
  box.appendChild(speedLabel);

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

  // Seek controls
  const seekLabel = document.createElement("div");
  seekLabel.textContent = "Seek";
  seekLabel.style.cssText = "font-weight: 600; margin: 6px 0 4px; color: #ccc;";
  box.appendChild(seekLabel);

  const seekRow = document.createElement("div");
  seekRow.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;";
  SEEK_PRESETS.forEach((percent) => {
    const btn = document.createElement("button");
    btn.textContent = `${percent}%`;
    btn.dataset.percent = percent;
    btn.style.cssText = btnStyle();
    btn.addEventListener("click", () => {
      seekToPercent(percent);
      refreshSeekActive();
    });
    seekRow.appendChild(btn);
  });
  box.appendChild(seekRow);

  // Quick Action: Next Item Button
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "⏭ Next Item (Skip)";
  nextBtn.title = "Mark complete & advance to next item";
  nextBtn.style.cssText = `
    width: 100%;
    padding: 7px 0;
    margin-top: 4px;
    margin-bottom: 8px;
    border: none;
    border-radius: 6px;
    background: #0056d2;
    color: #fff;
    font-weight: 600;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s ease;
  `;
  nextBtn.addEventListener("mouseenter", () => (nextBtn.style.background = "#00419e"));
  nextBtn.addEventListener("mouseleave", () => (nextBtn.style.background = "#0056d2"));
  nextBtn.addEventListener("click", () => {
    goToNextItem();
  });
  box.appendChild(nextBtn);

  // Auto-advance Checkbox
  const advanceRow = document.createElement("label");
  advanceRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    cursor: pointer;
    font-size: 11px;
    color: #ddd;
  `;
  const advanceCheckbox = document.createElement("input");
  advanceCheckbox.id = "csb-advance-chk";
  advanceCheckbox.type = "checkbox";
  advanceCheckbox.checked = autoAdvance;
  advanceCheckbox.addEventListener("change", () => {
    setAutoAdvance(advanceCheckbox.checked);
  });
  advanceRow.appendChild(advanceCheckbox);
  advanceRow.appendChild(document.createTextNode("Auto-advance (Videos & Readings)"));
  box.appendChild(advanceRow);

  document.documentElement.appendChild(box);

  function refreshActive() {
    speedRow.querySelectorAll("button").forEach((btn) => {
      const active = Number(btn.dataset.speed) === currentSpeed;
      btn.style.background = active ? "#0056d2" : "rgba(255,255,255,0.08)";
      btn.style.borderColor = active ? "#0056d2" : "rgba(255,255,255,0.2)";
    });
  }
  function refreshSeekActive() {
    seekRow.querySelectorAll("button").forEach((btn) => {
      const active = Number(btn.dataset.percent) === savedSeekPercent;
      btn.style.background = active ? "#0056d2" : "rgba(255,255,255,0.08)";
      btn.style.borderColor = active ? "#0056d2" : "rgba(255,255,255,0.2)";
    });
  }
  refreshActive();
  refreshSeekActive();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) refreshActive();
    if (changes[SEEK_PERCENT_KEY]) refreshSeekActive();
  });

  makeDraggable(box, handle);
  restorePosition(box);
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
    checkReadingAutoAdvance();
  }
  if (overlayClosed) return;
  // Show overlay across all Coursera course/learn pages
  if (location.hostname.includes("coursera.org")) {
    buildOverlay();
  }
}

ensureOverlay();
new MutationObserver(ensureOverlay).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
