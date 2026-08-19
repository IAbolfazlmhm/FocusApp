// ==========================================
// DATE NAVIGATION (Habits tab)
// ==========================================
import { currentHabitDate, setCurrentHabitDate } from '../core/state.js';
import { renderHabits } from './habits-render.js';

// Also used by habits.js's setHabitDate() (the Progress tab's "go to
// this day" deep link) — kept here rather than in habits.js itself
// since every other consumer of it lives in this file, and habits.js
// already needs to import setupHabitDateNav FROM here to wire it up;
// the reverse import would create a cycle.
export function updateDateDisplayUI() {
  const dateDisplayBtn = document.getElementById('habit-date-display');
  if (!dateDisplayBtn) {return;}

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate difference in days between selected date and actual today
  const diffTime = currentHabitDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    dateDisplayBtn.textContent = 'Today';
  } else if (diffDays === -1) {
    dateDisplayBtn.textContent = 'Yesterday';
  } else if (diffDays === 1) {
    dateDisplayBtn.textContent = 'Tomorrow';
  } else {
    // If it's further away, format it nicely (e.g., "Jun 5")
    const options = { month: 'short', day: 'numeric' };
    dateDisplayBtn.textContent = currentHabitDate.toLocaleDateString('en-US', options);
  }
}

export function setupHabitDateNav() {
  const prevDayBtn = document.getElementById('prev-day-btn');
  const nextDayBtn = document.getElementById('next-day-btn');

  if (prevDayBtn) {
    prevDayBtn.addEventListener('click', () => {
      const newDate = new Date(currentHabitDate);
      newDate.setDate(newDate.getDate() - 1);
      setCurrentHabitDate(newDate); // Updates the global state

      updateDateDisplayUI(); // Updates the text (Yesterday, Jun 4, etc.)
      renderHabits();        // Renders the habits for that specific day
    });
  }

  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      const newDate = new Date(currentHabitDate);
      newDate.setDate(newDate.getDate() + 1);
      setCurrentHabitDate(newDate);

      updateDateDisplayUI();
      renderHabits();
    });
  }

  // --- NATIVE DATE PICKER LOGIC ---
  const dateDisplayBtn = document.getElementById('habit-date-display');
  const nativeDatePicker = document.getElementById('native-date-picker');

  // 1. Open Native Picker on Click
  if (dateDisplayBtn && nativeDatePicker) {
    dateDisplayBtn.addEventListener('click', () => {
      try {
        nativeDatePicker.showPicker(); // Works in modern browsers
      } catch {
        nativeDatePicker.click(); // Fallback
      }
    });

    // 2. Handle Date Selection from the Popup
    nativeDatePicker.addEventListener('change', (e) => {
      if (!e.target.value) {return;}

      // value is formatted as "YYYY-MM-DD"
      const [year, month, day] = e.target.value.split('-').map(Number);

      // Set global state
      const newDate = new Date(year, month - 1, day);
      newDate.setHours(0, 0, 0, 0);
      setCurrentHabitDate(newDate); // Assuming you imported this from state.js

      updateDateDisplayUI();
      renderHabits();
    });
  }
}
