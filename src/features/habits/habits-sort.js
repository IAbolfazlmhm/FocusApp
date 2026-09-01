// ==========================================
// HABIT SORT BUTTON
// ==========================================
// Opening, closing, keyboard navigation, and ARIA now live in the
// shared setupSelectDropdown() (dropdown.js). This also switches the
// dropdown from a raw inline style.display toggle onto the .show
// class the CSS already defines for every .custom-dropdown (including
// its popIn animation), which this dropdown was previously bypassing.
import { currentHabitSort, setCurrentHabitSort, habitSortOrder, setHabitSortOrder } from '../../core/state.js';
import { setupSelectDropdown } from '../../shared/dropdown/dropdown.js';
import { renderHabits } from './habits-render.js';
import { saveHabitViewPrefs } from './habits-storage.js';

export function setupHabitSort() {
  const habitSortBtn = document.getElementById('habit-sort-btn');
  const habitSortDropdown = document.getElementById('habit-sort-dropdown');

  if (!habitSortBtn || !habitSortDropdown) {return;}

  // Sync initial visual state with persisted sort preferences
  habitSortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    const isCurrent = item.dataset.sort === currentHabitSort;
    item.classList.toggle('active-sort', isCurrent);
    const sortDir = item.querySelector('.sort-dir');
    if (sortDir) {
      sortDir.textContent = isCurrent ? (habitSortOrder === 'asc' ? '↑' : '↓') : '';
    }
  });

  habitSortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const clickedSort = item.getAttribute('data-sort');
      if (currentHabitSort === clickedSort) {
        setHabitSortOrder(habitSortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setCurrentHabitSort(clickedSort);
        setHabitSortOrder((clickedSort === 'az' || clickedSort === 'category') ? 'asc' : 'desc');
      }

      habitSortDropdown.querySelectorAll('.dropdown-item').forEach(i => {
        i.classList.remove('active-sort');
        const dirSpan = i.querySelector('.sort-dir');
        if (dirSpan) {dirSpan.textContent = '';}
      });

      item.classList.add('active-sort');
      const activeDirSpan = item.querySelector('.sort-dir');
      if (activeDirSpan) {activeDirSpan.textContent = habitSortOrder === 'asc' ? '↑' : '↓';}

      habitSortDropdown.classList.remove('show');
      saveHabitViewPrefs();
      renderHabits();
    });
  });

  setupSelectDropdown({ wrapperId: 'habit-sort-wrapper', triggerId: 'habit-sort-btn', dropdownId: 'habit-sort-dropdown' });
}
