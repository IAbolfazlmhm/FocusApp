// ==========================================
// PROGRESS: HEATMAP RENDERING
// ==========================================
import { isHabitActiveOnDate } from './habits-logic.js';
import { escapeHTML } from './dom-utils.js';
import { readJSON, STORAGE_KEYS } from './storage.js';
import { getLocalDateKey } from './date-utils.js';
import { getDaysArray, getHabitLogKey } from './progress-stats.js';
import { openDailyReport } from './progress-report.js';

// --- SMART JS TOOLTIP ENGINE ---
let globalTooltip = document.getElementById('heatmap-tooltip');
if (!globalTooltip) {
  globalTooltip = document.createElement('div');
  globalTooltip.id = 'heatmap-tooltip';
  globalTooltip.style.cssText = 'position: fixed; z-index: 99999; background: #1e293b; color: #f8fafc; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; pointer-events: none; opacity: 0; transition: opacity 0.15s ease-out; box-shadow: 0 4px 15px rgba(0,0,0,0.2); white-space: nowrap; line-height: 1.4;';
  document.body.appendChild(globalTooltip);
}

// Tooltip HTML content keyed by block element, rather than round-tripped
// through a `data-*` attribute. `data-*` attributes are meant to hold data,
// not markup — storing HTML there and reading it back into innerHTML was a
// pattern that had silently opted out of this codebase's escapeHTML()
// discipline (see FocusApp-Senior-Audit.md, Finding M4). Every value here
// is still app-generated today, but escapeHTML() is applied to the one
// piece of it (the date label) regardless, so this stays safe if the
// tooltip is ever extended to include a task or habit name.
const tooltipContent = new WeakMap();

function attachSmartTooltip(block, html) {
  tooltipContent.set(block, html);
  block.addEventListener('mouseenter', () => {
    globalTooltip.innerHTML = tooltipContent.get(block) || '';
    const rect = block.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (globalTooltip.offsetWidth / 2);
    const top = rect.top - globalTooltip.offsetHeight - 10;

    if (left + globalTooltip.offsetWidth > window.innerWidth - 15) {left = window.innerWidth - globalTooltip.offsetWidth - 15;}
    if (left < 15) {left = 15;}

    globalTooltip.style.left = left + 'px';
    globalTooltip.style.top = top + 'px';
    globalTooltip.style.opacity = '1';
  });

  block.addEventListener('mouseleave', () => {
    globalTooltip.style.opacity = '0';
  });
}

