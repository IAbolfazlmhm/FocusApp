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

import { startQuoteRotation } from '../quotes/motivation.js';
import { t } from '../../core/i18n.js';
import { updateBubble } from '../../shared/tabs/tabs.js';
import { updateFilterBubble } from '../tasks/tasks-render.js';

let focusModeActive = false;
let stopQuoteRotationFn = null;

export function isFocusModeActive() {
  return focusModeActive;
}

function setToggleButtonState(active) {
  const btn = document.getElementById('focus-mode-toggle-btn');
  if (!btn) {return;}
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? t('exit_focus_mode') : t('focus_mode'));
  btn.title = active ? t('exit_focus_mode') : t('focus_mode');
}

export function enterFocusMode() {
  if (focusModeActive) {return;}
  focusModeActive = true;
  document.body.classList.add('focus-mode-active');
  setToggleButtonState(true);
  stopQuoteRotationFn = startQuoteRotation(document.getElementById('focus-mode-quote'), { category: 'focus' });
}

// FIX: the settings gear stays reachable while Focus Mode is active (it
// lives in .timer-header, which focus-mode.css never hides — only the
// tab nav and task list get hidden), so changing language from inside
// Focus Mode is a real, reachable path. But nothing here ever restarted
// this rotation on languageChanged the way initHabitQuotes() does for
// Habits — so the quote already on screen stayed in whatever language it
// was shown in until its own next scheduled tick (up to 8s later), and
// exiting Focus Mode right after a language switch could show it still
// sitting in the old language. main.js calls this from its
// languageChanged handler; it's a no-op when Focus Mode isn't active.
export function refreshFocusModeQuoteIfActive() {
  if (!focusModeActive) {return;}
  setToggleButtonState(true);
  if (stopQuoteRotationFn) {
    stopQuoteRotationFn();
  }
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
  // FIX: Focus Mode hides both the tab nav (.header-container) and the
  // task list (.tasks-section) via CSS — including their active-tab and
  // active-filter bubbles. If a languageChanged event fired while Focus
  // Mode was active (the settings gear stays reachable from inside it —
  // see refreshFocusModeQuoteIfActive's comment above), tabs.js's and
  // tasks-render.js's own bubble-reposition logic would have measured
  // offsetWidth/offsetLeft on elements that were display:none at that
  // exact moment — hidden elements report zero for both, so the bubble
  // got resized/repositioned to nothing and stayed that way, since
  // nothing else re-measures it once Focus Mode exits and the real
  // layout becomes visible again. One extra reposition right here, now
  // that both are visible again, fixes it — harmless even when nothing
  // was actually wrong (re-applying the same already-correct width/left
  // is a no-op).
  requestAnimationFrame(() => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {updateBubble(activeTab, true);}
    updateFilterBubble();
  });
}

export function toggleFocusMode() {
  if (focusModeActive) {exitFocusMode();} else {enterFocusMode();}
}

export function setupFocusMode() {
  const btn = document.getElementById('focus-mode-toggle-btn');
  if (btn) {
    btn.addEventListener('click', toggleFocusMode);
  }
  document.addEventListener('languageChanged', () => {
    setToggleButtonState(focusModeActive);
  });
}
