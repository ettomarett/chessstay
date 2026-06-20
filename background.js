chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ gameTabId: sender.tab?.id ?? null });

    // Notify only when the game tab isn't the active tab.
    chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
      if (activeTab?.id !== sender.tab?.id) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Your turn!',
          message: "It's your move on chess.com",
          priority: 2,
        });
      }
    });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ gameTabId: null });
  }
});

// Clean up if the chess.com tab is closed while it's still the user's turn.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await chrome.storage.session.get({ gameTabId: null });
  if (tabId === gameTabId) {
    chrome.storage.session.set({ gameTabId: null });
  }
});
