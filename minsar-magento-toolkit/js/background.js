/**
 * Minsar — Magento Admin Toolkit
 * Background Service Worker
 *
 * Handles keyboard shortcut commands registered in manifest.json
 * and forwards them as messages to the content script (detector.js).
 *
 * Shortcuts:
 *   Ctrl+Shift+K → Open Omni-Search overlay
 *   Ctrl+Shift+C → Flush all Magento caches
 *   Ctrl+Shift+D → Toggle dark mode
 */
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
