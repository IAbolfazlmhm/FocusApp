// ==========================================
// PROGRESS: DAILY REPORT MODAL
// ==========================================
import { setTaskDate } from '../tasks/tasks.js';
import { formatTaskTime } from '../tasks/tasks-render.js';
import { setHabitDate } from '../habits/habits.js';
import { isHabitActiveOnDate } from '../habits/habits-logic.js';
import { escapeHTML } from '../core/dom-utils.js';
import { readJSON, STORAGE_KEYS } from '../core/storage.js';
import { getLocalDateKey } from '../core/date-utils.js';
import { getHabitLogKey } from './progress-stats.js';
import { clearTasklessTime } from '../timer/timer.js';
import { customConfirm } from '../ui/modal-utils.js';

// showPomodoro/showHabits are passed in explicitly by whichever heatmap
// block was clicked (progress-heatmap.js) rather than read from shared
// module state — see the comment on calculateStats() in progress-stats.js
// for why these toggles are threaded as parameters instead.
export function openDailyReport(dateObj, showPomodoro = true, showHabits = true) {
  const modal = document.getElementById('daily-report-modal');
  const title = document.getElementById('report-date-title');
  const body = document.getElementById('report-modal-body');
  if (!modal) {return;}

  const currentTasks = readJSON(STORAGE_KEYS.TASKS, [], 'array');
  const currentHabits = readJSON(STORAGE_KEYS.HABITS, [], 'array');

  const localDateStr = getLocalDateKey(dateObj);
  const habitLogKey = getHabitLogKey(dateObj);

  title.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let html = '';

  if (showPomodoro) {
    html += `<div class="report-section-title">Pomodoro Tasks</div>`;
    // A task belongs on this day's report if it was CREATED that day,
    // OR if focus time was actually logged for it that day (timeByDate) —
    // previously only createdAt was checked, so working on an
    // older task today wouldn't show up in today's report at all.
    const dayTasks = currentTasks.filter(t =>
      getLocalDateKey(t.createdAt) === localDateStr || (t.timeByDate && t.timeByDate[localDateStr] > 0)
    );
    if (dayTasks.length === 0) {html += `<p class="report-empty-msg">No tasks recorded.</p>`;}
    dayTasks.forEach(t => {
      // Show THIS day's time, not the task's all-time total — legacy
      // tasks with no timeByDate fall back to their full total since
      // that's all we ever recorded for them.
      const dayTimeSeconds = t.timeByDate
      ? (t.timeByDate[localDateStr] || 0)
      : (t.timeSpent || 0);
      const timeBadge = formatTaskTime(dayTimeSeconds);
      if (t.completed) {html += `<div class="report-item success"><span><strike>${escapeHTML(t.text)}</strike></span> <span>${timeBadge}</span></div>`;}
      else {html += `<div class="report-item failed"><span>${escapeHTML(t.text)}</span> <span>${timeBadge}</span></div>`;}
    });

    // Taskless sessions (see timer.js's addTasklessFocusTime) — kept as
    // its own line rather than folded into a task, since it's real
    // focus time earned with no task attached to it. Deletable in place
    // (unlike the task/habit rows above) since this is the one place in
    // the app that surfaces it at all — a stray entry from testing the
    // timer with nothing selected has nowhere else to go.
    const tasklessByDate = readJSON(STORAGE_KEYS.TASKLESS_TIME, {});
    const tasklessSeconds = tasklessByDate[localDateStr] || 0;
    if (tasklessSeconds > 0) {
      html += `<div class="report-item report-item-deletable"><span>Focus time (no task)</span> <span class="report-item-value"><span>${formatTaskTime(tasklessSeconds)}</span><button type="button" class="icon-btn report-delete-taskless-btn" id="delete-taskless-btn" title="Delete this entry" aria-label="Delete this no-task focus time entry" data-sound="click"><svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></span></div>`;
    }
  }

  if (showHabits) {
    html += `<div class="report-section-title spaced">Habits</div>`;
    let habitFound = false;
    currentHabits.forEach(h => {
      const created = new Date(h.createdAt || h.id).setHours(0,0,0,0);
      if (dateObj.getTime() >= created && isHabitActiveOnDate(h, dateObj)) {
        habitFound = true;
        const status = h.logs && h.logs[habitLogKey];
        if (status === 'done') {html += `<div class="report-item success"><span>${escapeHTML(h.name)}</span> <span class="report-status-label">Done</span></div>`;}
        else if (status === 'skipped') {html += `<div class="report-item skipped"><span>${escapeHTML(h.name)}</span> <span class="report-status-label">Skipped</span></div>`;}
        else {html += `<div class="report-item failed"><span>${escapeHTML(h.name)}</span> <span class="report-status-label">Missed</span></div>`;}
      }
    });
    if (!habitFound) {html += `<p class="report-empty-msg">No habits scheduled.</p>`;}
  }

  // BUG FIX: Only show buttons for active sections
  let buttonsHTML = '';
  if (showPomodoro) {
    buttonsHTML += `<button class="btn report-goto-btn focus" id="goto-focus-btn">Go to Pomodoro</button>`;
  }
  if (showHabits) {
    buttonsHTML += `<button class="btn report-goto-btn habits" id="goto-habits-btn">Go to Habits</button>`;
  }

  if (buttonsHTML !== '') {
    html += `
      <div class="report-actions">
        ${buttonsHTML}
      </div>
    `;
  }

  body.innerHTML = html;
  modal.classList.add('show');

  // Safely attach event listeners only if the buttons exist
  // FIX: used to navigate by hardcoded tab index ([0], [1]), which breaks
  // silently if the tab order or count in the HTML ever changes. Now uses
  // semantic IDs that are tied to the actual tab elements.
  const gotoFocusBtn = document.getElementById('goto-focus-btn');
  if (gotoFocusBtn) {
    gotoFocusBtn.addEventListener('click', () => {
      document.getElementById('close-report-modal').click();
      document.getElementById('tab-pomodoro').click();
      setTaskDate(dateObj);
    });
  }

  const gotoHabitsBtn = document.getElementById('goto-habits-btn');
  if (gotoHabitsBtn) {
    gotoHabitsBtn.addEventListener('click', () => {
      document.getElementById('close-report-modal').click();
      document.getElementById('tab-habits').click();
      setHabitDate(dateObj);
    });
  }

  const deleteTasklessBtn = document.getElementById('delete-taskless-btn');
  if (deleteTasklessBtn) {
    deleteTasklessBtn.addEventListener('click', () => {
      customConfirm('Delete this no-task focus time?', () => {
        clearTasklessTime(localDateStr);
        // Re-render this same modal so the row disappears immediately,
        // and let the rest of the app (heatmap, stat totals) know its
        // data just changed — same event habits.js's CRUD dispatches.
        openDailyReport(dateObj, showPomodoro, showHabits);
        document.dispatchEvent(new Event('dataUpdated'));
      });
    });
  }
}
