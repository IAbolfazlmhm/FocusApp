// ==========================================
// HABIT MODAL — SAVE
// ==========================================
// Validates and persists whatever the create/edit modal currently
// holds — either updating the habit habitModalState.editingHabitId
// points at, or creating a brand new one. See habits-modal-state.js for
// that shared id, and habits-modal-pickers.js/habits-modal-frequency.js
// for the fields being read here.

import {
  habits, setHabits, savedHabitCategories, setSavedHabitCategories
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { generateId } from '../core/dom-utils.js';
import { renderHabits, renderHabitCategories } from './habits-render.js';
import { saveHabits, saveHabitCategories } from './habits-storage.js';
import { habitModalState } from './habits-modal-state.js';

// Custom Interval frequency ("repeat every N days") — 2 is the floor
// since 1 is just "Every Day" under a different name, and a generous
// but finite ceiling keeps the number sane for the streak/heatmap math.
function clampInterval(n) {
  if (Number.isNaN(n)) {return 3;}
  return Math.min(365, Math.max(2, n));
}

export function setupHabitModalSave() {
  const saveHabitBtn = document.getElementById('save-habit-btn');
  const habitCategoryInput = document.getElementById('habit-category-input');
  const habitModal = document.getElementById('habit-modal');

  if (!saveHabitBtn) {return;}

  saveHabitBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('habit-name-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const categoryRaw = habitCategoryInput ? habitCategoryInput.value.trim() : '';
    // FIX: reuse an existing category's exact casing if one matches
    // case-insensitively, so typing "health" when "Health" already
    // exists doesn't create a second, visually duplicate category.
    const existingCategory = categoryRaw
    ? savedHabitCategories.find(c => c.toLowerCase() === categoryRaw.toLowerCase())
    : null;
    const category = categoryRaw === '' ? 'Uncategorized' : (existingCategory || categoryRaw);
    const freqValueInput = document.getElementById('habit-frequency-value');
    const frequency = freqValueInput ? freqValueInput.value : 'everyday';

    const color = habitModalState.selectedHabitColor || '#3b82f6';

    const selectedIcon = document.querySelector('.icon-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : 'book';

    const customDays = [];
    if (frequency === 'custom') {
      document.querySelectorAll('.day-option.selected').forEach(d => {
          customDays.push(parseInt(d.dataset.day));
        });
      if (customDays.length === 0) {
        showToast('Please select at least one day.', 'warning');
        return;
      }
    }

    let intervalDays = 3;
    if (frequency === 'interval') {
      const intervalInput = document.getElementById('habit-interval-input');
      intervalDays = clampInterval(intervalInput ? parseInt(intervalInput.value, 10) : NaN);
      if (intervalInput) {intervalInput.value = intervalDays;}
    }

    if (!name) {
      showToast('Please enter a habit name', 'warning');
      return;
    }

    const editingHabitId = habitModalState.editingHabitId;

    if (editingHabitId) {
      // Update existing habit
      const habitIndex = habits.findIndex(h => h.id === editingHabitId);
      if (habitIndex > -1) {
        habits[habitIndex].name = name;
        habits[habitIndex].category = category;
        habits[habitIndex].frequency = frequency;
        habits[habitIndex].color = color;
        habits[habitIndex].icon = icon;
        if (frequency === 'custom') {habits[habitIndex].customDays = customDays;}
        if (frequency === 'interval') {habits[habitIndex].intervalDays = intervalDays;}

        // Also sync custom category to savedHabitCategories on EDIT
        if (category && category.trim() !== '' && category !== 'Uncategorized' && !savedHabitCategories.includes(category)) {
          setSavedHabitCategories([...savedHabitCategories, category]);
          saveHabitCategories();
        }
      }
    } else {
      // Create brand new habit
      const newHabit = {
        id: generateId(),
        name: name,
        category: category,
        frequency: frequency,
        customDays: frequency === 'custom' ? customDays : [],
        intervalDays: frequency === 'interval' ? intervalDays : undefined,
        color: color,
        icon: icon,
        logs: {},
        // Setting createdAt slightly in the past allows immediate scheduling
        createdAt: new Date(new Date().setHours(0,0,0,0)).toISOString()
      };
      setHabits([...habits, newHabit]);

      if (category && category.trim() !== '' && category !== 'Uncategorized' && !savedHabitCategories.includes(category)) {
        setSavedHabitCategories([...savedHabitCategories, category]);
        saveHabitCategories();
      }
    }

    saveHabits();

    if (habitModal) {habitModal.classList.remove('show');}
    showToast(editingHabitId ? 'Habit Updated!' : 'Habit Created!', 'success');

    renderHabits();
    renderHabitCategories();
  });
}
