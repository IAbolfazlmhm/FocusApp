// ==========================================
// HABIT MODAL — OPEN / CLOSE
// ==========================================
// Populating the modal for editing an existing habit, resetting it for
// a brand new one, and closing it. See habits-modal-state.js for the
// shared editingHabitId/selectedHabitColor this coordinates with, and
// habits-modal-pickers.js / habits-modal-frequency.js / habits-modal-save.js
// for the rest of this same modal's logic.

import { habits } from '../core/state.js';
import { habitModalState, setCustomSwatchSelected } from './habits-modal-state.js';

function openHabitEditModal(habitId) {
  const habitToEdit = habits.find(h => h.id === habitId);
  if (!habitToEdit) {return;}

  habitModalState.editingHabitId = habitId;
  document.getElementById('habit-modal-title').innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Edit Habit';

  document.getElementById('habit-name-input').value = habitToEdit.name || '';
  document.getElementById('habit-category-input').value = habitToEdit.category || '';

  const fVal = habitToEdit.frequency || 'everyday';
  const freqValueInput = document.getElementById('habit-frequency-value');
  freqValueInput.value = fVal;
  // FIX: was missing the 7 single-day entries (monday..sunday), so
  // editing a habit set to e.g. "Every Monday" showed the raw value
  // "monday" as its display text instead of matching what the
  // dropdown itself labels that option.
  const displayMap = {
    everyday: 'Every Day', weekly: 'Once a Week', biweekly: 'Every 2 Weeks',
    monday: 'Every Monday', tuesday: 'Every Tuesday', wednesday: 'Every Wednesday',
    thursday: 'Every Thursday', friday: 'Every Friday', saturday: 'Every Saturday',
    sunday: 'Every Sunday', custom: 'Custom Days...'
  };
  document.getElementById('habit-frequency-input-display').value = displayMap[fVal] || fVal;
  // FIX: setting .value above doesn't fire 'change' on its own, and
  // setupSelectDropdown()'s aria-selected sync (dropdown.js) only runs
  // on that event — without this, reopening the dropdown for editing
  // always showed "Every Day" highlighted regardless of the habit's
  // real frequency, since nothing had re-synced it since page load.
  freqValueInput.dispatchEvent(new Event('change'));

  const colorOptions = document.querySelectorAll('.color-option');
  const iconOptions = document.querySelectorAll('.icon-option');
  const dayOptions = document.querySelectorAll('.day-option');
  const habitColorCustomInput = document.getElementById('habit-color-custom');
  const habitColorCustomWrapper = document.getElementById('habit-color-custom-wrapper');

  colorOptions.forEach(opt => {
    const selected = opt.dataset.color === habitToEdit.color;
    opt.classList.toggle('selected', selected);
    opt.setAttribute('aria-pressed', String(selected));
  });
  setCustomSwatchSelected(false);
  habitModalState.selectedHabitColor = habitToEdit.color || colorOptions[0]?.dataset.color || '#3b82f6';
  if (habitColorCustomInput) {
    habitColorCustomInput.value = habitModalState.selectedHabitColor;
    habitColorCustomWrapper?.style.setProperty('--custom-color', habitModalState.selectedHabitColor);
    // No preset swatch matched this habit's color — it was picked via
    // the custom input, so mark that swatch as the selected one instead.
    if (!Array.from(colorOptions).some(opt => opt.dataset.color === habitToEdit.color)) {
      setCustomSwatchSelected(true);
    }
  }
  iconOptions.forEach(opt => {
    const selected = opt.dataset.icon === habitToEdit.icon;
    opt.classList.toggle('selected', selected);
    opt.setAttribute('aria-pressed', String(selected));
  });

  if (fVal === 'custom') {
    document.getElementById('custom-days-picker').style.display = 'flex';
    dayOptions.forEach(d => {
      const selected = !!(habitToEdit.customDays && habitToEdit.customDays.includes(parseInt(d.dataset.day, 10)));
      d.classList.toggle('selected', selected);
      d.setAttribute('aria-pressed', String(selected));
    });
    const repeatEvery = habitToEdit.repeatEvery || { value: 1, unit: 'week' };
    const repeatEveryInput = document.getElementById('habit-repeat-every-input');
    if (repeatEveryInput) {repeatEveryInput.value = repeatEvery.value || 1;}
    const repeatUnitValue = document.getElementById('habit-repeat-unit-value');
    const repeatUnitDisplay = document.getElementById('habit-repeat-unit-display');
    const isMonth = repeatEvery.unit === 'month';
    if (repeatUnitValue) {repeatUnitValue.value = isMonth ? 'month' : 'week';}
    if (repeatUnitDisplay) {repeatUnitDisplay.value = isMonth ? 'Month(s)' : 'Week(s)';}
  } else {
    document.getElementById('custom-days-picker').style.display = 'none';
  }

  document.getElementById('habit-modal').classList.add('show');
}

