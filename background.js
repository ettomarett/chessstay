chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ gameTabId: sender.tab?.id ?? null });
    chrome.storage.local.set({ showRemoteOverlay: true });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.local.set({ showRemoteOverlay: false });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await chrome.storage.session.get({ gameTabId: null });
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ gameTabId: null });
  chrome.storage.local.set({ showRemoteOverlay: false });
});
