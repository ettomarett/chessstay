const DEFAULTS = {
  soundEnabled: false,
  blinkEnabled: true,
  nonChessOnly: false,
};

const ids = Object.keys(DEFAULTS);

// Load current settings into the checkboxes.
chrome.storage.local.get(DEFAULTS, (settings) => {
  for (const id of ids) {
    document.getElementById(id).checked = settings[id];
  }
});

// Save on change.
for (const id of ids) {
  document.getElementById(id).addEventListener('change', (e) => {
    chrome.storage.local.set({ [id]: e.target.checked });
  });
}
