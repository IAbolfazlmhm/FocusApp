import { setupTabs } from './js/tabs.js';
import { setupModalAccessibility, initConfirmModal, closeTopmostModal } from './js/modal-utils.js';
import { loadSettings, setupSettingsEvents, applySettingsToTimer } from './js/settings.js';
import { loadTimerState, updatePhaseColors, toggleTimer, setupTimerEvents } from './js/timer.js';
import { setupTaskEvents } from './js/tasks.js';
import { renderFilters, renderTasks } from './js/tasks-render.js';
import { setupHabitsEvents, initHabitQuotes } from './js/habits.js';
import { renderHabits } from './js/habits-render.js';
import { setupProgressEvents } from './js/progress.js';
import { playUI } from './js/audio.js';
import { setupFocusMode, exitFocusMode, isFocusModeActive } from './js/focus-mode.js';
import { setupQuotesEvents } from './js/quotes.js';

window.addEventListener('DOMContentLoaded', () => {
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
  setupModalAccessibility();
  setupFocusMode();
  setupGlobalShortcuts();
});

// Inter-module event listener for updating background themes
document.addEventListener('updateColors', () => {
  updatePhaseColors();
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
