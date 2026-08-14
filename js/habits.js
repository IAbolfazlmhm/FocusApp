import {
  habits, savedHabitCategories, currentHabitDate,
  setCurrentHabitDate, setHabits, setSavedHabitCategories
} from './state.js';

import { showToast, escapeHTML, generateId, centerButtonInScrollArea, setupSelectDropdown, customConfirm, registerOutsideClickTarget, setupHorizontalWheelScroll, hexToRgba, isValidHexColor, keepInputVisibleOnMobileKeyboard } from './ui-utils.js';
import { startQuoteRotation } from './motivation.js';
import { writeJSON, readRaw, STORAGE_KEYS } from './storage.js';

// ==========================================
// CENTRALIZED PERSISTENCE
// ==========================================
// Previously, "localStorage.setItem('focusHabits', JSON.stringify(habits))"
// was copy-pasted at 6 different call sites across this file. That meant
// every future change to habits had to remember to duplicate this line
// again, and a missed spot would silently desync what's on screen from
// what's saved. Centralizing it here means there is exactly one place
// that knows how habits get persisted.
export function saveHabits() {
  writeJSON(STORAGE_KEYS.HABITS, habits);
}

export function saveHabitCategories() {
  writeJSON(STORAGE_KEYS.HABIT_CATEGORIES, savedHabitCategories);
}

// ==========================================
// BULLETPROOF DATE HELPER
// ==========================================
// FIX: this used to be `dayjs(dateObj).format('YYYY-MM-DD')`, pulling in
// the whole dayjs library (loaded from a CDN <script> tag in index.html)
// just for local-date formatting. That's a third-party network
// dependency and a global (`dayjs`) the module relies on implicitly
// without declaring it — if that CDN request is blocked, slow, or the
// tag ever gets removed, every habit feature silently breaks with a
// "dayjs is not defined" error. This does the exact same YYYY-MM-DD
// local-date formatting timer.js and tasks.js already do elsewhere in
// the app, with zero dependencies and zero network requests.
export function getDateKey(dateObj) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const habitListContainer = document.getElementById('habit-list-container');

const openAddHabitBtn = document.getElementById('open-add-habit-btn');
const habitModal = document.getElementById('habit-modal');
const closeHabitModalBtn = document.getElementById('close-habit-modal');
const saveHabitBtn = document.getElementById('save-habit-btn');

const colorOptions = document.querySelectorAll('.color-option');
const habitColorCustomInput = document.getElementById('habit-color-custom');
const habitColorCustomWrapper = document.getElementById('habit-color-custom-wrapper');
const iconOptions = document.querySelectorAll('.icon-option');
const dayOptions = document.querySelectorAll('.day-option');

const habitCategoryInput = document.getElementById('habit-category-input');
const habitCategoryDropdown = document.getElementById('habit-category-dropdown');
const habitCategoryWrapper = document.getElementById('habit-category-wrapper');

let editingHabitId = null;
let currentHabitSort = 'newest';
// Tracks the picked color independently of which DOM element is
// visually marked .selected — needed because the custom native color
// input has no dataset.color to read back at save time the way the
// preset swatches do.
let selectedHabitColor = colorOptions[0]?.dataset.color || '#3b82f6';

// The visible "selected" ring lives on the wrapper label (see
// .custom-color-swatch-wrapper.selected in tags.css) since the actual
// <input type="color"> is opacity:0 there — but the input still needs
// its own .selected class too, for the code below that reads "which
// swatch is currently selected" via a plain DOM query. One helper keeps
// both in sync instead of every call site remembering to toggle two
// elements.
function setCustomSwatchSelected(isSelected) {
  habitColorCustomInput?.classList.toggle('selected', isSelected);
  habitColorCustomWrapper?.classList.toggle('selected', isSelected);
}
let habitSortOrder = 'desc';
export let currentHabitFilter = 'all';

