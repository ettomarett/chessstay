async function getState() {
  return chrome.storage.session.get({ alertWindowId: null, isMyTurn: false, gameTabId: null });
}

async function getSavedPosition() {
  const { alertTop, alertLeft } = await chrome.storage.local.get({ alertTop: 80, alertLeft: 80 });
  return { top: alertTop, left: alertLeft };
}

async function openAlertWindow() {
  const { alertWindowId } = await getState();

  if (alertWindowId !== null) {
    try {
      await chrome.windows.update(alertWindowId, { focused: true });
      return;
    } catch {
      // Window was closed externally — clear stale ID and create a new one.
      await chrome.storage.session.set({ alertWindowId: null });
    }
  }

  const { top, left } = await getSavedPosition();

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('alert.html'),
    type: 'popup',
    width: 320,
    height: 180,
    focused: true,
    top,
    left,
  });
  await chrome.storage.session.set({ alertWindowId: win.id });
}

async function closeAlertWindow() {
  const { alertWindowId } = await getState();
  if (alertWindowId !== null) {
    try {
      const win = await chrome.windows.get(alertWindowId);
      await chrome.storage.local.set({ alertTop: win.top, alertLeft: win.left });
    } catch {}
    try { await chrome.windows.remove(alertWindowId); } catch {}
    await chrome.storage.session.set({ alertWindowId: null });
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ isMyTurn: true, gameTabId: sender.tab?.id ?? null });
    openAlertWindow();
  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
    closeAlertWindow();
  }
});

// Guaranteed cleanup when the chess.com tab is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await getState();
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  closeAlertWindow();
});

// When focus moves away from the alert, flash it in the taskbar instead of
// stealing focus — this lets the user type freely while still being reminded.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const { isMyTurn, alertWindowId } = await getState();
  if (!isMyTurn || alertWindowId === null) return;
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  if (windowId !== alertWindowId) {
    chrome.windows.update(alertWindowId, { drawAttention: true }).catch(() => {});
  }
});

// If the user manually closes the alert while it's still their turn, reopen it.
chrome.windows.onRemoved.addListener(async (windowId) => {
  const { isMyTurn, alertWindowId } = await getState();
  if (windowId !== alertWindowId) return;
  await chrome.storage.session.set({ alertWindowId: null });
  if (isMyTurn) {
    // Reopen at same position — position was already saved before removal isn't possible here,
    // but the setInterval in alert.html will have written it recently enough.
    openAlertWindow();
  }
});
