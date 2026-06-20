async function getState() {
  return chrome.storage.session.get({ gameTabId: null });
}

// Force-inject remote-overlay.js into every open http/https tab except the chess.com tab.
async function injectIntoAllTabs() {
  const { gameTabId } = await getState();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (!tab.url.startsWith('http')) continue;
    if (tab.id === gameTabId) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['remote-overlay.js'] });
    } catch {}
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ gameTabId: sender.tab?.id ?? null });
    chrome.storage.local.set({ showRemoteOverlay: true });
    injectIntoAllTabs();

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.local.set({ showRemoteOverlay: false });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await getState();
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ gameTabId: null });
  chrome.storage.local.set({ showRemoteOverlay: false });
});
