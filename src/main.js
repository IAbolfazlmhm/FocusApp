import { setupTabs } from './shared/tabs/tabs.js';
import { setupModalAccessibility, initConfirmModal, closeTopmostModal } from './shared/modal/modal-utils.js';
import { syncDropdownDisplays } from './shared/dropdown/dropdown.js';
import { loadSettings, setupSettingsEvents, applySettingsToTimer } from './features/settings/settings.js';
import { loadTimerState, updatePhaseColors, updatePhaseText, updateDisplay, toggleTimer, setupTimerEvents } from './features/timer/timer.js';
import { setupTaskEvents } from './features/tasks/tasks.js';
import { renderFilters, renderTasks } from './features/tasks/tasks-render.js';
import { updatePomodoroDateUI } from './features/tasks/tasks-date-nav.js';
import { setupHabitsEvents, initHabitQuotes } from './features/habits/habits.js';
import { renderHabits, renderHabitCategories } from './features/habits/habits-render.js';
import { updateHabitIconPickerLabels } from './features/habits/habit-icons.js';
import { updateDateDisplayUI } from './features/habits/habits-date-nav.js';
import { setupProgressEvents, renderProgressDashboard } from './features/progress/progress.js';
import { playUI } from './shared/audio.js';
import { setupFocusMode, exitFocusMode, isFocusModeActive, refreshFocusModeQuoteIfActive } from './features/timer/focus-mode.js';
import { setupQuotesEvents } from './features/quotes/quotes.js';
import { setupTrashEvents } from './features/trash/trash-ui.js';
import { setupHelpEvents, renderHelpContent } from './features/help/help.js';
import { initLocale, translateDOM } from './core/i18n.js';

function initApp() {
  // 0. i18n Initialization
  initLocale();
  translateDOM();

  // 1. Settings Initialization
  loadSettings();
  setupSettingsEvents();

  // 2. Timer Initialization
  const hasSavedTimer = loadTimerState();
  if (!hasSavedTimer) {applySettingsToTimer();}
  setupTimerEvents();

  // 3. Tasks Initialization
  initConfirmModal();
  setupTaskEvents();
  renderFilters();
  renderTasks();

  // 4. Habits Initialization
  setupHabitsEvents();
  setupProgressEvents();
  renderHabits();
  if (typeof initHabitQuotes === 'function') {initHabitQuotes();}

  // 5. UI & Navigation
  setupTabs();
  setupQuotesEvents();
  setupTrashEvents();
  setupModalAccessibility();
  setupFocusMode();
  setupGlobalShortcuts();
  setupHelpEvents();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Inter-module event listener for updating background themes
document.addEventListener('updateColors', () => {
  updatePhaseColors();
});

// Inter-module event listener for language change
document.addEventListener('languageChanged', () => {
  translateDOM();
  // FIX: dropdown preview inputs (habit frequency, repeat unit, settings
  // language/mode/sound, quote category) hold their selected option's
  // text as an imperative .value that translateDOM() can't reach — only
  // the .dropdown-item options themselves carry data-i18n. Re-derive
  // every preview from its (now re-translated) matching option; without
  // this the closed dropdown kept showing the old language until the
  // user re-picked an option.
  syncDropdownDisplays();
  updatePhaseText();
  // FIX: this call was missing — updatePhaseText() only covers
  // #current-phase/#next-phase, not the main #time-left countdown
  // digits (those live in updateDisplay(), never previously part of
  // this cascade). While the timer is actively running this self-heals
  // within a second anyway, since the tick interval calls updateDisplay()
  // constantly — which is exactly why it looked fine from inside Focus
  // Mode (timer running) but stayed stuck in the old locale's digits
  // whenever the timer was paused/idle, needing an unrelated tab switch
  // to trigger a fresh render before it caught up.
  updateDisplay();
  updatePomodoroDateUI();
  updateDateDisplayUI();
  renderFilters();
  renderTasks();
  renderHabitCategories();
  renderHabits();
  updateHabitIconPickerLabels();
  renderProgressDashboard();
  renderHelpContent();
  refreshFocusModeQuoteIfActive();
  if (typeof initHabitQuotes === 'function') {initHabitQuotes();}
});

// Global Keyboard Shortcuts
function setupGlobalShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Prevent triggering shortcuts when typing in inputs
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {return;}

    if (event.code === 'Space') {
      event.preventDefault();
      toggleTimer();
      // Keyboard shortcut bypasses the click-based data-sound delegate
      // entirely (no click event fires), so it needs its own explicit call.
      if (typeof playUI === 'function') {playUI('click');}
    }

    // ESC key closes only the topmost modal — or, if none is open,
    // exits Focus Mode. Never both in one keypress: closing a modal
    // that happens to be open while Focus Mode is also active takes
    // priority, matching how Escape already behaves everywhere else.
    if (event.code === 'Escape') {
      event.preventDefault();
      if (document.querySelector('.modal-overlay.show')) {
        closeTopmostModal();
      } else if (isFocusModeActive()) {
        exitFocusMode();
      }
    }
  });
}

// --- GLOBAL EVENT DISPATCHER ---
document.addEventListener('click', (e) => {
  if (e.target.closest('.done-btn') || e.target.closest('.habit-item') || e.target.closest('.task-item')) {
    setTimeout(() => {
      document.dispatchEvent(new Event('dataUpdated'));
    }, 100);
  }
});

// --- GLOBAL SOUND HAPTICS (delegate-only model) ---
// Every interactive element that should produce a sound gets a
// data-sound="type" attribute. This single delegated handler is the
// ONLY place playUI() is called for UI sounds — no explicit calls in
// feature modules, no manual exclusion list to maintain.
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-sound]');

  if (trigger && typeof playUI === 'function') {
    playUI(trigger.dataset.sound);
  }
});

// --- SWITCH KEYBOARD SUPPORT ---
// A native <input type="checkbox"> only toggles on Space — but every
// toggle in this app is also marked role="switch" for screen readers,
// and the WAI-ARIA switch pattern expects Enter to activate it too, not
// just Space. This is a separate listener from setupGlobalShortcuts()
// above rather than folded into it, since that one explicitly bails out
// for any INPUT target (so Space isn't double-handled) — this needs the
// opposite: to run *only* for switch inputs.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[role="switch"]')) {
    e.preventDefault();
    e.target.click();
  }
});
