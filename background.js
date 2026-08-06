chrome.commands.onCommand.addListener((command) => {
  if (command === "cycle-speed") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "cycle-speed" });
      }
    });
  }
});
