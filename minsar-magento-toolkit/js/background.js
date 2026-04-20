// Minsar — Background Service Worker
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  switch (command) {
    case 'omni-search':
      chrome.tabs.sendMessage(tab.id, { action: 'open-omni-search' });
      break;
    case 'flush-cache':
      chrome.tabs.sendMessage(tab.id, { action: 'flush-all' });
      break;
    case 'toggle-dark':
      chrome.tabs.sendMessage(tab.id, { action: 'toggle-dark' });
      break;
  }
});