export function setupHabitModalOpenClose() {
  const habitListContainer = document.getElementById('habit-list-container');
  const openAddHabitBtn = document.getElementById('open-add-habit-btn');
  const habitModal = document.getElementById('habit-modal');
  const closeHabitModalBtn = document.getElementById('close-habit-modal');
  const habitCategoryInput = document.getElementById('habit-category-input');
  const colorOptions = document.querySelectorAll('.color-option');
  const iconOptions = document.querySelectorAll('.icon-option');
  const dayOptions = document.querySelectorAll('.day-option');
  const habitColorCustomInput = document.getElementById('habit-color-custom');
  const habitColorCustomWrapper = document.getElementById('habit-color-custom-wrapper');

  // Habit Item Click (to Edit) — attached once here, not inside
  // renderHabits(), so it never accumulates across re-renders.
  // Delegation on the container still works correctly even though the
  // habit cards inside get replaced on every render.
  if (habitListContainer) {
    habitListContainer.addEventListener('click', (e) => {
      const habitItem = e.target.closest('.habit-item');
      if (!habitItem) {return;}
      // If they clicked the actions (Done/Skip/Delete), let the existing logic run.
      if (e.target.closest('.task-actions')) {return;}
      // Otherwise, they clicked the card to edit:
      openHabitEditModal(habitItem.dataset.id);
    });

    // Keyboard equivalent of the click handler above (see the
    // tabIndex/role="button" added to each card in renderHabits()).
    habitListContainer.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') {return;}
      const habitItem = e.target.closest('.habit-item');
      if (!habitItem) {return;}
      if (e.target.closest('.task-actions')) {return;}
      e.preventDefault();
      openHabitEditModal(habitItem.dataset.id);
    });
  }

  // Modal Triggers
  if (openAddHabitBtn) {
    openAddHabitBtn.addEventListener('click', () => {
      habitModalState.editingHabitId = null; // CRITICAL: Tells the form we are creating, not editing
      document.getElementById('habit-modal-title').innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Create Habit';

      // Sync Quick Input to Modal
      const quickInput = document.getElementById('quick-habit-input');
      const nameInput = document.getElementById('habit-name-input');
      if (nameInput) {
        nameInput.value = quickInput ? quickInput.value.trim() : '';
      }
      if (habitCategoryInput) {habitCategoryInput.value = '';}

      // Reset frequency to default (Every Day)
      const freqInputDisplay = document.getElementById('habit-frequency-input-display');
      if (freqInputDisplay) {freqInputDisplay.value = 'Every Day';}

      // Set hidden frequency value to "everyday" for form submission
      const freqValue = document.getElementById('habit-frequency-value');
      if (freqValue) {
        freqValue.value = 'everyday';
        // FIX: same aria-selected desync as openHabitEditModal above —
        // without this, creating a new habit right after editing one set
        // to e.g. "Every Monday" kept that option highlighted in the
        // dropdown even though the value here is genuinely back to
        // "everyday".
        freqValue.dispatchEvent(new Event('change'));
      }

      // Reset color and icon selections
      const customDaysPicker = document.getElementById('custom-days-picker');
      if (customDaysPicker) {customDaysPicker.style.display = 'none';}
      const repeatEveryResetInput = document.getElementById('habit-repeat-every-input');
      if (repeatEveryResetInput) {repeatEveryResetInput.value = 1;}
      const repeatUnitResetValue = document.getElementById('habit-repeat-unit-value');
      const repeatUnitResetDisplay = document.getElementById('habit-repeat-unit-display');
      if (repeatUnitResetValue) {repeatUnitResetValue.value = 'week';}
      if (repeatUnitResetDisplay) {repeatUnitResetDisplay.value = 'Week(s)';}
      dayOptions.forEach(d => {
        d.classList.remove('selected');
        d.setAttribute('aria-pressed', 'false');
      });

      // FIX: this reset never actually happened — a comment claimed the
      // color/icon pickers were being reset to the first option, but no
      // code did it, so creating a new habit right after editing one
      // silently kept showing the previously-edited habit's color/icon
      // as "selected" (just visually stale; the swatch/icon under the
      // ring didn't match what would actually be saved until the user
      // clicked one). Default color is the first preset option.
      colorOptions.forEach((opt, i) => {
        const selected = i === 0;
        opt.classList.toggle('selected', selected);
        opt.setAttribute('aria-pressed', String(selected));
      });
      setCustomSwatchSelected(false);
      habitModalState.selectedHabitColor = colorOptions[0]?.dataset.color || '#3b82f6';
      if (habitColorCustomInput) {habitColorCustomInput.value = habitModalState.selectedHabitColor;}
      habitColorCustomWrapper?.style.setProperty('--custom-color', habitModalState.selectedHabitColor);
      iconOptions.forEach((opt, i) => {
        const selected = i === 0;
        opt.classList.toggle('selected', selected);
        opt.setAttribute('aria-pressed', String(selected));
      });

      if (habitModal) {habitModal.classList.add('show');}
    });
  }

  if (closeHabitModalBtn) {
    closeHabitModalBtn.addEventListener('click', () => {
      if (habitModal) {habitModal.classList.remove('show');}

      // If we were creating a new habit (not editing), sync the name back to the quick input
      if (!habitModalState.editingHabitId) {
        const nameInput = document.getElementById('habit-name-input');
        const quickInput = document.getElementById('quick-habit-input');
        if (nameInput && quickInput) {
          quickInput.value = nameInput.value.trim();
        }
      }
    });
  }

  if (habitModal) {
    habitModal.addEventListener('click', (e) => {
      if (e.target === habitModal) {habitModal.classList.remove('show');}
    });
  }

  // Allow 'Enter' key to save the main habit modal (FAIL-SAFE VERSION)
  const hInput = document.getElementById('habit-name-input');
  const hSaveBtn = document.getElementById('save-habit-btn');
  if (hInput && hSaveBtn) {
    hInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        hSaveBtn.click();
      }
    });
  }
}
