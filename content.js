// Detects when it's your turn on chess.com and notifies the background script.
// Works for both live games (clock-based) and daily games (title-based).

let myTurnActive = false;

function send(type) {
  try {
    chrome.runtime.sendMessage({ type });
  } catch {}
}

function isMyTurn() {
  if (document.querySelector('.clock-bottom.clock-player-turn')) return true;
  if (document.title.toLowerCase().includes('your turn')) return true;
  if (document.querySelector('[class*="your-turn"], [class*="yourTurn"]')) return true;
  return false;
}

function onDomChange() {
  const nowMyTurn = isMyTurn();
  if (nowMyTurn && !myTurnActive) {
    myTurnActive = true;
    send('MY_TURN');
  } else if (!nowMyTurn && myTurnActive) {
    myTurnActive = false;
    send('TURN_OVER');
  }
}

const bodyObserver = new MutationObserver(onDomChange);
bodyObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
});

const titleEl = document.querySelector('title');
if (titleEl) {
  const titleObserver = new MutationObserver(onDomChange);
  titleObserver.observe(titleEl, { childList: true });
}

window.addEventListener('pagehide', () => send('TURN_OVER'));

onDomChange();