// ==========================================
// ICON DICTIONARY & HELPERS
// ==========================================
export const habitIconsDict = {
  'book': `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`,
  'activity': `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`,
  'droplet': `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>`,
  'heart': `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>`,
  'star': `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
  'coffee': `<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>`,
  'moon': `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
  'sun': `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
  'monitor': `<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`,
  'music': `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`
};

// ==========================================
// DATE NAVIGATION LOGIC
// ==========================================
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

// ==========================================
// CATEGORY LOGIC
// ==========================================
function showHabitCategoryDropdown() {
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

// ==========================================
// RENDER HABITS
// ==========================================
export function renderHabits() {
  if (!habitListContainer) {return;}
  habitListContainer.innerHTML = '';

  const activeHabits = habits.filter(habit => isHabitActiveOnDate(habit, currentHabitDate));
  const dateStr = getDateKey(currentHabitDate);

  // Safely Apply Filtering
  const filteredHabits = activeHabits.filter(h => {
    const status = (h.logs && h.logs[dateStr]) ? h.logs[dateStr] : null;
    if (status === 'hidden') {return false;}
    if (currentHabitFilter === 'active') {return status !== 'done' && status !== 'skipped';}
    if (currentHabitFilter === 'done') {return status === 'done';}
    if (currentHabitFilter !== 'all') {return h.category === currentHabitFilter;}
    return true;
  });

  // Safely Apply Sorting (Done/Skipped automatically sink to the bottom)
  filteredHabits.sort((a, b) => {
    const statusA = (a.logs && a.logs[dateStr]) ? a.logs[dateStr] : null;
    const statusB = (b.logs && b.logs[dateStr]) ? b.logs[dateStr] : null;
    const isCompletedA = (statusA === 'done' || statusA === 'skipped');
    const isCompletedB = (statusB === 'done' || statusB === 'skipped');

    // 1. Primary Sort: Sink completed to bottom
    if (isCompletedA !== isCompletedB) {return isCompletedA ? 1 : -1;}

    // 2. Secondary Sort: User's chosen order
    let val = 0;
    if (currentHabitSort === 'newest') {val = new Date(a.createdAt || a.id).getTime() - new Date(b.createdAt || b.id).getTime();}
    else if (currentHabitSort === 'az') {val = a.name.localeCompare(b.name);}
    else if (currentHabitSort === 'category') {val = (a.category || '').localeCompare(b.category || '');}
    else if (currentHabitSort === 'streak') {val = calculateStreak(a) - calculateStreak(b);}

    return habitSortOrder === 'asc' ? val : -val;
  });

  if (!filteredHabits || filteredHabits.length === 0) {
    habitListContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <p>No habits scheduled for this day.</p>
      </div>
    `;
    return;
  }

  // Habit Item Click (to Edit) — attached once in setupHabitsEvents(), not here.
  // (Previously this whole listener lived inside renderHabits(), which runs
  // after nearly every action — add, complete, delete, skip. Since the
  // container element itself is never recreated, only its children, every
  // re-render was stacking ANOTHER click listener on the same container.
  // After enough actions, a single click on a habit would fire the "open
  // edit modal" logic multiple times in a row.)

  // Built up in a fragment and appended once — see the matching comment
  // in tasks.js's renderTasks(), which has the same pattern.
  const fragment = document.createDocumentFragment();

  filteredHabits.forEach(habit => {
    const currentStreak = calculateStreak(habit);
    const status = habit.logs && habit.logs[dateStr] ? habit.logs[dateStr] : null;

    const habitDiv = document.createElement('div');
    habitDiv.className = 'task-item habit-item';
    habitDiv.dataset.id = habit.id;

    if (status === 'done') {
      habitDiv.classList.add('completed');
    } else if (status === 'skipped') {
      habitDiv.style.opacity = '0.5';
    }

    // --- RESTORED ORIGINAL VARIABLES ---
    // Validated before use — see isValidHexColor in ui-utils.js for why
    // an unvalidated color string here would be a real injection risk,
    // not just a source of broken CSS, since it's interpolated straight
    // into a style="..." attribute below.
    const safeColor = isValidHexColor(habit.color) ? habit.color : '#3b82f6';
    const bgRgba = hexToRgba(safeColor, 0.15);
    const iconSvgContent = habitIconsDict[habit.icon] || `<circle cx="12" cy="12" r="10"/>`;

    // 1. Generate Category Pill (with ellipsis and optical padding fix)
    let catHTML = '';
    if (habit.category && habit.category !== 'Uncategorized') {
      catHTML = `<span class="habit-category-badge" title="${escapeHTML(habit.category)}">${escapeHTML(habit.category)}</span>`;
    }

    habitDiv.style.cursor = 'pointer';
    // FIX: same gap as task cards — clicking a card opens the edit
    // modal but there was no keyboard equivalent. See setupHabitsEvents()
    // below for the matching keydown handler.
    habitDiv.tabIndex = 0;
    habitDiv.setAttribute('role', 'button');
    habitDiv.setAttribute('aria-label', `Edit habit: ${habit.name}`);

    // 2. Pristine 2-Row Layout WITH Original Streak SVG
    habitDiv.innerHTML = `
      <div class="habit-info">

        <!-- Left Side: Original Icon Wrapper -->
        <div class="habit-icon-circle" style="--habit-bg:${bgRgba}; --habit-color:${safeColor};">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvgContent}</svg>
        </div>

        <!-- Right Side: Text Stack -->
        <div class="habit-details">

          <!-- Top Row: Habit Name -->
          <span class="habit-name" title="${escapeHTML(habit.name)}">${escapeHTML(habit.name)}</span>

          <!-- Bottom Row: Category & Original Streak SVG -->
          <div class="habit-meta-row">
            ${catHTML}
            <div class="streak-flame ${currentStreak > 0 ? 'active' : ''}" title="Current Streak">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
              <span>${currentStreak}</span>
            </div>
          </div>

        </div>
      </div>

      <div class="task-actions">
        <button class="remove-btn advanced-delete-btn" title="Delete Habit"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        <button class="focus-btn skip-habit-btn" title="Skip Today" data-sound="click"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg></button>
        <button class="done-btn done-habit-btn" title="Done!" data-sound="success"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
      </div>
    `;

    fragment.appendChild(habitDiv);
  });

  habitListContainer.appendChild(fragment);

  updateHabitProgress();
}

