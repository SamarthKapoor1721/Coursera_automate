# ⏩ Coursera Skippy

**Coursera Skippy** is a powerful Chrome Extension (Manifest V3) designed to optimize and accelerate your Coursera learning workflow. It enables high-speed video playback (up to 16x), one-click seeking, automatic marking of reading materials as completed, auto-advancing to the next course item, and intuitive floating overlay controls.

---

## ✨ Key Features

### ⚡ 1. Ultra-Fast Playback Speed (Up to 16x)
- Play Coursera lecture videos at speeds far beyond default limits: **1x, 1.5x, 2x, 3x, 4x, 6x, 8x, 10x, and 16x**.
- **Smart Auto-Mute**: Automatically mutes audio when playing above 4x speed (since human speech becomes unintelligible past that point).
- Continuously maintains playback speed across dynamic video loads and SPA transitions.

### 🎯 2. Quick Video Seeking
- Jump directly to key progress milestones: **10%, 25%, 50%, 75%, or 93%** of video duration.
- Remembers and applies your preferred seek percentage automatically when new videos load.

### 📖 3. Automated Reading & Item Skipping
- Automatically detects and clicks Coursera's **"Mark as completed"** / **"Mark as complete"** button on reading and supplement pages.
- Automatically clicks **"Go to next item"** / **"Next item"** buttons when auto-advance is enabled.
- Built-in debounce & safety delay (~800ms) to ensure Coursera registers completion before navigation.
- Anti-loop protection to prevent repetitive clicking during network latency.

### 🎛️ 4. Draggable Floating On-Screen Widget
- Sleek, dark-mode glassmorphic overlay widget right on Coursera pages.
- Draggable anywhere on the screen (remembers its position across page navigations).
- Quick access to all speed presets, seek percentages, manual **"⏭ Next Item"** skip button, and the Auto-advance toggle.

### ⌨️ 5. Keyboard Shortcuts
| Shortcut (Windows / Linux) | Shortcut (macOS) | Action |
| :--- | :--- | :--- |
| `Alt + S` | `Command + Shift + S` | Cycle to the next playback speed preset |
| `Alt + N` | `Command + Shift + N` | Mark complete & advance to next item |

---

## 📁 Project Structure

```
├── manifest.json       # Manifest V3 extension configuration & permissions
├── background.js       # Background service worker handling keyboard shortcut commands
├── content.js          # Injected script managing video speed, DOM button detection & overlay
├── popup.html          # Extension popup UI (speed slider, presets, seek, auto-advance)
├── popup.js            # Popup logic and sync with chrome.storage
├── icons/              # Extension icons (16x16, 48x48, 128x128)
└── README.md           # Documentation and setup instructions
```

---

## 🚀 Installation Guide

1. **Clone or Download this Repository**:
   ```bash
   git clone https://github.com/SamarthKapoor1721/Coursera_automate.git
   ```
   *(Or keep your local project folder)*

2. **Open Google Chrome**:
   - Navigate to `chrome://extensions` in the address bar.

3. **Enable Developer Mode**:
   - Toggle the switch labeled **Developer mode** in the top right corner.

4. **Load the Extension**:
   - Click the **Load unpacked** button in the top left corner.
   - Select the `Coursera skippy` directory containing `manifest.json`.

5. **Start Learning**:
   - Navigate to any [Coursera](https://www.coursera.org/) course page.
   - The floating widget will appear on the top right.

---

## 💡 How It Works Under the Hood

1. **Content Script (`content.js`)**:
   - Monitors the DOM using a `MutationObserver` to attach to `<video>` elements as they load.
   - Enforces desired `playbackRate` and audio muting rules.
   - Inspects the DOM for navigation and completion elements (`data-testid="mark-complete"`, `data-testid="next-item"`, aria-labels, button text).
   - Manages the floating draggable UI and listens for storage / message events.

2. **Storage Synchronization (`chrome.storage.sync`)**:
   - Preferences (`csb_speed`, `csb_auto_advance`, `csb_seek_percent`, `csb_overlay_pos`) are synced in real-time between the on-screen overlay, the browser action popup, and across tab navigations.

3. **Service Worker (`background.js`)**:
   - Catches browser commands (`cycle-speed`, `next-item`) and dispatches messages to the active Coursera tab.

---

## ⚙️ Configuration & Options

- **Auto-advance (Videos & Readings)**: When checked, the extension will automatically proceed to the next item once a video ends, or mark reading pages completed and jump to the next module/lesson.
- **Manual Skip**: Use the **"⏭ Next Item (Skip)"** button on either the floating overlay or the extension popup to instantly trigger completion and navigation.

---

## 🛠️ Troubleshooting

- **Extension not updating after changes**: Go to `chrome://extensions` and click the reload icon (🔄) on the Coursera Skippy card, then refresh the Coursera tab.
- **Overlay disappeared**: If closed via the `×` button, it will automatically reappear when navigating to a new item/URL, or you can control settings via the extension popup icon in the browser toolbar.
