// ==========================================
// HABIT PERSISTENCE
// ==========================================
// Deliberately its own file rather than living in habits.js (where most
// of the CRUD functions that call it are) — habits-modal-save.js and
// habits-categories.js also need saveHabits()/saveHabitCategories(),
// and habits.js already needs to import setup functions FROM those
// files to build setupHabitsEvents(). Putting the save functions in
// habits.js would force a cycle (habits.js -> habits-modal-save.js ->
// habits.js); a shared leaf dependency with nothing of its own to
// import keeps it one-way instead. Mirrors tasks-storage.js exactly,
// which solves the identical problem for tasks.js/tasks-render.js.
import { habits, savedHabitCategories, categoryColors } from '../../core/state.js';
import { writeJSON, STORAGE_KEYS } from '../../core/storage.js';

export function saveHabits() {
  writeJSON(STORAGE_KEYS.HABITS, habits);
}

export function saveHabitCategories() {
  writeJSON(STORAGE_KEYS.HABIT_CATEGORIES, savedHabitCategories);
  writeJSON(STORAGE_KEYS.CATEGORY_COLORS, categoryColors);
}