// ==========================================
// EVENTS SETUP
// ==========================================
export function setupHabitsEvents() {
  updateDateDisplayUI();

  // Habit Item Click (to Edit) — attached once here, not inside renderHabits(),
  // so it never accumulates across re-renders. Delegation on the container
  // still works correctly even though the habit cards inside get replaced
  // on every render.
  function openHabitEditModal(habitId) {
    const habitToEdit = habits.find(h => h.id === habitId);

    if (habitToEdit) {
      editingHabitId = habitId;
      document.getElementById('habit-modal-title').innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Edit Habit';

      document.getElementById('habit-name-input').value = habitToEdit.name || '';
      document.getElementById('habit-category-input').value = habitToEdit.category || '';

      const fVal = habitToEdit.frequency || 'everyday';
      document.getElementById('habit-frequency-value').value = fVal;
      const displayMap = { 'everyday':'Every Day', 'weekly':'Once a Week', 'biweekly':'Every 2 Weeks', 'custom':'Custom Days...' };
      document.getElementById('habit-frequency-input-display').value = displayMap[fVal] || fVal;

      colorOptions.forEach(opt => {
        const selected = opt.dataset.color === habitToEdit.color;
        opt.classList.toggle('selected', selected);
        opt.setAttribute('aria-pressed', String(selected));
      });
      setCustomSwatchSelected(false);
      selectedHabitColor = habitToEdit.color || colorOptions[0]?.dataset.color || '#3b82f6';
      if (habitColorCustomInput) {
        habitColorCustomInput.value = selectedHabitColor;
        habitColorCustomWrapper?.style.setProperty('--custom-color', selectedHabitColor);
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
      } else {
        document.getElementById('custom-days-picker').style.display = 'none';
      }

      document.getElementById('habit-modal').classList.add('show');
    }
  }

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

  // --- DATE NAVIGATION LOGIC ---
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

  // Modal Triggers
  if (openAddHabitBtn) {
    openAddHabitBtn.addEventListener('click', () => {
      editingHabitId = null; // CRITICAL: Tells the form we are creating, not editing
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
      if (freqValue) {freqValue.value = 'everyday';}

      // Reset color and icon selections
      if (customDaysPicker) {customDaysPicker.style.display = 'none';}
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
      selectedHabitColor = colorOptions[0]?.dataset.color || '#3b82f6';
      if (habitColorCustomInput) {habitColorCustomInput.value = selectedHabitColor;}
      habitColorCustomWrapper?.style.setProperty('--custom-color', selectedHabitColor);
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
      if (!editingHabitId) {
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
      selectedHabitColor = option.dataset.color;
      if (habitColorCustomInput) {habitColorCustomInput.value = selectedHabitColor;}
      habitColorCustomWrapper?.style.setProperty('--custom-color', selectedHabitColor);
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
      selectedHabitColor = habitColorCustomInput.value;
      habitColorCustomWrapper?.style.setProperty('--custom-color', selectedHabitColor);
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
    habitCategoryInput.addEventListener('input', showHabitCategoryDropdown);
    habitCategoryInput.addEventListener('focus', function() {
      if (this.value === 'Uncategorized') {this.value = '';} // Clear default easily
      showHabitCategoryDropdown();
    });

    // FIX: this dropdown's options regenerate on every keystroke, so
    // it doesn't fit the shared setupSelectDropdown() (ui-utils.js)
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

  // --- CUSTOM FREQUENCY DROPDOWN LOGIC ---
  // Opening, closing, keyboard navigation, and ARIA now live in the
  // shared setupSelectDropdown() (ui-utils.js) — this block keeps only
  // the selection assignment specific to this dropdown (display text,
  // hidden value, and showing/hiding the custom-days picker).
  const freqInputDisplay = document.getElementById('habit-frequency-input-display');
  const freqValue = document.getElementById('habit-frequency-value');
  const freqDropdown = document.getElementById('habit-frequency-dropdown');
  const customDaysPicker = document.getElementById('custom-days-picker');

  if (freqInputDisplay && freqDropdown) {
    freqDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-val');
        const text = item.textContent;

        freqInputDisplay.value = text;
        if (freqValue) {freqValue.value = val;}

        freqDropdown.classList.remove('show');

        if (customDaysPicker) {
          customDaysPicker.style.display = (val === 'custom') ? 'flex' : 'none';
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


  // Custom Days Interaction
  dayOptions.forEach(day => {
    day.addEventListener('click', () => {
      const nowSelected = !day.classList.contains('selected');
      day.classList.toggle('selected', nowSelected);
      day.setAttribute('aria-pressed', String(nowSelected));
    });
  });

  // Save Logic
  if (saveHabitBtn) {
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

      const color = selectedHabitColor || '#3b82f6';

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

      if (!name) {
        showToast('Please enter a habit name', 'warning');
        return;
      }

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
      if (typeof renderHabitCategories === 'function') {renderHabitCategories();}
    });
  }

  // --- HABIT ACTION BUTTONS (Done, Skip, Delete) ---
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
      settingsModal.classList.add('show');
    });
  }

  // --- HABIT SORT BUTTON LOGIC ---
  // Opening, closing, keyboard navigation, and ARIA now live in the
  // shared setupSelectDropdown() (ui-utils.js). This also switches the
  // dropdown from a raw inline style.display toggle onto the .show
  // class the CSS already defines for every .custom-dropdown (including
  // its popIn animation), which this dropdown was previously bypassing.
  const habitSortBtn = document.getElementById('habit-sort-btn');
  const habitSortDropdown = document.getElementById('habit-sort-dropdown');

  if (habitSortBtn && habitSortDropdown) {
    habitSortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const clickedSort = item.getAttribute('data-sort');
        if (currentHabitSort === clickedSort) {
          habitSortOrder = habitSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          currentHabitSort = clickedSort;
          habitSortOrder = (clickedSort === 'az' || clickedSort === 'category') ? 'asc' : 'desc';
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

  // --- CATEGORY MANAGEMENT LOGIC ---
  const manageCategoriesBtn = document.getElementById('manage-categories-btn');
  const categoriesModal = document.getElementById('categories-modal');
  const closeCategoriesModal = document.getElementById('close-categories-modal');
  const manageAddCategoryBtn = document.getElementById('manage-add-category-btn');
  const manageNewCategoryInput = document.getElementById('manage-new-category-input');
  const categoriesManagementList = document.getElementById('categories-management-list');

  function renderCategoriesManagement() {
    if (!categoriesManagementList) {return;}
    categoriesManagementList.innerHTML = '';

    // Filter out empty strings and the default category
    const validCategories = savedHabitCategories.filter(cat => cat && cat.trim() !== '' && cat !== 'Uncategorized');

    validCategories.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag-chip deletable';
      chip.setAttribute('aria-label', `Delete category ${cat}`);
      chip.textContent = cat;

      chip.addEventListener('click', () => {
        // Call the statically imported modal
        customConfirm(`Delete category "${cat}"?`, () => {
          // SECURE FIX: Mutate array using splice, do NOT reassign
          const targetIndex = savedHabitCategories.indexOf(cat);
          if (targetIndex > -1) {
            savedHabitCategories.splice(targetIndex, 1);
          }

          // Move habits to Uncategorized if their category is deleted
          habits.forEach(h => { if (h.category === cat) {h.category = 'Uncategorized';} });

          saveHabitCategories();
          saveHabits();

          if (currentHabitFilter === cat) {currentHabitFilter = 'all';}

          renderCategoriesManagement();
          renderHabitCategories();
          renderHabits();
        });
      });
      categoriesManagementList.appendChild(chip);
    });
  }

  if (manageCategoriesBtn && categoriesModal) {
    manageCategoriesBtn.addEventListener('click', () => {
      renderCategoriesManagement();
      categoriesModal.classList.add('show');
    });
  }

  if (closeCategoriesModal) {closeCategoriesModal.addEventListener('click', () => categoriesModal.classList.remove('show'));}

  if (manageAddCategoryBtn) {
    manageAddCategoryBtn.addEventListener('click', () => {
      if (!manageNewCategoryInput) {return;}
      const newCat = manageNewCategoryInput.value.trim();

      // Empty Warning
      if (!newCat) {
        showToast('Please enter a valid category name.', 'warning');
        return;
      }

      const alreadyExists = savedHabitCategories.some(c => c.toLowerCase() === newCat.toLowerCase());
      if (!alreadyExists) {
        const capitalizedCat = newCat.charAt(0).toUpperCase() + newCat.slice(1);
        setSavedHabitCategories([...savedHabitCategories, capitalizedCat]);
        saveHabitCategories();
        manageNewCategoryInput.value = '';
        renderCategoriesManagement();
        renderHabitCategories();
        showToast(`Category added`, 'success');
      } else {
        showToast('That category already exists.', 'warning');
      }
    });
  }

  // Allow 'Enter' key to add categories (FAIL-SAFE VERSION)
  const catInput = document.getElementById('manage-new-category-input');
  const catBtn = document.getElementById('manage-add-category-btn');
  if (catInput && catBtn) {
    catInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        catBtn.click();
      }
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

  // Initial Display (text only — renderHabits() is already called separately
  // during startup in script.js, so this no longer duplicates that render)
  updateDateDisplayUI();

  document.addEventListener('tabChanged', () => {
    if (readRaw(STORAGE_KEYS.ACTIVE_TAB) === '1') {updateHabitProgress();}
  });

  // --- ADVANCED HABIT DELETION LOGIC ---
  let habitToDeleteId = null;
  const deleteModal = document.getElementById('delete-habit-modal');

  // Helper function to safely save habits locally
  const saveHabitsLocal = () => {
    saveHabits();
    // Tell the rest of the app (like the Progress tab) that data changed
    document.dispatchEvent(new Event('dataUpdated'));
  };

  // 1. Open the Modal (And Play Sound!)
  if (habitListContainer) {
    habitListContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.advanced-delete-btn');
      if (deleteBtn) {
        const habitItem = e.target.closest('.habit-item');
        if (habitItem) {
          habitToDeleteId = habitItem.dataset.id;
          if (deleteModal) {deleteModal.classList.add('show');}
        }
      }
    });
  }

  // 2. Remove Today's Habit Completely
  // FIX: removed e.stopPropagation() — these buttons now use data-sound="trash"
  // in HTML to suppress the global click sound (see script.js global listener).
  document.getElementById('delete-habit-today-btn')?.addEventListener('click', () => {
    if (!habitToDeleteId) {return;}

    const habit = habits.find(h => h.id === habitToDeleteId);
    const dateStr = getDateKey(currentHabitDate);

    if (habit) {
      if (!habit.logs) {habit.logs = {};}
      habit.logs[dateStr] = 'hidden'; // BUG FIX: Mark as completely hidden for today

      saveHabitsLocal();
      renderHabits();
      if (typeof updateHabitProgress === 'function') {updateHabitProgress();}

      showToast("Habit removed from today.", "success", true);
    }
    closeDeleteModal();
  });

  // 3. Stop Tracking (Keep History)
  document.getElementById('delete-habit-future-btn')?.addEventListener('click', () => {
    if (!habitToDeleteId) {return;}

    const habit = habits.find(h => h.id === habitToDeleteId);

    if (habit) {
      const yesterday = new Date(currentHabitDate);
      yesterday.setHours(0, 0, 0, 0);
      yesterday.setMilliseconds(-1);

      habit.endDate = yesterday.getTime();
      saveHabitsLocal();
      renderHabits();
      if (typeof updateHabitProgress === 'function') {updateHabitProgress();}
      showToast("Habit archived. History preserved.", "success", true);
    }
    closeDeleteModal();
  });

  // 4. Delete All History (Nuke it)
  document.getElementById('delete-habit-all-btn')?.addEventListener('click', () => {
    if (!habitToDeleteId) {return;}

    const updatedHabits = habits.filter(h => h.id !== habitToDeleteId);
    setHabits(updatedHabits);

    saveHabitsLocal();
    renderHabits();
    if (typeof updateHabitProgress === 'function') {updateHabitProgress();}
    showToast("Habit and all history deleted.", "success", true);
    closeDeleteModal();
  });

  // 5. Close Handlers (Cancel)
  function closeDeleteModal() {
    if (deleteModal) {deleteModal.classList.remove('show');}
    habitToDeleteId = null;
  }

  document.getElementById('close-delete-habit-modal')?.addEventListener('click', closeDeleteModal);

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {closeDeleteModal();}
    });
  }
}

