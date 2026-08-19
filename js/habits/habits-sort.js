// ==========================================
// HABIT SORT BUTTON
// ==========================================
// Opening, closing, keyboard navigation, and ARIA now live in the
// shared setupSelectDropdown() (dropdown.js). This also switches the
// dropdown from a raw inline style.display toggle onto the .show
// class the CSS already defines for every .custom-dropdown (including
// its popIn animation), which this dropdown was previously bypassing.
import { currentHabitSort, setCurrentHabitSort, habitSortOrder, setHabitSortOrder } from '../core/state.js';
import { setupSelectDropdown } from '../ui/dropdown.js';
import { renderHabits } from './habits-render.js';

export function setupHabitSort() {
  const habitSortBtn = document.getElementById('habit-sort-btn');
  const habitSortDropdown = document.getElementById('habit-sort-dropdown');

  if (!habitSortBtn || !habitSortDropdown) {return;}

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
          i.querySelector('.sort-dir').textContent = '';
        });

      item.classList.add('active-sort');
      item.querySelector('.sort-dir').textContent = habitSortOrder === 'asc' ? '↑' : '↓';

      habitSortDropdown.classList.remove('show');
      renderHabits();
    });
  });

  setupSelectDropdown({ wrapperId: 'habit-sort-wrapper', triggerId: 'habit-sort-btn', dropdownId: 'habit-sort-dropdown' });
}
