// Injects the overlay element directly. Called via executeScript so it runs
// in the tab's isolated world without needing a page refresh.
// No _chessstayLoaded guard — always creates a fresh element.
function showOverlayInTab() {
  document.getElementById('chessstay-remote')?.remove();
  document.getElementById('chessstay-remote-style')?.remove();

  const style = document.createElement('style');
  style.id = 'chessstay-remote-style';
  style.textContent =
    '@keyframes cspulse{from{transform:scale(1)}to{transform:scale(1.15)}}' +
    '@keyframes csblink{0%,100%{background:#1a1a2e}50%{background:#fff}}' +
    '#chessstay-remote{position:fixed;bottom:24px;right:24px;width:160px;padding:12px 10px;' +
    'background:#1a1a2e;border:2px solid #f0c040;border-radius:12px;z-index:2147483647;' +
    'display:flex;flex-direction:column;align-items:center;gap:6px;' +
    'box-shadow:0 4px 24px rgba(0,0,0,.6);font-family:Segoe UI,sans-serif;color:#fff;' +
    'cursor:move;user-select:none;animation:csblink .8s ease-in-out infinite}' +
    '#chessstay-remote .k{font-size:30px;animation:cspulse .8s ease-in-out infinite alternate;pointer-events:none}' +
    '#chessstay-remote .t{font-size:13px;font-weight:800;color:#f0c040;letter-spacing:1px;pointer-events:none}';
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'chessstay-remote';
  el.innerHTML = '<div class="k">♞</div><div class="t">YOUR TURN!</div>';
  document.body.appendChild(el);

  try {
    // Restore as right/bottom distance so position is consistent across tabs
    // regardless of scrollbar width or viewport differences.
    chrome.storage.local.get({ remoteRight: null, remoteBottom: null }, ({ remoteRight, remoteBottom }) => {
      if (remoteRight !== null) {
        el.style.right  = remoteRight  + 'px';
        el.style.bottom = remoteBottom + 'px';
        el.style.left   = 'auto';
        el.style.top    = 'auto';
      }
    });
  } catch {}

  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    let left = rect.left, top = rect.top;
    el.style.left = left + 'px'; el.style.top = top + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    const sx = e.clientX, sy = e.clientY;
    const onMove = e => {
      left = rect.left + (e.clientX - sx);
      top  = rect.top  + (e.clientY - sy);
      el.style.left = left + 'px'; el.style.top = top + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Save as corner distance so restoring on any tab puts it in the same visual spot.
      try {
        chrome.storage.local.set({
          remoteRight:  Math.round(window.innerWidth  - left - el.offsetWidth),
          remoteBottom: Math.round(window.innerHeight - top  - el.offsetHeight),
        });
      } catch {}
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function hideOverlayInTab() {
  document.getElementById('chessstay-remote')?.remove();
  document.getElementById('chessstay-remote-style')?.remove();
}

async function showOnTab(tabId) {
  if (!tabId) return;
  try {
    // Never put a remote overlay on a chess.com game tab — content.js owns
    // the overlay there. Avoids a double overlay if gameTabId is briefly stale.
    const tab = await chrome.tabs.get(tabId);
    if (/^https:\/\/www\.chess\.com\/(game|play)\//.test(tab.url || '')) return;
    await chrome.scripting.executeScript({ target: { tabId }, func: showOverlayInTab });
    await chrome.storage.session.set({ overlayTabId: tabId });
  } catch {}
}

async function hideCurrentOverlay() {
  const { overlayTabId } = await chrome.storage.session.get({ overlayTabId: null });
  if (!overlayTabId) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: overlayTabId }, func: hideOverlayInTab });
  } catch {}
  await chrome.storage.session.set({ overlayTabId: null });
}

// ── Startup: wipe stale state and scrub leftover DOM elements ─────────────────

(async () => {
  // Do NOT reset session state here — chrome.storage.session already persists
  // correctly across service worker sleep/wake cycles. Resetting it here would
  // wipe isMyTurn every time Chrome wakes the service worker (every ~30s).
  await chrome.storage.local.set({ showRemoteOverlay: false });

  // Only scrub leftover DOM elements when no turn is active.
  const { isMyTurn } = await chrome.storage.session.get({ isMyTurn: false });
  if (!isMyTurn) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url?.match(/^(https?|file):\/\//)) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: hideOverlayInTab,
      }).catch(() => {});
    }
  }

  // Re-inject content.js into any already-open chess.com game/play tabs.
  // After an extension reload the existing content script is orphaned and can
  // no longer send MY_TURN, so other tabs would never light up. Re-injecting
  // restores a live script without the user having to refresh chess.com.
  const chessTabs = await chrome.tabs.query({
    url: ['https://www.chess.com/game/*', 'https://www.chess.com/play/*'],
  });
  for (const tab of chessTabs) {
    if (!tab.id) continue;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    }).catch(() => {});
  }
})();

// ── Messages from chess.com content script ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id ?? null;

  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ isMyTurn: true, gameTabId: tabId });
    chrome.storage.local.set({ showRemoteOverlay: true });
    chrome.tabs.query({ active: true, currentWindow: true }, ([active]) => {
      if (active && active.id !== tabId) showOnTab(active.id);
    });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false });
    chrome.storage.local.set({ showRemoteOverlay: false });
    hideCurrentOverlay();
  }
});

// ── Tab switching: move overlay to newly active tab ───────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { isMyTurn, gameTabId } = await chrome.storage.session.get({ isMyTurn: false, gameTabId: null });
  if (!isMyTurn) return;
  await hideCurrentOverlay();
  if (tabId !== gameTabId) showOnTab(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const { isMyTurn, gameTabId } = await chrome.storage.session.get({ isMyTurn: false, gameTabId: null });
  if (!isMyTurn) return;
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!active) return;
  await hideCurrentOverlay();
  if (active.id !== gameTabId) showOnTab(active.id);
});

// ── Chess.com tab closed ──────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await chrome.storage.session.get({ gameTabId: null });
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  chrome.storage.local.set({ showRemoteOverlay: false });
  hideCurrentOverlay();
});
