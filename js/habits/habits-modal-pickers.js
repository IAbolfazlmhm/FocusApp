// ==========================================
// HABIT MODAL — COLOR / ICON / CATEGORY PICKERS
// ==========================================
// The three "pick a value" controls inside the create/edit habit modal.
// See habits-modal-open.js for populating these when editing, and
// habits-modal-state.js for the shared selectedHabitColor this writes to.

import { savedHabitCategories } from '../core/state.js';
import { escapeHTML } from '../core/dom-utils.js';
import { registerOutsideClickTarget } from '../ui/dropdown.js';
import { habitModalState, setCustomSwatchSelected } from './habits-modal-state.js';

function showHabitCategoryDropdown(habitCategoryInput, habitCategoryDropdown) {
  if (!habitCategoryInput || !habitCategoryDropdown) {return;}
  const val = habitCategoryInput.value.toLowerCase().trim();

  // Ignore empty and Uncategorized
  const validCats = savedHabitCategories.filter(c => c && c.trim() !== '' && c !== 'Uncategorized');
  const filteredCats = validCats.filter(c => c.toLowerCase().includes(val));

  if (filteredCats.length === 0) {
    habitCategoryDropdown.classList.remove('show');
    return;
  }

  // FIX: options here are regenerated on every keystroke (innerHTML =
  // below), so role/tabindex must be part of the template itself rather
  // than set once at setup time — unlike the app's other dropdowns,
  // whose static item lists only need that done once.
  habitCategoryDropdown.innerHTML = filteredCats.map(cat =>
    `<div class="dropdown-item" role="option" tabindex="-1">${escapeHTML(cat)}</div>`
  ).join('');

  habitCategoryDropdown.classList.add('show');

  habitCategoryDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      habitCategoryInput.value = item.textContent;
      habitCategoryDropdown.classList.remove('show');
      habitCategoryInput.focus();
    });
  });
}

export function setupHabitModalPickers() {
  const colorOptions = document.querySelectorAll('.color-option');
  const habitColorCustomInput = document.getElementById('habit-color-custom');
  const habitColorCustomWrapper = document.getElementById('habit-color-custom-wrapper');
  const iconOptions = document.querySelectorAll('.icon-option');
  const habitCategoryInput = document.getElementById('habit-category-input');
  const habitCategoryDropdown = document.getElementById('habit-category-dropdown');
  const habitCategoryWrapper = document.getElementById('habit-category-wrapper');

  // Modal Pickers
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      colorOptions.forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-pressed', 'false');
      });
      setCustomSwatchSelected(false);
      option.classList.add('selected');
      option.setAttribute('aria-pressed', 'true');
      habitModalState.selectedHabitColor = option.dataset.color;
      if (habitColorCustomInput) {habitColorCustomInput.value = habitModalState.selectedHabitColor;}
      habitColorCustomWrapper?.style.setProperty('--custom-color', habitModalState.selectedHabitColor);
    });
  });

  // Custom color input — same native-picker pattern as Pomodoro tag
  // colors, so any color is reachable, not just the 5 presets.
  if (habitColorCustomInput) {
    habitColorCustomInput.addEventListener('input', () => {
      colorOptions.forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-pressed', 'false');
      });
      setCustomSwatchSelected(true);
      habitModalState.selectedHabitColor = habitColorCustomInput.value;
      habitColorCustomWrapper?.style.setProperty('--custom-color', habitModalState.selectedHabitColor);
    });
  }

  iconOptions.forEach(option => {
    option.addEventListener('click', () => {
      iconOptions.forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-pressed', 'false');
      });
      option.classList.add('selected');
      option.setAttribute('aria-pressed', 'true');
    });
  });

  // Categories Auto-Clear & Dropdown
  if (habitCategoryInput) {
    const openDropdown = () => showHabitCategoryDropdown(habitCategoryInput, habitCategoryDropdown);
    habitCategoryInput.addEventListener('input', openDropdown);
    habitCategoryInput.addEventListener('focus', function() {
      if (this.value === 'Uncategorized') {this.value = '';} // Clear default easily
      openDropdown();
    });

    // FIX: this dropdown's options regenerate on every keystroke, so
    // it doesn't fit the shared setupSelectDropdown() (dropdown.js)
    // used by the app's other 7 dropdowns — that assumes a stable
    // option list and a trigger the dropdown opens FROM. Here the
    // list is already opened by 'input'/'focus' above, so it gets its
    // own small keyboard layer instead, attached once to the input
    // and the dropdown container (both persist across re-renders).
    if (habitCategoryDropdown) {
      habitCategoryDropdown.setAttribute('role', 'listbox');
      habitCategoryInput.setAttribute('role', 'combobox');
      habitCategoryInput.setAttribute('aria-autocomplete', 'list');
      habitCategoryInput.setAttribute('aria-controls', 'habit-category-dropdown');
      habitCategoryInput.setAttribute('aria-expanded', 'false');

      new MutationObserver(() => {
        habitCategoryInput.setAttribute('aria-expanded', String(habitCategoryDropdown.classList.contains('show')));
      }).observe(habitCategoryDropdown, { attributes: true, attributeFilter: ['class'] });

      habitCategoryInput.addEventListener('keydown', (e) => {
        if (!habitCategoryDropdown.classList.contains('show')) {return;}
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          habitCategoryDropdown.querySelector('.dropdown-item')?.focus();
        } else if (e.key === 'Escape') {
          habitCategoryDropdown.classList.remove('show');
        }
      });

      habitCategoryDropdown.addEventListener('keydown', (e) => {
        const items = Array.from(habitCategoryDropdown.querySelectorAll('.dropdown-item'));
        const currentIndex = items.indexOf(document.activeElement);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[Math.min(currentIndex + 1, items.length - 1)]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentIndex <= 0) {habitCategoryInput.focus();}
          else {items[currentIndex - 1]?.focus();}
        } else if (e.key === 'Home') {
          e.preventDefault();
          items[0]?.focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          items[items.length - 1]?.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.activeElement?.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          habitCategoryDropdown.classList.remove('show');
          habitCategoryInput.focus();
        }
      });
      registerOutsideClickTarget(habitCategoryWrapper, habitCategoryDropdown);
    }
  }
}
