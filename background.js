chrome.commands.onCommand.addListener(async (command) => {
  if (command === "cycle-speed" || command === "next-item") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: command }, () => {
        void chrome.runtime.lastError;
      });
    }
  }
});
