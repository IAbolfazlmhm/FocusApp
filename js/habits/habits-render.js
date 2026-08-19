// ==========================================
// HABIT RENDERING (list, progress ring, categories, top streaks)
// ==========================================
import {
  habits, currentHabitDate, currentHabitFilter, currentHabitSort, habitSortOrder, savedHabitCategories,
  categoryColors, setCurrentHabitFilter
} from '../core/state.js';
import { escapeHTML } from '../core/dom-utils.js';
import { hexToRgba, isValidHexColor, getTagColor } from '../ui/color-utils.js';
import { centerButtonInScrollArea, setupHorizontalWheelScroll } from '../ui/scroll-utils.js';
import { readRaw, STORAGE_KEYS } from '../core/storage.js';
import { getDateKey, isHabitActiveOnDate, calculateStreak } from './habits-logic.js';
import { habitIconsDict } from './habit-icons.js';

const habitListContainer = document.getElementById('habit-list-container');

// ==========================================
// RENDER HABITS ENGINE
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

  // Habit Item Click (to Edit) — attached once in setupHabitsEvents()
  // (habits.js), not here. (Previously this whole listener lived inside
  // renderHabits(), which runs after nearly every action — add, complete,
  // delete, skip. Since the container element itself is never recreated,
  // only its children, every re-render was stacking ANOTHER click
  // listener on the same container. After enough actions, a single click
  // on a habit would fire the "open edit modal" logic multiple times in
  // a row.)

  // Built up in a fragment and appended once — see the matching comment
  // in tasks-render.js's renderTasks(), which has the same pattern.
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

    // Validated before use — see isValidHexColor in color-utils.js for why
    // an unvalidated color string here would be a real injection risk,
    // not just a source of broken CSS, since it's interpolated straight
    // into a style="..." attribute below.
    const safeColor = isValidHexColor(habit.color) ? habit.color : '#3b82f6';
    const bgRgba = hexToRgba(safeColor, 0.15);
    const iconSvgContent = habitIconsDict[habit.icon] || `<circle cx="12" cy="12" r="10"/>`;

    // 1. Generate Category Pill (with ellipsis and optical padding fix)
    let catHTML = '';
    if (habit.category && habit.category !== 'Uncategorized') {
      // FIX: every category badge rendered in the same flat muted style
      // regardless of which category it was — categories had no color
      // system at all, unlike tags. Reuses getTagColor() (color-utils.js)
      // exactly as tag chips do: a saved custom color if the user set one
      // in Manage Categories, otherwise a deterministic hash-based color
      // so badges are at least visually distinct out of the box.
      const catColor = getTagColor(habit.category, categoryColors[habit.category]);
      catHTML = `<span class="habit-category-badge" style="--cat-color:${catColor.solid};--cat-bg:${catColor.bg};--cat-border:${catColor.border};" title="${escapeHTML(habit.category)}">${escapeHTML(habit.category)}</span>`;
    }

    habitDiv.style.cursor = 'pointer';
    // FIX: same gap as task cards — clicking a card opens the edit
    // modal but there was no keyboard equivalent. See setupHabitsEvents()
    // (habits.js) for the matching keydown handler.
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
// DAILY PROGRESS RING
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

  // 2. Animate the Percentage Number
  const percentageText = document.querySelector('#habit-detail-panel .time-display');
  if (percentageText) {
    const prevVal = parseInt(percentageText.dataset.currentVal || 0);
    // Update the target immediately so rapid clicks don't break the tracking
    percentageText.dataset.currentVal = percentage;

    if (prevVal !== percentage) {
      animatePercentage(percentageText, prevVal, percentage, 800);
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
  renderTopStreaks();

  const activeTab = readRaw(STORAGE_KEYS.ACTIVE_TAB);
  if (activeTab === '1') {document.title = `Focus App - Habits (${completed}/${total})`;}
}

// ==========================================
// ANIMATION FUNCTION
// ==========================================
export function animatePercentage(element, start, end, duration) {
  // Cancel previous animation loop if user clicks quickly
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
// CATEGORY FILTER BAR
// ==========================================
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
      // (See centerButtonInScrollArea's comment in scroll-utils.js for
      // why this replaced scrollIntoView — same page-scroll-on-load
      // bug as the task filter row.)
      centerButtonInScrollArea(filterContainer, this);

      setCurrentHabitFilter(this.dataset.filter);
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

// ==========================================
// TOP STREAKS WIDGET
// ==========================================
export function renderTopStreaks() {
  const list = document.getElementById('top-streaks-list');
  if (!list) {return;}

  const habitsWithStreaks = habits.map(h => ({ ...h, currentStreak: calculateStreak(h) }));
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
