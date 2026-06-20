// Self-contained overlay function injected into non-chess.com tabs via executeScript.
// Must not close over any variables from this scope.
function injectOverlay() {
  if (window._chessstayLoaded) return;
  window._chessstayLoaded = true;

  function showOverlay() {
    if (document.getElementById('chessstay-remote')) return;

    const style = document.createElement('style');
    style.id = 'chessstay-remote-style';
    style.textContent =
      '@keyframes cspulse{from{transform:scale(1)}to{transform:scale(1.15)}}' +
      '#chessstay-remote{position:fixed;bottom:24px;right:24px;width:160px;padding:12px 10px;' +
      'background:#1a1a2e;border:2px solid #f0c040;border-radius:12px;z-index:2147483647;' +
      'display:flex;flex-direction:column;align-items:center;gap:6px;' +
      'box-shadow:0 4px 24px rgba(0,0,0,.6);font-family:Segoe UI,sans-serif;color:#fff;' +
      'cursor:move;user-select:none}' +
      '#chessstay-remote .k{font-size:30px;animation:cspulse .8s ease-in-out infinite alternate;pointer-events:none}' +
      '#chessstay-remote .t{font-size:13px;font-weight:800;color:#f0c040;letter-spacing:1px;pointer-events:none}';
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'chessstay-remote';
    el.innerHTML = '<div class="k">♞</div><div class="t">YOUR TURN!</div>';
    document.body.appendChild(el);

    try {
      chrome.storage.local.get({ remoteLeft: null, remoteTop: null }, ({ remoteLeft, remoteTop }) => {
        if (remoteLeft !== null) {
          el.style.left   = remoteLeft + 'px';
          el.style.top    = remoteTop  + 'px';
          el.style.right  = 'auto';
          el.style.bottom = 'auto';
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
        try { chrome.storage.local.set({ remoteLeft: Math.round(left), remoteTop: Math.round(top) }); } catch {}
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function hideOverlay() {
    document.getElementById('chessstay-remote')?.remove();
    document.getElementById('chessstay-remote-style')?.remove();
  }

  function syncOverlay() {
    try {
      chrome.storage.local.get({ showRemoteOverlay: false }, ({ showRemoteOverlay }) => {
        if (showRemoteOverlay) showOverlay(); else hideOverlay();
      });
    } catch {}
  }

  // React to storage changes (handles TURN_OVER and show signals).
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !('showRemoteOverlay' in changes)) return;
      if (changes.showRemoteOverlay.newValue) showOverlay(); else hideOverlay();
    });
  } catch {}

  // When user switches back to this tab, re-sync with current turn state.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncOverlay();
  });

  syncOverlay();
}

async function ensureOverlay(tabId) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: injectOverlay });
  } catch {}
}

// ── Startup: wipe stale state and scrub leftover DOM elements ─────────────────

(async () => {
  await chrome.storage.local.set({ showRemoteOverlay: false });
  await chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
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

// ── Messages from chess.com content script ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id ?? null;

  if (message.type === 'MY_TURN') {
    chrome.storage.session.set({ isMyTurn: true, gameTabId: tabId });
    chrome.storage.local.set({ showRemoteOverlay: true });
    // Inject immediately into whatever tab is currently active (if not chess.com).
    chrome.tabs.query({ active: true, currentWindow: true }, ([active]) => {
      if (active && active.id !== tabId) ensureOverlay(active.id);
    });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false });
    chrome.storage.local.set({ showRemoteOverlay: false });
  }
});

// ── Tab switching: inject into the newly active tab if needed ─────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { isMyTurn, gameTabId } = await chrome.storage.session.get({ isMyTurn: false, gameTabId: null });
  if (!isMyTurn || tabId === gameTabId) return;
  ensureOverlay(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const { isMyTurn, gameTabId } = await chrome.storage.session.get({ isMyTurn: false, gameTabId: null });
  if (!isMyTurn) return;
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!active || active.id === gameTabId) return;
  ensureOverlay(active.id);
});

// ── Chess.com tab closed ──────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await chrome.storage.session.get({ gameTabId: null });
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  chrome.storage.local.set({ showRemoteOverlay: false });
});
