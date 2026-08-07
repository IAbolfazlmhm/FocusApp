import { setupTabs, setupModalAccessibility, initConfirmModal, closeTopmostModal } from './js/ui-utils.js';
import { loadSettings, setupSettingsEvents, applySettingsToTimer } from './js/settings.js';
import { loadTimerState, updatePhaseColors, toggleTimer, setupTimerEvents } from './js/timer.js';
import { renderFilters, renderTasks, setupTaskEvents } from './js/tasks.js';
import { renderHabits, setupHabitsEvents, initHabitQuotes } from './js/habits.js';
import { setupProgressEvents } from './js/progress.js';
import { playUI } from './js/audio.js';

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
  setupModalAccessibility();
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

    // ESC key closes only the topmost modal
    if (event.code === 'Escape') {
      event.preventDefault();
      closeTopmostModal();
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
