// On every service worker start (extension load, reload, or Chrome restart):
// wipe stale state and scrub any leftover overlay elements from all open tabs.
(async () => {
  await chrome.storage.local.set({ showRemoteOverlay: false });
  await chrome.storage.session.set({ isMyTurn: false, gameTabId: null, overlayTabId: null });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url?.startsWith('http')) continue;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.getElementById('chessstay-remote')?.remove();
        document.getElementById('chessstay-remote-style')?.remove();
        window._chessstayLoaded = false;
      },
    }).catch(() => {});
  }
})();

async function getState() {
  return chrome.storage.session.get({ isMyTurn: false, gameTabId: null, overlayTabId: null });
}

async function showOnTab(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['remote-overlay.js'] });
    await chrome.storage.session.set({ overlayTabId: tabId });
  } catch {}
}

async function hideCurrentOverlay() {
  const { overlayTabId } = await getState();
  if (!overlayTabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: overlayTabId },
      func: () => {
        document.getElementById('chessstay-remote')?.remove();
        document.getElementById('chessstay-remote-style')?.remove();
        window._chessstayLoaded = false;
      },
    });
  } catch {}
  await chrome.storage.session.set({ overlayTabId: null });
}

// ── Messages from chess.com content script ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id ?? null;

  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ isMyTurn: true, gameTabId: tabId });
    chrome.tabs.query({ active: true, currentWindow: true }, ([active]) => {
      if (active && active.id !== tabId) showOnTab(active.id);
    });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false });
    hideCurrentOverlay();
  }
});

// ── Tab switching — move overlay to whichever tab is active ───────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;
  await hideCurrentOverlay();
  if (tabId !== gameTabId) showOnTab(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!active) return;
  await hideCurrentOverlay();
  if (active.id !== gameTabId) showOnTab(active.id);
});

// ── Tab close ─────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await getState();
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  hideCurrentOverlay();
});