export function initHabitQuotes() {
  const quoteElement = document.getElementById('motivational-quote');
  startQuoteRotation(quoteElement, { category: 'habits' });
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

// ==========================================
// HABIT SCHEDULING LOGIC
// ==========================================
export function isHabitActiveOnDate(habit, targetDate) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  // Fallback to habit.id if createdAt is missing for older habits
  const creationDate = new Date(habit.createdAt || habit.id);
  creationDate.setHours(0, 0, 0, 0);

  // Prevent rendering before the habit was actually created
  if (target < creationDate) {return false;}

  // BUG FIX (STEP 4): If the habit was "Stopped", hide it on any days AFTER the stop date!
  if (habit.endDate && target.getTime() > habit.endDate) {
    return false;
  }

  const dayOfWeek = target.getDay();
  const freq = habit.frequency || 'everyday';

  if (freq === 'everyday') {return true;}

  if (freq === 'custom') {
    if (!habit.customDays || habit.customDays.length === 0) {return false;}
    return habit.customDays.map(Number).includes(dayOfWeek);
  }

  const daysMap = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };

  if (daysMap[freq] !== undefined) {return daysMap[freq] === dayOfWeek;}

  if (freq === 'weekly') {
    const createdDay = creationDate.getDay();
    return createdDay === dayOfWeek;
  }

  if (freq === 'biweekly') {
    const createdDay = creationDate.getDay();
    if (createdDay !== dayOfWeek) {return false;}
    // Same day-of-week as weekly, but only on every OTHER occurrence:
    // count full weeks elapsed since creation and require an even count.
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceCreation = Math.round((target.getTime() - creationDate.getTime()) / msPerWeek);
    return weeksSinceCreation % 2 === 0;
  }

  return true;
}

