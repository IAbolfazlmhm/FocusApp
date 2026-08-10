// ==========================================
// FOCUS MODE
// ==========================================
// A distraction-reduced view of the Pomodoro tab: hides the tab nav and
// task list, lets the timer panel take the freed space, and shows a
// rotating motivational quote. Deliberately opt-in (a toggle button, not
// something that auto-activates when the timer starts) — auto-activating
// a mode that changes the whole layout the instant Start is pressed
// would be surprising more often than welcome, and would make it easy
// to trigger by accident. It also deliberately persists across phase
// changes (work → break → work): the point is a sustained
// distraction-reduced session, not just one phase of it. Exiting is
// always the same one action (click the toggle again, or Escape),
// regardless of what phase the timer is in when you do it.
//
// This module only toggles a body class and manages the quote rotation
// — it has no knowledge of and makes no changes to timer state, so
// pause/resume/skip/reset all behave identically whether Focus Mode is
// on or off.

import { startQuoteRotation } from './motivation.js';

let focusModeActive = false;
let stopQuoteRotationFn = null;

export function isFocusModeActive() {
  return focusModeActive;
}

function setToggleButtonState(active) {
  const btn = document.getElementById('focus-mode-toggle-btn');
  if (!btn) {return;}
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'Exit Focus Mode' : 'Enter Focus Mode');
  btn.title = active ? 'Exit Focus Mode' : 'Focus Mode';
  const use = btn.querySelector('use');
  if (use) {use.setAttribute('href', active ? '#icon-close' : '#icon-target');}
}

export function enterFocusMode() {
  if (focusModeActive) {return;}
  focusModeActive = true;
  document.body.classList.add('focus-mode-active');
  setToggleButtonState(true);
  stopQuoteRotationFn = startQuoteRotation(document.getElementById('focus-mode-quote'), { category: 'focus' });
}

export function exitFocusMode() {
  if (!focusModeActive) {return;}
  focusModeActive = false;
  document.body.classList.remove('focus-mode-active');
  setToggleButtonState(false);
  if (stopQuoteRotationFn) {
    stopQuoteRotationFn();
    stopQuoteRotationFn = null;
  }
}

export function toggleFocusMode() {
  if (focusModeActive) {exitFocusMode();} else {enterFocusMode();}
}

export function setupFocusMode() {
  const btn = document.getElementById('focus-mode-toggle-btn');
  if (btn) {
    btn.addEventListener('click', toggleFocusMode);
  }
}
