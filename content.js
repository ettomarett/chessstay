// Detects when it's your turn on chess.com and notifies the background script.
// Works for both live games (clock-based) and daily games (title-based).

let myTurnActive = false;

function isMyTurn() {
  // Live games: your clock gets the `clock-player-turn` class when it's your move.
  // Your clock is always `.clock-bottom` (you're rendered at the bottom of the board).
  if (document.querySelector('.clock-bottom.clock-player-turn')) {
    return true;
  }

  // Daily / correspondence games: chess.com changes the tab title.
  if (document.title.toLowerCase().includes('your turn')) {
    return true;
  }

  // Fallback: some UI states use a "your-turn" labelled element.
  if (document.querySelector('[class*="your-turn"], [class*="yourTurn"]')) {
    return true;
  }

  return false;
}

function onDomChange() {
  const nowMyTurn = isMyTurn();

  if (nowMyTurn && !myTurnActive) {
    // Transition: not my turn → my turn
    myTurnActive = true;
    chrome.runtime.sendMessage({ type: 'MY_TURN' });
  } else if (!nowMyTurn && myTurnActive) {
    // Transition: my turn → opponent's turn
    myTurnActive = false;
    chrome.runtime.sendMessage({ type: 'TURN_OVER' });
  }
}

// Watch class changes on the whole board subtree (covers clock class flips).
const bodyObserver = new MutationObserver(onDomChange);
bodyObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
});

// Watch title changes (covers daily-game notifications).
const titleEl = document.querySelector('title');
if (titleEl) {
  const titleObserver = new MutationObserver(onDomChange);
  titleObserver.observe(titleEl, { childList: true });
}

// Send TURN_OVER when the tab is closed or navigated away from.
window.addEventListener('pagehide', () => {
  chrome.runtime.sendMessage({ type: 'TURN_OVER' });
});

// Run once on load in case the page already shows your turn.
onDomChange();
