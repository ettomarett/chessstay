async function getState() {
  return chrome.storage.session.get({ isMyTurn: false, gameTabId: null, overlayTabId: null });
}

async function showOverlay(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY' });
  } catch {
    // Content script not present — tab was open before extension loaded.
    // Inject the file, then send the message.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['remote-overlay.js'] });
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY' });
    } catch { return; }
  }
  await chrome.storage.session.set({ overlayTabId: tabId });
}

async function hideOverlay() {
  const { overlayTabId } = await getState();
  if (!overlayTabId) return;
  try { await chrome.tabs.sendMessage(overlayTabId, { type: 'HIDE_OVERLAY' }); } catch {}
  await chrome.storage.session.set({ overlayTabId: null });
}

// ── Messages from chess.com content script ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id ?? null;

  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ isMyTurn: true, gameTabId: tabId });
    chrome.tabs.query({ active: true, currentWindow: true }, ([active]) => {
      if (active && active.id !== tabId) showOverlay(active.id);
    });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false });
    hideOverlay();
  }
});

// ── Tab switching ─────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;
  if (tabId === gameTabId) {
    hideOverlay();
  } else {
    await hideOverlay();
    showOverlay(tabId);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!active) return;
  if (active.id === gameTabId) {
    hideOverlay();
  } else {
    await hideOverlay();
    showOverlay(active.id);
  }
});

// ── Tab close ─────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await getState();
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  hideOverlay();
});
