// ==========================================
// TASK RENDERING (filters, filter bubble, task list)
// ==========================================
import { tasks, focusedTaskId, savedTags, tagColors, currentFilter, currentSort, sortOrder, currentPomodoroDate, setCurrentFilter } from '../../core/state.js';
import { icons, escapeHTML } from '../../core/dom-utils.js';
import { getTagColor } from '../../shared/color-utils.js';
import { centerButtonInScrollArea, setupHorizontalWheelScroll } from '../../shared/scroll-utils.js';
import { showToast } from '../../shared/toast/toast.js';
import { saveTasks, saveTaskViewPrefs } from './tasks-storage.js';
import { t, formatNumber } from '../../core/i18n.js';

const taskListContainer = document.querySelector('.task-list-container');
const tasksSection = document.querySelector('.tasks-section');
const currentTaskNameEl = document.getElementById('current-task-name');
const filterListEl = document.getElementById('filter-list');

export function formatTaskTime(totalSeconds) {
  if (totalSeconds === 0) {return '';}
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${icons.clock} ${formatNumber(m)}m ${formatNumber(s)}s`;
}

// ==========================================
// TASK ACTION HANDLERS (registered by tasks.js — see file header comment)
// ==========================================
// Defaults are harmless no-ops rather than undefined, so a render that
// somehow ran before setTaskHandlers() was called (there isn't one in
// practice — see tasks.js, which registers these at module load, before
// any render can happen) fails silently instead of throwing.
let taskHandlers = { onFocus: () => {}, onComplete: () => {}, onRemove: () => {} };

export function setTaskHandlers(handlers) {
  taskHandlers = handlers;
}

// ==========================================
// RENDER FILTERS & BUBBLE
// ==========================================
export function renderFilters() {
  if (!filterListEl) {return;}
  const scrollPos = filterListEl.scrollLeft;

  let html = `
    <div class="filter-bubble"></div>
    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" data-sound="click">${t('filter_all')}</button>
    <button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active" data-sound="click">${t('filter_active')}</button>
    <button class="filter-btn ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed" data-sound="click">${t('filter_done')}</button>
  `;

  savedTags.forEach(tag => {
    html += `<button class="filter-btn ${currentFilter === tag ? 'active' : ''}" data-filter="${escapeHTML(tag)}" data-sound="click">#${escapeHTML(tag)}</button>`;
  });

  filterListEl.innerHTML = html;

  const btns = filterListEl.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentFilter(btn.dataset.filter);
      saveTaskViewPrefs();

      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateFilterBubble();
      renderTasks();
    });
  });

  filterListEl.scrollLeft = scrollPos;

  // Prevent animation glitch on initial load/refresh
  const bubble = filterListEl.querySelector('.filter-bubble');
  if (bubble) {
    bubble.style.transition = 'none';
    // FIX: this used to call updateFilterBubble() synchronously, right
    // here. renderFilters() is one of the functions the languageChanged
    // cascade calls (main.js), and switching to fa can be the very first
    // time Persian text — and its fallback-chain font, Vazirmatn — has
    // ever needed to render (see the identical fix and explanation in
    // tabs.js's languageChanged listener). Measuring offsetWidth/
    // offsetLeft before that font finishes loading gives the wrong
    // numbers, which is exactly why the bubble could vanish/misplace
    // itself on a language switch and only reappear correctly once a
    // filter click ran updateFilterBubble() again — by then the font had
    // long since finished loading. document.fonts.ready resolves
    // immediately when nothing's actually loading, so this costs nothing
    // on every other call to renderFilters() (initial load, tag/filter
    // changes, tab switches).
    const waitForFonts = (typeof document.fonts !== 'undefined' && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();
    waitForFonts.then(() => {
      requestAnimationFrame(() => {
        updateFilterBubble();
        void bubble.offsetWidth; // Force reflow
        bubble.style.transition = '';
      });
    });

    const event = new CustomEvent('updateColors');
    document.dispatchEvent(event);
  }

  // Add horizontal wheel scroll support for desktop
  setupHorizontalWheelScroll(filterListEl);
}

