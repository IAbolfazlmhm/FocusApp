// ==========================================
// TASK SORT BUTTON
// ==========================================
// Opening, closing, keyboard navigation, and ARIA now live in the shared
// setupSelectDropdown() (dropdown.js). This also switches the dropdown
// from a raw inline style.display toggle onto the .show class the CSS
// already defines for every .custom-dropdown (including its popIn
// animation), which this dropdown was previously bypassing.
import { currentSort, setCurrentSort, sortOrder, setSortOrder } from '../../core/state.js';
import { setupSelectDropdown } from '../../shared/dropdown/dropdown.js';
import { renderTasks } from './tasks-render.js';

export function setupTaskSort() {
  const taskSortBtn = document.getElementById('task-sort-btn');
  const sortDropdown = document.getElementById('sort-dropdown');

  if (!taskSortBtn || !sortDropdown) {return;}

  sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const clickedSort = item.getAttribute('data-sort');
      if (currentSort === clickedSort) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setCurrentSort(clickedSort);
        setSortOrder((clickedSort === 'az' || clickedSort === 'tag') ? 'asc' : 'desc');
      }

      // Clear old arrows and active states
      sortDropdown.querySelectorAll('.dropdown-item').forEach(i => {
        i.classList.remove('active-sort');
        i.querySelector('.sort-dir').textContent = '';
      });

      // Add active state and arrow to clicked item
      item.classList.add('active-sort');
      item.querySelector('.sort-dir').textContent = sortOrder === 'asc' ? '↑' : '↓';

      sortDropdown.classList.remove('show');
      renderTasks();
    });
  });

  setupSelectDropdown({ wrapperId: 'task-sort-wrapper', triggerId: 'task-sort-btn', dropdownId: 'sort-dropdown' });
}
