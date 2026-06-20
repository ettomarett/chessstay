// Manifest content script — runs on pages loaded fresh after extension install.
// For pre-existing tabs the background injects showOverlayInTab() directly via
// executeScript, which doesn't go through this file at all.
(function () {
  function showOverlay() {
    if (document.getElementById('chessstay-remote')) return;

    const style = document.createElement('style');
    style.id = 'chessstay-remote-style';
    style.textContent = `
      @keyframes cspulse { from{transform:scale(1)} to{transform:scale(1.15)} }
      #chessstay-remote {
        position: fixed; bottom: 24px; right: 24px;
        width: 160px; padding: 12px 10px;
        background: #1a1a2e; border: 2px solid #f0c040; border-radius: 12px;
        z-index: 2147483647;
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        box-shadow: 0 4px 24px rgba(0,0,0,.6);
        font-family: 'Segoe UI', sans-serif; color: #fff;
        cursor: move; user-select: none;
      }
      #chessstay-remote .k { font-size: 30px; animation: cspulse .8s ease-in-out infinite alternate; pointer-events: none; }
      #chessstay-remote .t { font-size: 13px; font-weight: 800; color: #f0c040; letter-spacing: 1px; pointer-events: none; }
    `;
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
      const rect  = el.getBoundingClientRect();
      let left = rect.left, top = rect.top;
      el.style.left = left + 'px'; el.style.top = top + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
      const startX = e.clientX, startY = e.clientY;
      const onMove = e => {
        left = rect.left + (e.clientX - startX);
        top  = rect.top  + (e.clientY - startY);
        el.style.left = left + 'px';
        el.style.top  = top  + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        try { chrome.storage.local.set({ remoteLeft: Math.round(left), remoteTop: Math.round(top) }); } catch {}
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  function hideOverlay() {
    document.getElementById('chessstay-remote')?.remove();
    document.getElementById('chessstay-remote-style')?.remove();
  }

  // React to MY_TURN / TURN_OVER via storage flag.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !('showRemoteOverlay' in changes)) return;
      if (changes.showRemoteOverlay.newValue) showOverlay(); else hideOverlay();
    });
  } catch {}

  // Check on load in case a turn is already active (e.g. page refreshed mid-game).
  try {
    chrome.storage.local.get({ showRemoteOverlay: false }, ({ showRemoteOverlay }) => {
      if (showRemoteOverlay) showOverlay();
    });
  } catch {}
}());