export function updateFilterBubble() {
  if (!filterListEl) {return;}
  const activeBtn = filterListEl.querySelector('.filter-btn.active');
  const bubble = filterListEl.querySelector('.filter-bubble');

  if (activeBtn && bubble) {
    bubble.style.width = `${activeBtn.offsetWidth}px`;
    bubble.style.left = `${activeBtn.offsetLeft}px`;
    // FIX: this used to be activeBtn.scrollIntoView({ block: 'nearest', ... }).
    // filterListEl only scrolls horizontally (overflow-x: auto), so
    // scrollIntoView's vertical "nearest" component had nowhere to resolve
    // except the page itself — if this row wasn't fully inside the
    // viewport (routine on mobile, where the timer panel above it can
    // push it near/past the fold), the browser would scroll the whole
    // page down to satisfy it. That ran on every load/refresh, since
    // renderFilters() (which calls this) runs on initial setup, not just
    // on click. Scrolling filterListEl directly keeps this entirely
    // inside its own horizontal strip and can never move the page.
    centerButtonInScrollArea(filterListEl, activeBtn);
  }
}

// FIX: renderFilters() is one of the functions the languageChanged cascade
// (main.js) calls, and it re-measures the bubble via offsetWidth/offsetLeft
// while it runs. When the language is switched from a different tab, the
// Pomodoro view is display:none at that moment, so every measurement comes
// back 0 and the bubble collapses — invisible until the user clicked a
// filter to trigger a fresh updateFilterBubble(). Same failure shape as
// the habits filter bubble, which already has a habitsTabOpened listener
// for exactly this; the Pomodoro tab just never got its equivalent.
// tabs.js now dispatches 'pomodoroTabOpened' on every switch to the
// Pomodoro tab, so re-measure here once the view is actually visible.
document.addEventListener('pomodoroTabOpened', () => {
  updateFilterBubble();
});

