// ==========================================
// HABITS — ORCHESTRATOR
// ==========================================
// This file owns the Habits tab's core CRUD (restore-from-trash, log
// toggling, the Progress tab's deep-link) plus setupHabitsEvents(),
// which just wires up the sibling habits-*.js modules below — each one
// owns a single concern of the Habits tab's UI (the create/edit modal,
// its frequency picker, category management, the delete modal, sorting,
// date navigation, quick-add). That split replaced what used to be one
// ~900-line setupHabitsEvents() function; see habits-modal-state.js for
// the couple of pieces of state (which habit is being edited, which
// color is picked) that need to be shared across that split.

import { habits, setHabits, savedHabitCategories, setSavedHabitCategories, categoryColors, setCategoryColors, currentHabitDate, setCurrentHabitDate } from '../../core/state.js';
import { startQuoteRotation } from '../quotes/motivation.js';
import { readRaw, STORAGE_KEYS } from '../../core/storage.js';
import { renderHabits, updateHabitProgress, renderHabitCategories } from './habits-render.js';
import { saveHabits, saveHabitCategories } from './habits-storage.js';
import { updateDateDisplayUI, setupHabitDateNav } from './habits-date-nav.js';
import { setupHabitModalOpenClose } from './habits-modal-open.js';
import { setupHabitModalPickers } from './habits-modal-pickers.js';
import { setupHabitFrequencyPicker } from './habits-modal-frequency.js';
import { setupHabitModalSave } from './habits-modal-save.js';
import { setupHabitDeleteModal } from './habits-delete-modal.js';
import { setupCategoryManagement } from './habits-categories.js';
import { setupHabitSort } from './habits-sort.js';
import { setupQuickAddHabit } from './habits-quick-add.js';
import { getDateKey } from './habits-logic.js';
import { t, formatDate } from '../../core/i18n.js';

/**
 * Puts a trashed habit back into the live list exactly as it was
 * (id, logs, streak history all intact). Called from the Trash modal —
 * exported here, alongside the rest of this file's other CRUD, rather
 * than duplicated in trash-ui.js.
 */
export function restoreHabit(habitData) {
  if (!habitData || habits.some(h => h.id === habitData.id)) {return;}
  setHabits([...habits, habitData]);
  saveHabits();
  renderHabits();
  renderHabitCategories();
}

/** Puts a trashed category name (and its custom color, if any) back. */
export function restoreHabitCategory(categoryData) {
  if (!categoryData || !categoryData.name || savedHabitCategories.includes(categoryData.name)) {return;}
  setSavedHabitCategories([...savedHabitCategories, categoryData.name]);
  if (categoryData.color) {setCategoryColors({ ...categoryColors, [categoryData.name]: categoryData.color });}
  saveHabitCategories();
  renderHabitCategories();
  renderHabits();
}

// Tracks the currently-running habit quote rotation so repeat calls to
// initHabitQuotes() (page load, then again on every languageChanged) don't
// stack duplicate setIntervals on top of each other — see FIX note below.
let stopHabitQuoteRotationFn = null;

export function initHabitQuotes() {
  // FIX: initHabitQuotes() is called on load AND on every languageChanged
  // event, but never used to clean up its previous rotation — each call
  // left the old setInterval running and started a new one alongside it,
  // so the quote's fade/duration got faster and more erratic the more you
  // switched language. Stop any rotation already in flight first, exactly
  // like focus-mode.js already does for its own quote rotation.
  if (stopHabitQuoteRotationFn) {
    stopHabitQuoteRotationFn();
    stopHabitQuoteRotationFn = null;
  }
  const quoteElement = document.getElementById('motivational-quote');
  stopHabitQuoteRotationFn = startQuoteRotation(quoteElement, { category: 'habits' });
}

/**
 * Toggles a habit log for a specific date
 * @param {number} habitId
 * @param {string} dateKey - Format: 'YYYY-MM-DD'
 * @param {string} status - 'done' or 'skipped'
 */
export function toggleHabitLog(habitId, dateKey, status) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) {return;}

  if (!habit.logs) {habit.logs = {};}

  if (habit.logs[dateKey] === status) {
    delete habit.logs[dateKey];
  } else {
    habit.logs[dateKey] = status;
  }

  saveHabits();
  renderHabits();
}

// --- TOP STREAKS & DEEP LINKING EXPORT ---
export function setHabitDate(dateObj) {
  const newDate = new Date(dateObj);
  newDate.setHours(0,0,0,0);

  // BUG FIX: We MUST use the setter function from state.js!
  setCurrentHabitDate(newDate);

  const display = document.getElementById('habit-date-display');
  if (display) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffDays = Math.ceil((newDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {display.textContent = t('today');}
    else if (diffDays === -1) {display.textContent = t('yesterday');}
    else if (diffDays === 1) {display.textContent = t('tomorrow');}
    else {display.textContent = formatDate(newDate, { month: 'short', day: 'numeric' });}
  }
  renderHabits();
}

// ==========================================
// EVENTS SETUP
// ==========================================
export function setupHabitsEvents() {
  updateDateDisplayUI();

  setupHabitDateNav();
  setupHabitModalOpenClose();
  setupHabitModalPickers();
  setupHabitFrequencyPicker();
  setupHabitModalSave();
  setupHabitDeleteModal();
  setupCategoryManagement();
  setupHabitSort();
  setupQuickAddHabit();

  // --- HABIT ACTION BUTTONS (Done, Skip, Delete) ---
  const habitListContainer = document.getElementById('habit-list-container');
  if (habitListContainer) {
    habitListContainer.addEventListener('click', (e) => {
      const habitItem = e.target.closest('.habit-item');
      if (!habitItem) {return;}

      const habitId = habitItem.dataset.id;
      const dateStr = getDateKey(currentHabitDate);

      // Done
      if (e.target.closest('.done-habit-btn')) {
        toggleHabitLog(habitId, dateStr, 'done');
      }
      // Skip
      else if (e.target.closest('.skip-habit-btn')) {
        toggleHabitLog(habitId, dateStr, 'skipped');
      }
    });
  }

  // Wire top-left gear to the main Settings Modal
  const habitSettingsBtn = document.querySelector('.habit-settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  if (habitSettingsBtn && settingsModal) {
    habitSettingsBtn.addEventListener('click', () => {
      // BUG FIX: Revert unsaved changes when opening from Habits!
      document.dispatchEvent(new Event('reloadSettingsUI'));
      // FIX: Progress's dashboard toggles don't belong in the modal
      // opened from here — see the matching note in settings.js's
      // settingsBtn handler for the full explanation.
      settingsModal.classList.remove('progress-context');
      settingsModal.classList.add('show');
    });
  }

  document.addEventListener('tabChanged', () => {
    if (readRaw(STORAGE_KEYS.ACTIVE_TAB) === '1') {updateHabitProgress();}
  });

  // Populates the category filter pills. Was previously a bare
  // module-top-level call (i.e. ran the instant habits.js was first
  // imported, before setupHabitsEvents() itself was ever called) —
  // moved here, before main.js's own separate renderHabits() call
  // right after setupHabitsEvents(), which preserves the same relative
  // ordering (category pills exist before the habit list first renders)
  // while making the ordering an explicit part of this function instead
  // of an accident of import timing.
  renderHabitCategories();
}
