// State persisted in session storage so it survives service-worker sleep cycles.
async function getState() {
  return chrome.storage.session.get({ alertWindowId: null, isMyTurn: false, gameTabId: null });
}

async function openPopup() {
  const { alertWindowId } = await getState();
  if (alertWindowId !== null) {
    try { await chrome.windows.update(alertWindowId, { drawAttention: true }); return; }
    catch { await chrome.storage.session.set({ alertWindowId: null }); }
  }
  const { popupTop, popupLeft } = await chrome.storage.local.get({ popupTop: 80, popupLeft: 80 });
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('alert.html'),
    type: 'popup',
    width: 220,
    height: 130,
    focused: false, // appears on screen without stealing keyboard focus
    top: popupTop,
    left: popupLeft,
  });
  await chrome.storage.session.set({ alertWindowId: win.id });
}

async function closePopup() {
  const { alertWindowId } = await getState();
  if (alertWindowId === null) return;
  try {
    const win = await chrome.windows.get(alertWindowId);
    await chrome.storage.local.set({ popupTop: win.top, popupLeft: win.left });
  } catch {}
  try { await chrome.windows.remove(alertWindowId); } catch {}
  await chrome.storage.session.set({ alertWindowId: null });
}

// Returns true when the given tab ID is the currently active tab in its window.
async function tabIsActive(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    return activeTab?.id === tabId;
  } catch { return false; }
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id ?? null;

  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ isMyTurn: true, gameTabId: tabId });
    // Show popup only when the chess.com tab isn't currently in focus.
    tabIsActive(tabId).then(active => { if (!active) openPopup(); });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false });
    closePopup();
  }
});

// ── Tab / window switching ────────────────────────────────────────────────────

// Fires when the user switches tabs within a window.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;
  if (tabId === gameTabId) {
    closePopup(); // back on chess.com — DOM overlay takes over
  } else {
    openPopup(); // left chess.com — show floating popup
  }
});

// Fires when the focused Chrome window changes (e.g. switching to a second Chrome window).
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return; // switched to non-Chrome app
  const { isMyTurn, gameTabId, alertWindowId } = await getState();
  if (!isMyTurn || windowId === alertWindowId) return;

  const [activeTab] = await chrome.tabs.query({ active: true, windowId });
  if (activeTab?.id === gameTabId) {
    closePopup();
  } else {
    openPopup();
  }
});

// ── Tab close ─────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await getState();
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  closePopup();
});