// showPomodoro/showHabits: see the comment on calculateStats() in
// progress-stats.js for why these are explicit parameters rather than
// shared module state. Both heatmap functions need both flags — not just
// their own — purely to forward on to openDailyReport() below, which
// renders both sections in one modal regardless of which heatmap the
// click came from.
export function renderFocusHeatmap(startDate, endDate, currentTasks, showPomodoro = true, showHabits = true) {
  const container = document.getElementById('prog-focus-container');
  const heatmap = document.getElementById('focus-heatmap');
  if (!container || !heatmap) {return;}

  if (!showPomodoro) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  heatmap.innerHTML = '';

  const days = getDaysArray(startDate, endDate);
  // Building blocks in a DocumentFragment and appending once (instead of
  // appendChild per block) avoids up to ~365 separate reflow-triggering
  // insertions into a live, visible list on every date-range change —
  // one reflow for the whole heatmap instead of one per day.
  const fragment = document.createDocumentFragment();

  // Taskless-session time — see calculateStats() in progress-stats.js for
  // why this is read locally instead of imported from timer.js.
  const tasklessByDate = readJSON(STORAGE_KEYS.TASKLESS_TIME, {});

  days.forEach(d => {
    const dateStr = getLocalDateKey(d);
    let mins = 0;
    let totalTasks = 0;
    let doneTasks = 0;

    currentTasks.forEach(t => {
      const dayTimeSeconds = t.timeByDate
      ? (t.timeByDate[dateStr] || 0)
      : (getLocalDateKey(t.createdAt) === dateStr ? (t.timeSpent || 0) : 0);
      mins += Math.floor(dayTimeSeconds / 60);

      // totalTasks/doneTasks are a matched pair used only for this
      // tile's completion-rate color — both stay scoped to "created
      // that day" so the rate can never read as more than 100%. The
      // day-accurate completion count itself is fixed in
      // calculateStats() (progress-stats.js), which isn't a rate and
      // has no such constraint.
      if (getLocalDateKey(t.createdAt) === dateStr) {
        totalTasks++;
        if (t.completed) {doneTasks++;}
      }
    });

    mins += Math.floor((tasklessByDate[dateStr] || 0) / 60);

    const block = document.createElement('div');
    block.className = 'heatmap-block';
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const completionRate = totalTasks === 0 ? 0 : (doneTasks / totalTasks);

    // Dynamic Tooltip
    let tooltipHTML = `<span class="report-date-label">${escapeHTML(displayDate)}</span><br/>`;
    if (totalTasks > 0) {tooltipHTML += `${doneTasks}/${totalTasks} tasks done (${Math.round(completionRate*100)}%)<br/>${mins}m focus time`;}
    else if (mins > 0) {tooltipHTML += `0 tasks, ${mins}m focus time`;}
    else {tooltipHTML += `No activity`;}

    // BUG FIX: Color is now based strictly on Completion Rate!
    if (totalTasks > 0) {
      if (completionRate > 0 && completionRate < 0.5) {block.classList.add('focus-level-1');}
      else if (completionRate >= 0.5 && completionRate < 1) {block.classList.add('focus-level-2');}
      else if (completionRate === 1) {block.classList.add('focus-level-3');}
    } else if (mins > 0) {
      block.classList.add('focus-level-1'); // Fallback if they focused without tasks
    }

    block.addEventListener('click', () => openDailyReport(d, showPomodoro, showHabits));
    attachSmartTooltip(block, tooltipHTML);
    fragment.appendChild(block);
  });

  heatmap.appendChild(fragment);
}

export function renderHabitHeatmap(startDate, endDate, currentHabits, showPomodoro = true, showHabits = true) {
  const container = document.getElementById('prog-habit-container');
  const heatmap = document.getElementById('habit-heatmap');
  if (!container || !heatmap) {return;}

  if (!showHabits) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  heatmap.innerHTML = '';

  const days = getDaysArray(startDate, endDate);
  // See renderFocusHeatmap above for why this batches into a fragment
  // instead of appending each block directly.
  const fragment = document.createDocumentFragment();

  days.forEach(d => {
    const logKey = getHabitLogKey(d);
    let doneCount = 0;
    let activeCount = 0;

    currentHabits.forEach(h => {
      const created = new Date(h.createdAt || h.id).setHours(0,0,0,0);
      if (d.getTime() >= created) {
        // BUG FIX: Accurate scheduling
        if (isHabitActiveOnDate(h, d)) {
          activeCount++;
          if (h.logs && h.logs[logKey] === 'done') {doneCount++;}
        }
      }
    });

    const block = document.createElement('div');
    block.className = 'heatmap-block';
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let tooltipHTML = `<span class="report-date-label">${escapeHTML(displayDate)}</span><br/>`;
    if (activeCount > 0) {
      const completionRate = Math.round((doneCount / activeCount) * 100);
      tooltipHTML += `${doneCount}/${activeCount} habits done (${completionRate}%)`;
    } else {
      tooltipHTML += `No scheduled habits`;
    }

    if (doneCount > 0) {
      const rate = doneCount / activeCount;
      if (rate > 0 && rate <= 0.33) {block.classList.add('habit-level-1');}
      else if (rate > 0.33 && rate <= 0.66) {block.classList.add('habit-level-2');}
      else if (rate > 0.66) {block.classList.add('habit-level-3');}
    }

    block.addEventListener('click', () => openDailyReport(d, showPomodoro, showHabits));
    attachSmartTooltip(block, tooltipHTML);
    fragment.appendChild(block);
  });

  heatmap.appendChild(fragment);
}