// ==========================================
// STREAK CALCULATION FUNCTION (Plain JS)
// ==========================================
export function calculateStreak(habit) {
  let streak = 0;

  // FIX: previously built on dayjs for midnight-locking and date-walking.
  // Rewritten with plain Date + the same getDateKey() used everywhere
  // else in the app, so streaks keep working even if the dayjs CDN
  // script is blocked, slow, or removed — same logic, zero dependency.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const creationDate = new Date(habit.createdAt || habit.id);
  creationDate.setHours(0, 0, 0, 0);
  const todayKey = getDateKey(new Date());

  while (d.getTime() >= creationDate.getTime()) {

    if (isHabitActiveOnDate(habit, d)) {
      const dateKey = getDateKey(d);
      const status = habit.logs && habit.logs[dateKey];

      if (status === 'done') {
        streak++;
      } else if (status === 'skipped' || status === 'hidden') {
        // Skips and hidden days do not break the streak
      } else {
        // If it's empty, and it is NOT today, the streak is broken
        if (dateKey !== todayKey) {break;}
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ==========================================
// PROGRESS UPDATE FUNCTION
// ==========================================
export function updateHabitProgress() {
  const activeHabits = habits.filter(habit => isHabitActiveOnDate(habit, currentHabitDate));
  const total = activeHabits.length;
  let completed = 0;

  const dateStr = getDateKey(currentHabitDate);

  activeHabits.forEach(habit => {
    if (habit.logs && habit.logs[dateStr] === 'done') {
      completed++;
    }
  });

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  // 1. Update the SVG Ring
  const ring = document.querySelector('.overview-ring');
  if (ring) {
    const radius = ring.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    ring.style.strokeDasharray = `${circumference} ${circumference}`;
    ring.style.strokeDashoffset = offset;

    // Set both states explicitly instead of falling back to the CSS class
    // default (--theme-color) for the "not complete" case — that fallback
    // only happens to render the same color as --success-color today
    // because both variables happen to equal #10b981. Nothing enforces
    // that they stay equal, so relying on the coincidence would silently
    // break (two different greens) if either value ever changes.
    ring.style.stroke = (percentage === 100 && total > 0)
      ? 'var(--success-color)'
      : 'var(--theme-color)';
  }

  // 2. Animate the Percentage Number (Bulletproof Version)
  const percentageText = document.querySelector('#habit-detail-panel .time-display');
  if (percentageText) {
    const prevVal = parseInt(percentageText.dataset.currentVal || 0);
    // CRITICAL: Update the target immediately so rapid clicks don't break the tracking
    percentageText.dataset.currentVal = percentage;

    if (prevVal !== percentage) {
      animatePercentage(percentageText, prevVal, percentage, 800); // Faster, smoother duration
    } else if (percentageText.textContent === '') {
      percentageText.textContent = `${percentage}%`;
    }
  }

  // 3. Update the text counters (e.g., "2/4 Completed")
  const statsText = document.querySelector('.dashboard-stats-text strong');
  if (statsText) {
    statsText.textContent = `${completed}/${total} Completed`;
  }

  // Update streaks UI
  if (typeof renderTopStreaks === 'function') {renderTopStreaks();}

  const activeTab = readRaw(STORAGE_KEYS.ACTIVE_TAB);
  if (activeTab === '1') {document.title = `Focus App - Habits (${completed}/${total})`;}
}

// ==========================================
// ANIMATION FUNCTION
// ==========================================
export function animatePercentage(element, start, end, duration) {
  // BUG FIX: Cancel previous animation loop if user clicks quickly
  if (element.animationId) {
    window.cancelAnimationFrame(element.animationId);
  }

  // Snap immediately if there's no change needed
  if (start === end) {
    element.textContent = `${end}%`;
    return;
  }

  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) {startTimestamp = timestamp;}
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // Smooth easing curve
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    const currentVal = Math.floor(easeProgress * (end - start) + start);

    element.textContent = `${currentVal}%`;

    if (progress < 1) {
      element.animationId = window.requestAnimationFrame(step);
    } else {
      element.textContent = `${end}%`;
      if (end === 100) {
        element.classList.add('pop-success-anim');
        setTimeout(() => element.classList.remove('pop-success-anim'), 600);
      }
    }
  };
  element.animationId = window.requestAnimationFrame(step);
}

// ==========================================
// Quick Add Logic
// ==========================================
function processQuickAddHabit() {
  const input = document.getElementById('quick-habit-input');
  const name = input.value.trim();

  if (!name) {
    showToast('Please enter a valid habit name.', 'warning');
    return;
  }

  // Pick Random Color & Icon
  const colors = ['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];
  const iconKeys = Object.keys(habitIconsDict);
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomIcon = iconKeys[Math.floor(Math.random() * iconKeys.length)];

  const newHabit = {
    id: generateId(),
    name: name,
    category: 'Uncategorized',
    frequency: 'everyday',
    color: randomColor,
    icon: randomIcon,
    logs: {},
    createdAt: new Date(new Date().setHours(0,0,0,0)).toISOString()
  };

  setHabits([...habits, newHabit]);
  saveHabits();

  input.value = '';
  renderHabits();
  if (typeof renderHabitCategories === 'function') {renderHabitCategories();}
}

const quickAddBtn = document.getElementById('quick-add-habit-btn');
const quickHabitInput = document.getElementById('quick-habit-input');

if (quickAddBtn) {quickAddBtn.addEventListener('click', processQuickAddHabit);}

if (quickHabitInput) {
  quickHabitInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processQuickAddHabit();
    }
  });
  keepInputVisibleOnMobileKeyboard(quickHabitInput);
}

