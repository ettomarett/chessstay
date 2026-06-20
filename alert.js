document.querySelector('button').addEventListener('click', () => window.close());

const ctx = new AudioContext();
const notes = [523, 659, 784];
notes.forEach((freq, i) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
  osc.start(ctx.currentTime + i * 0.12);
  osc.stop(ctx.currentTime + i * 0.12 + 0.4);
});

setInterval(() => {
  chrome.storage.local.set({ alertTop: window.screenTop, alertLeft: window.screenLeft });
}, 500);
