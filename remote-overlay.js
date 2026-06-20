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
      pointer-events: none;
    }
    #chessstay-remote .k { font-size: 30px; animation: cspulse .8s ease-in-out infinite alternate; }
    #chessstay-remote .t { font-size: 13px; font-weight: 800; color: #f0c040; letter-spacing: 1px; }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'chessstay-remote';
  el.innerHTML = '<div class="k">♞</div><div class="t">YOUR TURN!</div>';
  document.body.appendChild(el);

  try {
    const ctx = new AudioContext();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime  + i * 0.12 + 0.4);
    });
  } catch {}
}

function hideOverlay() {
  document.getElementById('chessstay-remote')?.remove();
  document.getElementById('chessstay-remote-style')?.remove();
}

// React to storage changes — fires on all open tabs simultaneously.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('showRemoteOverlay' in changes)) return;
  if (changes.showRemoteOverlay.newValue) showOverlay();
  else hideOverlay();
});

// Show immediately if turn was already active when this page loaded.
chrome.storage.local.get({ showRemoteOverlay: false }, ({ showRemoteOverlay }) => {
  if (showRemoteOverlay) showOverlay();
});