// FIX: removed a dead `updateHabitFilterBubble()` function + a top-level
// `document.querySelectorAll('#habit-filter-container .filter-btn')...`
// listener block that used to sit here. Both ran once at module import
// time, before renderHabitCategories() (called later, at the bottom of
// this file) ever populates #habit-filter-container — so the
// querySelectorAll always matched zero elements and this code never did
// anything. The real, working version of this exact logic already lives
// inside renderHabitCategories() below, which re-attaches listeners every
// time the filter buttons are actually re-rendered.

export function renderHabitCategories() {
  const filterContainer = document.getElementById('habit-filter-container');
  if (!filterContainer) {return;}

  // Maintain current active filter state, default to 'all'
  const currentFilter = filterContainer.querySelector('.filter-btn.active')?.dataset.filter || 'all';

  const bubbleHTML = '<div class="filter-bubble" id="habit-filter-bubble"></div>';
  const usedCats = habits.map(h => h.category || 'Uncategorized');
  const uniqueCategories = [...new Set([...savedHabitCategories, ...usedCats])].filter(cat => cat && cat.trim() !== '');

  let buttonsHTML = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" data-sound="click">All</button>`;
  buttonsHTML += `<button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active" data-sound="click">Active</button>`;
  buttonsHTML += `<button class="filter-btn ${currentFilter === 'done' ? 'active' : ''}" data-filter="done" data-sound="click">Done</button>`;

  uniqueCategories.forEach(cat => {
    buttonsHTML += `<button class="filter-btn ${currentFilter === cat ? 'active' : ''}" data-filter="${escapeHTML(cat)}" data-sound="click">${escapeHTML(cat)}</button>`;
  });

  filterContainer.innerHTML = bubbleHTML + buttonsHTML;

  // Add horizontal wheel scroll support for desktop
  setupHorizontalWheelScroll(filterContainer);

  // Attach click listeners and auto-scroll
  filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const bubble = document.getElementById('habit-filter-bubble');
      if (bubble) {
        bubble.style.width = `${this.offsetWidth}px`;
        bubble.style.left = `${this.offsetLeft}px`;
      }

      // Auto-scroll the container to keep the active item in view.
      // (See centerButtonInScrollArea's comment in ui-utils.js for
      // why this replaced scrollIntoView — same page-scroll-on-load
      // bug as the task filter row.)
      centerButtonInScrollArea(filterContainer, this);

      // NOTE: Add your habit filtering logic here based on this.dataset.filter later!
      currentHabitFilter = this.dataset.filter;
      renderHabits();
    });
  });

  // Initialize Bubble position seamlessly
  setTimeout(() => {
    const activeBtn = filterContainer.querySelector('.filter-btn.active');
    const bubble = document.getElementById('habit-filter-bubble');
    if (activeBtn && bubble) {
      bubble.style.transition = 'none'; // Turn off animation
      bubble.style.width = `${activeBtn.offsetWidth}px`;
      bubble.style.left = `${activeBtn.offsetLeft}px`;
      void bubble.offsetWidth; // Force CSS refresh
      bubble.style.transition = ''; // Turn animation back on
      centerButtonInScrollArea(filterContainer, activeBtn);
    }
  }, 50);
}

