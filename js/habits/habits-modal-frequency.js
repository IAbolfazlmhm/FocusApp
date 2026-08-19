// ==========================================
// HABIT MODAL — FREQUENCY (repeat schedule)
// ==========================================
// The frequency dropdown (Every Day / Once a Week / .../ Custom Days /
// Custom Interval) and the two pickers it reveals. Read/validated at
// save time by habits-modal-save.js; scheduling itself is
// habits-logic.js's isHabitActiveOnDate().

import { setupSelectDropdown } from '../ui/dropdown.js';
import { setupStepperButtons } from '../ui/stepper-utils.js';

export function setupHabitFrequencyPicker() {
  // --- CUSTOM FREQUENCY DROPDOWN LOGIC ---
  // Opening, closing, keyboard navigation, and ARIA now live in the
  // shared setupSelectDropdown() (dropdown.js) — this block keeps only
  // the selection assignment specific to this dropdown (display text,
  // hidden value, and showing/hiding the custom-days/interval pickers).
  const freqInputDisplay = document.getElementById('habit-frequency-input-display');
  const freqValue = document.getElementById('habit-frequency-value');
  const freqDropdown = document.getElementById('habit-frequency-dropdown');
  const customDaysPicker = document.getElementById('custom-days-picker');
  const customIntervalPicker = document.getElementById('custom-interval-picker');
  const dayOptions = document.querySelectorAll('.day-option');

  if (freqInputDisplay && freqDropdown) {
    freqDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-val');
        const text = item.textContent;

        freqInputDisplay.value = text;
        if (freqValue) {
          freqValue.value = val;
          // FIX: setting .value here doesn't fire 'change' on its own —
          // setupSelectDropdown()'s syncSelectedState() (dropdown.js)
          // listens for that event to know which item to mark
          // aria-selected, so without this the dropdown kept showing
          // "Every Day" highlighted no matter what was actually picked.
          // settings.js's equivalent dropdowns already dispatch this;
          // this one just hadn't been wired the same way.
          freqValue.dispatchEvent(new Event('change'));
        }

        freqDropdown.classList.remove('show');

        if (customDaysPicker) {
          customDaysPicker.style.display = (val === 'custom') ? 'flex' : 'none';
        }
        if (customIntervalPicker) {
          customIntervalPicker.style.display = (val === 'interval') ? 'flex' : 'none';
        }
      });
    });

    setupSelectDropdown({
      wrapperId: 'habit-frequency-wrapper',
      triggerId: 'habit-frequency-input-display',
      dropdownId: 'habit-frequency-dropdown',
      valueInputId: 'habit-frequency-value'
    });
  }

  // --- CUSTOM INTERVAL STEPPER (+/-) ---
  // Same press-and-hold pattern as the Pomodoro settings duration
  // stepper (settings.js's setupDurationStepper) — kept small and
  // inline here since it's the only stepper habits.js owns.
  setupStepperButtons('habit-interval-minus', 'habit-interval-plus', 'habit-interval-input', 2, 365);

  // Custom Days Interaction
  dayOptions.forEach(day => {
    day.addEventListener('click', () => {
      const nowSelected = !day.classList.contains('selected');
      day.classList.toggle('selected', nowSelected);
      day.setAttribute('aria-pressed', String(nowSelected));
    });
  });
}
