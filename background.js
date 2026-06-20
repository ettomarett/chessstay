async function getState() {
  return chrome.storage.session.get({ isMyTurn: false, gameTabId: null, overlayTabId: null });
}

// Inject the reminder overlay into any tab (silently fails on chrome:// pages etc.)
async function injectOverlay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (document.getElementById('chessstay-remote')) return;
        const el = document.createElement('div');
        el.id = 'chessstay-remote';
        el.style.cssText = [
          'position:fixed', 'bottom:24px', 'right:24px',
          'width:160px', 'padding:12px 10px',
          'background:#1a1a2e', 'border:2px solid #f0c040', 'border-radius:12px',
          'z-index:2147483647',
          'display:flex', 'flex-direction:column', 'align-items:center', 'gap:6px',
          'box-shadow:0 4px 24px rgba(0,0,0,.6)',
          'font-family:Segoe UI,sans-serif', 'color:#fff',
          'pointer-events:none',  // never blocks clicks or typing
        ].join(';');

        const style = document.createElement('style');
        style.textContent = '@keyframes cspulse{from{transform:scale(1)}to{transform:scale(1.15)}}' +
          '#chessstay-remote .k{font-size:30px;animation:cspulse .8s ease-in-out infinite alternate}' +
          '#chessstay-remote .t{font-size:13px;font-weight:800;color:#f0c040;letter-spacing:1px}';
        document.head.appendChild(style);

        el.innerHTML = '<div class="k">♞</div><div class="t">YOUR TURN!</div>';
        document.body.appendChild(el);
      },
    });
    await chrome.storage.session.set({ overlayTabId: tabId });
  } catch {}
}

async function removeOverlay() {
  const { overlayTabId } = await getState();
  if (overlayTabId === null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: overlayTabId },
      func: () => {
        document.getElementById('chessstay-remote')?.remove();
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
    // If user is not currently on the chess.com tab, inject into wherever they are.
    chrome.tabs.query({ active: true, currentWindow: true }, ([active]) => {
      if (active && active.id !== tabId) injectOverlay(active.id);
    });

  } else if (message.type === 'TURN_OVER') {
    chrome.storage.session.set({ isMyTurn: false });
    removeOverlay();
  }
});

// ── Tab switching ─────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;

  if (tabId === gameTabId) {
    removeOverlay(); // chess.com tab — DOM overlay in content.js handles it
  } else {
    await removeOverlay(); // clean up previous tab first
    injectOverlay(tabId);
  }
});

// Switching between Chrome windows.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const { isMyTurn, gameTabId } = await getState();
  if (!isMyTurn) return;

  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!active) return;

  if (active.id === gameTabId) {
    removeOverlay();
  } else {
    await removeOverlay();
    injectOverlay(active.id);
  }
});

// ── Tab close ─────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gameTabId } = await getState();
  if (tabId !== gameTabId) return;
  chrome.storage.session.set({ isMyTurn: false, gameTabId: null });
  removeOverlay();
});