renderHabitCategories();

// Recalculate bubble position when switching to the Habits tab
document.addEventListener('habitsTabOpened', () => {
  const filterContainer = document.getElementById('habit-filter-container');
  if (!filterContainer) {return;}
  const activeBtn = filterContainer.querySelector('.filter-btn.active');
  const bubble = document.getElementById('habit-filter-bubble');

  if (activeBtn && bubble) {
    bubble.style.transition = 'none';
    bubble.style.width = `${activeBtn.offsetWidth}px`;
    bubble.style.left = `${activeBtn.offsetLeft}px`;
    void bubble.offsetWidth; // force css refresh
    bubble.style.transition = '';
  }
});

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

    if (diffDays === 0) {display.textContent = 'Today';}
    else if (diffDays === -1) {display.textContent = 'Yesterday';}
    else if (diffDays === 1) {display.textContent = 'Tomorrow';}
    else {display.textContent = newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });}
  }
  renderHabits();
  if (typeof updateDailyOverview === 'function') {updateDailyOverview();} // eslint-disable-line no-undef
}

export function renderTopStreaks() {
  const list = document.getElementById('top-streaks-list');
  if (!list) {return;}

  const habitsWithStreaks = habits.map(h => ({ ...h, currentStreak: typeof calculateStreak === 'function' ? calculateStreak(h) : 0 }));
  habitsWithStreaks.sort((a, b) => b.currentStreak - a.currentStreak);

  // Grab top 3
  const top3 = habitsWithStreaks.filter(h => h.currentStreak > 0).slice(0, 3);

  list.innerHTML = '';

  // ALWAYS render 3 slots to permanently lock the layout height
  for (let i = 0; i < 3; i++) {
    const pill = document.createElement('div');
    pill.className = 'stat-row fixed-height';

    if (top3[i]) {
      const h = top3[i];
      const safeStreakColor = isValidHexColor(h.color) ? h.color : '#10b981';
      pill.innerHTML = `
        <div class="stat-icon mini" style="color: ${safeStreakColor}; background: ${safeStreakColor}20;">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${habitIconsDict[h.icon] || habitIconsDict['activity']}</svg>
        </div>
        <div class="stat-row-right">
          <span class="stat-label" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px; display:block;">${escapeHTML(h.name)}</span>
          <div class="streak-flame active lg">
            <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
            <span>${h.currentStreak}</span>
          </div>
        </div>
      `;
    } else {
      // Empty transparent placeholder
      pill.classList.add('empty-slot');
      pill.innerHTML = `
        <div class="stat-icon mini" style="background: transparent;"></div>
        <div class="stat-details">
          <span class="stat-label">Empty</span>
        </div>
      `;
    }
    list.appendChild(pill);
  }
}