// ==========================================
// RENDER TASKS ENGINE
// ==========================================
export function renderTasks() {
  if (!taskListContainer) {return;}
  taskListContainer.innerHTML = '';

  // 1. Filter by Tag/Status
  let filtered = tasks;
  if (currentFilter === 'active') {filtered = tasks.filter(t => !t.completed);}
  else if (currentFilter === 'completed') {filtered = tasks.filter(t => t.completed);}
  else if (currentFilter !== 'all') {filtered = tasks.filter(t => t.tag === currentFilter);}

  // 2. Filter by Date (Only show tasks for the date selected in the top bar)
  if (typeof currentPomodoroDate !== 'undefined') {
    const targetDateString = currentPomodoroDate.toDateString(); // "Fri Oct 27 2023"
    filtered = filtered.filter(task => {
      const taskDateString = new Date(task.createdAt).toDateString();
      return taskDateString === targetDateString;
    });
  }

  // 3. Sort using the new Top Bar logic
  filtered.sort((a, b) => {
    // 1. Primary Sort: Completed tasks ALWAYS sink to the bottom
    if (a.completed !== b.completed) {return a.completed ? 1 : -1;}

    // 2. Secondary Sort: User's choice
    let val = 0;
    if (currentSort === 'newest') {val = a.createdAt - b.createdAt;}
    else if (currentSort === 'az') {val = a.text.localeCompare(b.text);}
    else if (currentSort === 'tag') {val = (a.tag || '').localeCompare(b.tag || '');}
    else if (currentSort === 'time') {val = a.timeSpent - b.timeSpent;}

    return sortOrder === 'asc' ? val : -val;
  });

  // 4. Render the Tasks (With Reschedule/Focus Logic)
  const actualToday = new Date();
  actualToday.setHours(0, 0, 0, 0);
  const isToday = currentPomodoroDate.getTime() === actualToday.getTime();

  // Built up in a fragment and appended once at the end instead of per
  // task — avoids a separate reflow-triggering insertion into the live,
  // visible list for every single task on every render (add/delete/
  // complete/filter/sort all call renderTasks()).
  const fragment = document.createDocumentFragment();

  filtered.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === focusedTaskId ? 'active-focus' : ''}`;

    // Rock-Solid Tag Badge (Now with Max-Width and Ellipsis Truncation!)
    let tagHTML = '';
    if (task.tag) {
      // Tags now get a color from one of two places: a color the user
      // explicitly picked in "Manage Tags" (tagColors, set below in
      // renderTagsManagement), or — if they never bothered — a
      // deterministic hash color so it's still visually consistent
      // without requiring any setup.
      const tagColor = getTagColor(task.tag, tagColors[task.tag]);
      tagHTML = `<span class="task-tag" title="${escapeHTML(task.tag)}" style="--tag-color:${tagColor.solid}; --tag-bg:${tagColor.bg}; --tag-border:${tagColor.border};">#${escapeHTML(task.tag)}</span>`;
    }

    let actionButtons = '';
    if (!isToday && !task.completed) {
      actionButtons += `
        <button class="focus-btn reschedule-btn" title="${t('reschedule_to_today')}" aria-label="${t('reschedule_to_today')}" data-sound="success">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
        </button>
      `;
    }

    const isFocused = task.id === focusedTaskId;
    actionButtons += `
      <button class="focus-btn focus-action ${isFocused ? 'is-focused' : ''}"
        title="${isFocused ? t('unfocus_task') : t('focus_task')}"
        aria-label="${isFocused ? t('unfocus_task') : t('focus_task')}"
        aria-pressed="${isFocused}"
        data-sound="click">
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      </button>
    `;

    taskDiv.style.cursor = 'pointer';
    taskDiv.dataset.id = task.id;
    taskDiv.tabIndex = 0;
    taskDiv.setAttribute('role', 'button');
    taskDiv.setAttribute('aria-label', `${t('edit_task')}: ${task.text}`);

    taskDiv.innerHTML = `
      <div class="task-info">

        <span class="task-name" title="${escapeHTML(task.text)}">${escapeHTML(task.text)}</span>

        <div class="task-tag-row">
          ${tagHTML}
          <span class="task-time-badge" id="badge-${task.id}">${formatTaskTime(task.timeSpent)}</span>
        </div>

      </div>
      <div class="task-actions">
        ${actionButtons}
        <button class="done-btn" title="${t('done')}" data-sound="success"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
        <button class="remove-btn" title="${t('remove')}"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    `;

    // Wire up the dynamic buttons
    const focusBtn = taskDiv.querySelector('.focus-action');
    if (focusBtn) {focusBtn.addEventListener('click', () => taskHandlers.onFocus(task.id));}

    const rescheduleBtn = taskDiv.querySelector('.reschedule-btn');
    if (rescheduleBtn) {
      rescheduleBtn.addEventListener('click', () => {
        task.createdAt = Date.now();
        saveTasks();
        renderTasks();
        showToast(t('task_moved_to_today'), 'success');
      });
    }

    taskDiv.querySelector('.done-btn').addEventListener('click', () => taskHandlers.onComplete(task.id));
    taskDiv.querySelector('.remove-btn').addEventListener('click', () => taskHandlers.onRemove(task.id));

    fragment.appendChild(taskDiv);
  });

  taskListContainer.appendChild(fragment);

  // 5. Handle UI states
  if (focusedTaskId) {
    if (tasksSection) {tasksSection.classList.add('zen-mode');}
    const tTask = tasks.find(x => x.id === focusedTaskId);
    if (currentTaskNameEl) {currentTaskNameEl.textContent = tTask ? tTask.text : t('focus_nothing');}
    if (taskListContainer) {taskListContainer.scrollTop = 0;}
  } else {
    if (tasksSection) {tasksSection.classList.remove('zen-mode');}
    if (currentTaskNameEl) {currentTaskNameEl.textContent = t('focus_nothing');}
  }

  if (filtered.length === 0) {
    let msg;
    if (tasks.length === 0) {
      msg = t('no_tasks_empty');
    } else if (currentFilter === 'completed') {
      msg = t('no_completed_tasks_empty');
    } else if (currentFilter === 'active') {
      msg = t('no_active_tasks_empty');
    } else if (currentFilter !== 'all') {
      msg = t('no_tasks_tagged_empty', { tag: escapeHTML(currentFilter) });
    } else {
      msg = t('no_tasks_match_filter');
    }
    taskListContainer.innerHTML = `
      <div class="empty-state lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
        <p>${msg}</p>
      </div>`;
  }
}
