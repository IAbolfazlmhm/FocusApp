// ==========================================
// PROGRESS: DAILY REPORT MODAL
// ==========================================
import { setTaskDate } from './tasks.js';
import { formatTaskTime } from './tasks-render.js';
import { setHabitDate } from './habits.js';
import { isHabitActiveOnDate } from './habits-logic.js';
import { escapeHTML } from './dom-utils.js';
import { readJSON, STORAGE_KEYS } from './storage.js';
import { getLocalDateKey } from './date-utils.js';
import { getHabitLogKey } from './progress-stats.js';

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
    // focus time earned with no task attached to it.
    const tasklessByDate = readJSON(STORAGE_KEYS.TASKLESS_TIME, {});
    const tasklessSeconds = tasklessByDate[localDateStr] || 0;
    if (tasklessSeconds > 0) {
      html += `<div class="report-item"><span>Focus time (no task)</span> <span>${formatTaskTime(tasklessSeconds)}</span></div>`;
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
}
