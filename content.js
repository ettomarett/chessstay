// Re-injectable: if a previous instance is running (e.g. after extension
// reload re-injects this file), tear down its observers first.
if (window._chessstayContent) {
  try { window._chessstayContent.disconnect(); } catch {}
}

let myTurnActive = false;
let overlay = null;

// ── Turn detection ────────────────────────────────────────────────────────────

function isMyTurn() {
  if (document.querySelector('.clock-bottom.clock-player-turn')) return true;
  if (document.title.toLowerCase().includes('your turn')) return true;
  if (document.querySelector('[class*="your-turn"], [class*="yourTurn"]')) return true;
  return false;
}

function send(type) {
  try { chrome.runtime.sendMessage({ type }); } catch {}
}

function onDomChange() {
  const nowMyTurn = isMyTurn();
  if (nowMyTurn && !myTurnActive) {
    myTurnActive = true;
    showOverlay();
    send('MY_TURN');
    maybePlaySound();
  } else if (!nowMyTurn && myTurnActive) {
    myTurnActive = false;
    removeOverlay();
    send('TURN_OVER');
  }
}

// Beep only when the chess tab is in the background (you're on another tab).
// This is why sound never "triggers when we're on the chess page".
function maybePlaySound() {
  try {
    chrome.storage.local.get({ soundEnabled: false }, ({ soundEnabled }) => {
      if (soundEnabled && document.hidden) playBeep();
    });
  } catch {}
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime  + i * 0.12 + 0.4);
    });
  } catch {}
}

// ── DOM overlay ───────────────────────────────────────────────────────────────

const CSS = `
  @keyframes cs-blink { 0%,100%{background:#1a1a2e} 50%{background:#fff} }
  #chessstay-overlay {
    position: fixed;
    top: 80px;
    right: 20px;
    width: 180px;
    padding: 14px 14px 12px;
    background: #1a1a2e;
    border: 2px solid #f0c040;
    border-radius: 12px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
    font-family: 'Segoe UI', sans-serif;
    cursor: move;
    user-select: none;
    animation: cs-blink .8s ease-in-out infinite;
  }
  #chessstay-overlay .cs-knight {
    font-size: 34px;
    animation: cs-pulse 0.8s ease-in-out infinite alternate;
    pointer-events: none;
  }
  @keyframes cs-pulse {
    from { transform: scale(1);    filter: brightness(1); }
    to   { transform: scale(1.15); filter: brightness(1.4); }
  }
  #chessstay-overlay .cs-label {
    font-size: 15px;
    font-weight: 800;
    color: #f0c040;
    letter-spacing: 1px;
    pointer-events: none;
  }
`;

function showOverlay() {
  // Remove any stale overlays first (e.g. one left by an orphaned content
  // script after an extension reload, or a stray remote overlay). Guarantees
  // exactly one overlay on the page.
  document.querySelectorAll('#chessstay-overlay, #chessstay-style, #chessstay-remote, #chessstay-remote-style')
    .forEach(n => n.remove());
  if (overlay && !overlay.isConnected) overlay = null;
  if (overlay) return;

  const opts = { nonChessOnly: false, blinkEnabled: true, csTop: 80, csLeft: null };
  try {
    chrome.storage.local.get(opts, buildOverlay);
  } catch {
    buildOverlay(opts);
  }
}

function buildOverlay({ nonChessOnly, blinkEnabled, csTop, csLeft }) {
  if (nonChessOnly) return;   // user wants the popup only on other tabs
  if (overlay) return;

  const style = document.createElement('style');
  style.id = 'chessstay-style';
  style.textContent = CSS;
  document.head.appendChild(style);

  overlay = document.createElement('div');
  overlay.id = 'chessstay-overlay';
  overlay.innerHTML = '<div class="cs-knight">♞</div><div class="cs-label">YOUR TURN!</div>';
  if (!blinkEnabled) overlay.style.animation = 'none';

  overlay.style.top = csTop + 'px';
  if (csLeft !== null) {
    overlay.style.left = csLeft + 'px';
    overlay.style.right = 'auto';
  }
  document.body.appendChild(overlay);

  makeDraggable(overlay);
}

function removeOverlay() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  const style = document.getElementById('chessstay-style');
  if (style) style.remove();
}

function makeDraggable(el) {
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let top  = rect.top;
    el.style.left  = left + 'px';
    el.style.right = 'auto';
    el.style.top   = top + 'px';

    const startX = e.clientX;
    const startY = e.clientY;

    function onMove(e) {
      left = rect.left + (e.clientX - startX);
      top  = rect.top  + (e.clientY - startY);
      el.style.left = left + 'px';
      el.style.top  = top  + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      try { chrome.storage.local.set({ csLeft: Math.round(left), csTop: Math.round(top) }); } catch {}
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ── Observers ─────────────────────────────────────────────────────────────────

const bodyObserver = new MutationObserver(onDomChange);
bodyObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

const titleObserver = new MutationObserver(onDomChange);
const titleEl = document.querySelector('title');
if (titleEl) {
  titleObserver.observe(titleEl, { childList: true });
}

// Expose a teardown handle so a re-injected instance can disconnect this one.
window._chessstayContent = {
  disconnect() {
    bodyObserver.disconnect();
    titleObserver.disconnect();
    removeOverlay();
  },
};

// Apply setting changes live while a turn is active.
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('nonChessOnly' in changes) {
      if (changes.nonChessOnly.newValue) removeOverlay();
      else if (myTurnActive) showOverlay();
    }
    if ('blinkEnabled' in changes && overlay) {
      overlay.style.animation = changes.blinkEnabled.newValue ? '' : 'none';
    }
  });
} catch {}

window.addEventListener('pagehide', () => {
  removeOverlay();
  send('TURN_OVER');
});

onDomChange();
