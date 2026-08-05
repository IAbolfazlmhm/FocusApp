import { formatTaskTime, setTaskDate } from './tasks.js';
import { setHabitDate, isHabitActiveOnDate, getDateKey } from './habits.js';
import { showToast, escapeHTML, setupSelectDropdown } from './ui-utils.js';
import { readJSON, readRaw } from './storage.js';
import { getLocalDateKey } from './date-utils.js';

// FIX: this used to be its own copy of the same safe-parse logic that
// lives in storage.js (readJSON) — duplicated because this file needed
// "must be an array" validation and state.js's original safeParse wasn't
// shared code yet. Now that storage.js exports readJSON with the same
// 'array' type check, this local copy is redundant; call sites below use
// readJSON('focusTasks', [], 'array') directly instead.

// Global Progress State
let timeRange = 'weekly';
let refDate = new Date();
refDate.setHours(0,0,0,0);
let customStartDate = null;
let customEndDate = null;

let showPomodoro = true;
let showHabits = true;
let compareMode = true;

// --- SMART JS TOOLTIP ENGINE ---
let globalTooltip = document.getElementById('heatmap-tooltip');
if (!globalTooltip) {
  globalTooltip = document.createElement('div');
  globalTooltip.id = 'heatmap-tooltip';
  globalTooltip.style.cssText = 'position: fixed; z-index: 99999; background: #1e293b; color: #f8fafc; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; pointer-events: none; opacity: 0; transition: opacity 0.15s ease-out; box-shadow: 0 4px 15px rgba(0,0,0,0.2); white-space: nowrap; line-height: 1.4;';
  document.body.appendChild(globalTooltip);
}

function attachSmartTooltip(block) {
  block.addEventListener('mouseenter', () => {
    globalTooltip.innerHTML = block.getAttribute('data-date');
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

// ==========================================
// DUAL-ENGINE DATE PARSERS (The Bug Fixes)
// ==========================================

// Parser 1: For Pomodoro (Matches exact local creation time) — provided
// by the shared getLocalDateKey() (date-utils.js); previously its own
// separately-duplicated copy of the same logic that also lived in
// timer.js.

// Parser 2: For Habits (delegates to habits.js's getDateKey so both files
// can never drift apart on how a "day" is defined). This used to be its
// own `dayjs(dateObj).format('YYYY-MM-DD')` call — removed along with the
// dayjs CDN dependency; see the FIX note on getDateKey() in habits.js.
const getHabitLogKey = getDateKey;

// ==========================================
// CORE RENDER FUNCTION
// ==========================================
export function renderProgressDashboard() {
  const currentTasks = readJSON('focusTasks', [], 'array');
  const currentHabits = readJSON('focusHabits', [], 'array');

  const bounds = getDateBounds(refDate, timeRange);

  const prevRefDate = new Date(bounds.start);
  if (timeRange === 'daily') {prevRefDate.setDate(prevRefDate.getDate() - 1);}
  else if (timeRange === 'weekly') {prevRefDate.setDate(prevRefDate.getDate() - 7);}
  else if (timeRange === 'monthly') {prevRefDate.setMonth(prevRefDate.getMonth() - 1);}
  else if (timeRange === 'custom') {
    const diffTime = Math.abs(bounds.end - bounds.start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    prevRefDate.setDate(bounds.start.getDate() - diffDays);
  }
  const prevBounds = getDateBounds(prevRefDate, timeRange);

  const currentStats = calculateStats(bounds.start, bounds.end, currentTasks, currentHabits);
  const prevStats = calculateStats(prevBounds.start, prevBounds.end, currentTasks, currentHabits);

  updateLeftPanelUI(currentStats, prevStats, bounds);
  renderFocusHeatmap(bounds.start, bounds.end, currentTasks);
  renderHabitHeatmap(bounds.start, bounds.end, currentHabits);

  if (readRaw('focusActiveTab') === '2') {document.title = 'Focus App - Dashboard';}
}

// ==========================================
// DATA CALCULATION ENGINE
// ==========================================
function calculateStats(startDate, endDate, currentTasks, currentHabits) {
  let focusMinutes = 0, itemsCompleted = 0, perfectDaysCount = 0;
  let totalExpectedLogs = 0, totalSuccessfulLogs = 0;
  let totalTasksCreated = 0, totalTasksCompleted = 0;

  const d = new Date(startDate);
  while (d <= endDate) {
    const localDateStr = getLocalDateKey(d);
    const habitLogKey = getHabitLogKey(d);

    let dailyFocus = 0, dailyTasksDone = 0, dailyHabitsExpected = 0, dailyHabitsDone = 0;

    if (showPomodoro) {
      currentTasks.forEach(t => {
        // TIME: attribute focus minutes to the day they were actually
        // earned (timeByDate), not the task's creation day. Tasks
        // created before this tracking existed have no timeByDate at
        // all — for those only, fall back to the old behavior
        // (all-time total credited to createdAt) so their existing
        // historical numbers aren't silently zeroed out.
        const dayTimeSeconds = t.timeByDate
        ? (t.timeByDate[localDateStr] || 0)
        : (getLocalDateKey(t.createdAt) === localDateStr ? (t.timeSpent || 0) : 0);
        dailyFocus += Math.floor(dayTimeSeconds / 60);

        // CREATED: still the day the task was made.
        if (getLocalDateKey(t.createdAt) === localDateStr) {
          totalTasksCreated++;
        }

        // COMPLETED: the day it was actually marked done (completedAt),
        // not the day it was created. Legacy tasks completed before
        // completedAt existed fall back to createdAt so they don't
        // silently stop counting anywhere.
        const completedOnThisDay = t.completed && (
          t.completedAt
          ? getLocalDateKey(t.completedAt) === localDateStr
          : getLocalDateKey(t.createdAt) === localDateStr
        );
        if (completedOnThisDay) {
          dailyTasksDone++;
          totalTasksCompleted++;
        }
      });
    }

    if (showHabits) {
      currentHabits.forEach(h => {
        const created = new Date(h.createdAt || h.id).setHours(0,0,0,0);
        if (d.getTime() >= created) {
          if (isHabitActiveOnDate(h, d)) {
            dailyHabitsExpected++;
            if (h.logs && h.logs[habitLogKey] === 'done') {dailyHabitsDone++;}
          }
        }
      });
    }

    focusMinutes += dailyFocus;
    itemsCompleted += (dailyTasksDone + dailyHabitsDone);
    totalExpectedLogs += dailyHabitsExpected;
    totalSuccessfulLogs += dailyHabitsDone;

    if (showHabits && dailyHabitsExpected > 0 && dailyHabitsDone === dailyHabitsExpected) {perfectDaysCount++;}
    else if (!showHabits && dailyTasksDone > 0) {perfectDaysCount++;}

    d.setDate(d.getDate() + 1);
  }

  return { focusMinutes, itemsCompleted, perfectDaysCount, totalExpectedLogs, totalSuccessfulLogs, totalTasksCreated, totalTasksCompleted };
}

function updateLeftPanelUI(curr, prev, bounds) {
  const title = document.getElementById('left-panel-title');
  const formatShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (title) {
    if (timeRange === 'daily') {title.textContent = formatShort(bounds.start);}
    else if (timeRange === 'weekly') {title.textContent = `${formatShort(bounds.start)} - ${formatShort(bounds.end)}`;}
    else if (timeRange === 'monthly') {title.textContent = bounds.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });}
    else if (timeRange === 'custom') {title.textContent = `${formatShort(bounds.start)} - ${formatShort(bounds.end)}`;}
  }

  // BUG FIX: True Weighted Average of Both Tabs!
  let totalItems = 0;
  let completedItems = 0;

  if (showPomodoro) {
    totalItems += curr.totalTasksCreated;
    completedItems += curr.totalTasksCompleted;
  }
  if (showHabits) {
    totalItems += curr.totalExpectedLogs;
    completedItems += curr.totalSuccessfulLogs;
  }

  const finalScore = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  const scoreVal = document.getElementById('hero-score-value');
  if (scoreVal) {scoreVal.textContent = `${finalScore}%`;}

  const ring = document.getElementById('hero-consistency-ring');
  if (ring) {
    const radius = (ring.r && ring.r.baseVal) ? ring.r.baseVal.value : 80;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (finalScore / 100) * circumference;
    ring.style.strokeDasharray = `${circumference} ${circumference}`;
    requestAnimationFrame(() => ring.style.strokeDashoffset = offset);
  }

  const hours = Math.floor(curr.focusMinutes / 60);
  const mins = curr.focusMinutes % 60;

  const statFocus = document.getElementById('stat-total-focus');
  const statItems = document.getElementById('stat-items-done');
  const statPerfect = document.getElementById('stat-perfect-days');

  if (statFocus) {statFocus.textContent = `${hours}h ${mins}m`;}
  if (statItems) {statItems.textContent = curr.itemsCompleted;}
  if (statPerfect) {statPerfect.textContent = curr.perfectDaysCount;}

  updateDeltaBadge('delta-focus', curr.focusMinutes, prev.focusMinutes, 'm');
  updateDeltaBadge('delta-items', curr.itemsCompleted, prev.itemsCompleted, '');
  updateDeltaBadge('delta-perfect', curr.perfectDaysCount, prev.perfectDaysCount, '');
}

function updateDeltaBadge(elementId, currVal, prevVal, suffix) {
  const badge = document.getElementById(elementId);
  if (!badge) {return;}

  if (!compareMode || timeRange === 'custom') {
    badge.classList.remove('show');
    return;
  }

  const diff = currVal - prevVal;
  badge.className = 'delta-badge show';

  if (diff > 0) {
    badge.classList.add('positive');
    badge.textContent = `↑ ${diff}${suffix}`;
  } else if (diff < 0) {
    badge.classList.add('negative');
    badge.textContent = `↓ ${Math.abs(diff)}${suffix}`;
  } else {
    badge.classList.add('neutral');
    badge.textContent = `- 0${suffix}`;
  }
}

// ==========================================
// HEATMAP RENDERING
// ==========================================
function renderFocusHeatmap(startDate, endDate, currentTasks) {
  const container = document.getElementById('prog-focus-container');
  const heatmap = document.getElementById('focus-heatmap');
  if (!container || !heatmap) {return;}

  if (!showPomodoro) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  heatmap.innerHTML = '';

  const days = getDaysArray(startDate, endDate);

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
      // calculateStats() above, which isn't a rate and has no such
      // constraint.
      if (getLocalDateKey(t.createdAt) === dateStr) {
        totalTasks++;
        if (t.completed) {doneTasks++;}
      }
    });

    const block = document.createElement('div');
    block.className = 'heatmap-block';
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const completionRate = totalTasks === 0 ? 0 : (doneTasks / totalTasks);

    // Dynamic Tooltip
    let tooltipHTML = `<span class="report-date-label">${displayDate}</span><br/>`;
    if (totalTasks > 0) {tooltipHTML += `${doneTasks}/${totalTasks} tasks done (${Math.round(completionRate*100)}%)<br/>${mins}m focus time`;}
    else if (mins > 0) {tooltipHTML += `0 tasks, ${mins}m focus time`;}
    else {tooltipHTML += `No activity`;}

    block.setAttribute('data-date', tooltipHTML);

    // BUG FIX: Color is now based strictly on Completion Rate!
    if (totalTasks > 0) {
      if (completionRate > 0 && completionRate < 0.5) {block.classList.add('focus-level-1');}
      else if (completionRate >= 0.5 && completionRate < 1) {block.classList.add('focus-level-2');}
      else if (completionRate === 1) {block.classList.add('focus-level-3');}
    } else if (mins > 0) {
      block.classList.add('focus-level-1'); // Fallback if they focused without tasks
    }

    block.addEventListener('click', () => openDailyReport(d));
    attachSmartTooltip(block);
    heatmap.appendChild(block);
  });
}

function renderHabitHeatmap(startDate, endDate, currentHabits) {
  const container = document.getElementById('prog-habit-container');
  const heatmap = document.getElementById('habit-heatmap');
  if (!container || !heatmap) {return;}

  if (!showHabits) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  heatmap.innerHTML = '';

  const days = getDaysArray(startDate, endDate);

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

    let tooltipHTML = `<span class="report-date-label">${displayDate}</span><br/>`;
    if (activeCount > 0) {
      const completionRate = Math.round((doneCount / activeCount) * 100);
      tooltipHTML += `${doneCount}/${activeCount} habits done (${completionRate}%)`;
    } else {
      tooltipHTML += `No scheduled habits`;
    }

    block.setAttribute('data-date', tooltipHTML);

    if (doneCount > 0) {
      const rate = doneCount / activeCount;
      if (rate > 0 && rate <= 0.33) {block.classList.add('habit-level-1');}
      else if (rate > 0.33 && rate <= 0.66) {block.classList.add('habit-level-2');}
      else if (rate > 0.66) {block.classList.add('habit-level-3');}
    }

    block.addEventListener('click', () => openDailyReport(d));
    attachSmartTooltip(block);
    heatmap.appendChild(block);
  });
}

// ==========================================
// DAILY REPORT MODAL
// ==========================================
function openDailyReport(dateObj) {
  const modal = document.getElementById('daily-report-modal');
  const title = document.getElementById('report-date-title');
  const body = document.getElementById('report-modal-body');
  if (!modal) {return;}

  const currentTasks = readJSON('focusTasks', [], 'array');
  const currentHabits = readJSON('focusHabits', [], 'array');

  const localDateStr = getLocalDateKey(dateObj);
  const habitLogKey = getHabitLogKey(dateObj);

  title.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let html = '';

  if (showPomodoro) {
    html += `<div class="report-section-title">Focus Tasks</div>`;
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
    buttonsHTML += `<button class="add-btn report-goto-btn focus" id="goto-focus-btn">Go to Focus</button>`;
  }
  if (showHabits) {
    buttonsHTML += `<button class="add-btn report-goto-btn habits" id="goto-habits-btn">Go to Habits</button>`;
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

// ==========================================
// DATE HELPERS
// ==========================================
function getDateBounds(date, range) {
  const d = new Date(date);
  d.setHours(0,0,0,0);

  if (range === 'daily') {return { start: new Date(d), end: new Date(d) };}
  if (range === 'weekly') {
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  if (range === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start, end };
  }
  if (range === 'custom') {return { start: customStartDate || new Date(), end: customEndDate || new Date() };}
}

function getDaysArray(start, end) {
  const arr = [];
  const d = new Date(start);
  while (d <= end) {
    arr.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

// ==========================================
// EVENT LISTENERS INITIALIZATION
// ==========================================
export function setupProgressEvents() {

  document.addEventListener('dataUpdated', () => {
    const progressView = document.getElementById('progress-view');
    if (progressView && progressView.style.display !== 'none') {
      renderProgressDashboard();
    }
  });

  document.addEventListener('progressTabOpened', () => {
    renderProgressDashboard();
  });

  const prevBtn = document.getElementById('prog-prev-btn');
  const nextBtn = document.getElementById('prog-next-btn');

  if (prevBtn) {prevBtn.addEventListener('click', () => {
    if (timeRange === 'daily') {refDate.setDate(refDate.getDate() - 1);}
    else if (timeRange === 'weekly') {refDate.setDate(refDate.getDate() - 7);}
    else if (timeRange === 'monthly') {refDate.setMonth(refDate.getMonth() - 1);}
    else if (timeRange === 'custom') {
      const bounds = getDateBounds(refDate, 'custom');
      const diffDays = Math.ceil(Math.abs(bounds.end - bounds.start) / (1000 * 60 * 60 * 24)) + 1;
      customStartDate.setDate(customStartDate.getDate() - diffDays);
      customEndDate.setDate(customEndDate.getDate() - diffDays);
    }
    renderProgressDashboard();
  });}

  if (nextBtn) {nextBtn.addEventListener('click', () => {
    if (timeRange === 'daily') {refDate.setDate(refDate.getDate() + 1);}
    else if (timeRange === 'weekly') {refDate.setDate(refDate.getDate() + 7);}
    else if (timeRange === 'monthly') {refDate.setMonth(refDate.getMonth() + 1);}
    else if (timeRange === 'custom') {
      const bounds = getDateBounds(refDate, 'custom');
      const diffDays = Math.ceil(Math.abs(bounds.end - bounds.start) / (1000 * 60 * 60 * 24)) + 1;
      customStartDate.setDate(customStartDate.getDate() + diffDays);
      customEndDate.setDate(customEndDate.getDate() + diffDays);
    }
    renderProgressDashboard();
  });}

  const rangeBtn = document.getElementById('prog-range-btn');
  const rangeDropdown = document.getElementById('prog-range-dropdown');
  const rangeDisplay = document.getElementById('prog-range-display');
  const customRangeModal = document.getElementById('custom-range-modal');

  if (rangeBtn && rangeDropdown) {
    rangeDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const selectedRange = item.dataset.range;
        rangeDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active-sort'));
        item.classList.add('active-sort');

        if (selectedRange === 'custom') {
          if (customRangeModal) {customRangeModal.classList.add('show');}
        } else {
          timeRange = selectedRange;
          refDate = new Date();
          if (rangeDisplay) {rangeDisplay.textContent = item.textContent;}
          renderProgressDashboard();
        }
        rangeDropdown.classList.remove('show');
      });
    });

    setupSelectDropdown({ wrapperId: 'prog-range-wrapper', triggerId: 'prog-range-btn', dropdownId: 'prog-range-dropdown' });
  }

  const applyCustomBtn = document.getElementById('apply-custom-range');
  const closeCustomBtn = document.getElementById('close-custom-range');

  if (closeCustomBtn && customRangeModal) {closeCustomBtn.addEventListener('click', () => customRangeModal.classList.remove('show'));}

  if (applyCustomBtn && customRangeModal) {
    applyCustomBtn.addEventListener('click', () => {
      const startInput = document.getElementById('range-start-input').value;
      const endInput = document.getElementById('range-end-input').value;
      if (startInput && endInput) {
        customStartDate = new Date(startInput);
        customEndDate = new Date(endInput);
        customStartDate.setHours(0,0,0,0);
        customEndDate.setHours(23,59,59,999);

        if (customStartDate > customEndDate) {
          showToast("Start date must be before end date.", "warning");
          return;
        }

        const diffDays = Math.ceil(Math.abs(customEndDate - customStartDate) / (1000 * 60 * 60 * 24)) + 1;

        // BUG FIX: Dynamic limit based on available vertical space!
        const maxAllowedDays = (showPomodoro && showHabits) ? 60 : 100;

        if (diffDays > maxAllowedDays) {
          if (typeof showToast === 'function') {
            showToast(`Please select a range of ${maxAllowedDays} days or less.`, "warning");
          }
          return;
        }

        timeRange = 'custom';
        if (rangeDisplay) {rangeDisplay.textContent = "Custom Range";}
        customRangeModal.classList.remove('show');
        renderProgressDashboard();
      }
    });
  }

  const setBtn = document.getElementById('prog-settings-btn');
  const setModal = document.getElementById('progress-settings-modal');
  const closeSet = document.getElementById('close-prog-settings');
  const saveProgSetBtn = document.getElementById('save-prog-settings');
  const repModal = document.getElementById('daily-report-modal');
  const closeRep = document.getElementById('close-report-modal');

  const togFocus = document.getElementById('prog-toggle-focus');
  const togHabits = document.getElementById('prog-toggle-habits');
  const togComp = document.getElementById('prog-toggle-compare');
  const progDarkMode = document.getElementById('prog-dark-mode');
  const progSound = document.getElementById('prog-sound-toggle');
  const mainDarkMode = document.getElementById('dark-mode-toggle');
  const mainSound = document.getElementById('sound-toggle');

  if (setBtn && setModal) {
    setBtn.addEventListener('click', () => {
      if (togFocus) {togFocus.checked = showPomodoro;}
      if (togHabits) {togHabits.checked = showHabits;}
      if (togComp) {togComp.checked = compareMode;}
      if (progDarkMode && mainDarkMode) {progDarkMode.checked = mainDarkMode.checked;}
      if (progSound && mainSound) {progSound.checked = mainSound.checked;}
      setModal.classList.add('show');
    });
  }

  if (closeSet && setModal) {closeSet.addEventListener('click', () => setModal.classList.remove('show'));}
  if (closeRep && repModal) {closeRep.addEventListener('click', () => repModal.classList.remove('show'));}

  if (saveProgSetBtn) {
    saveProgSetBtn.addEventListener('click', () => {
      if (togFocus) {showPomodoro = togFocus.checked;}
      if (togHabits) {showHabits = togHabits.checked;}
      if (togComp) {compareMode = togComp.checked;}

      if (progDarkMode && mainDarkMode) {
        mainDarkMode.checked = progDarkMode.checked;
        if (progDarkMode.checked) {document.body.setAttribute('data-theme', 'dark');}
        else {document.body.removeAttribute('data-theme');}
      }
      if (progSound && mainSound) {mainSound.checked = progSound.checked;}

      const mainSaveBtn = document.getElementById('save-settings');
      if (mainSaveBtn) {mainSaveBtn.click();}

      // BUG FIX: Protect the layout! If both tabs are now ON, and they have a massive custom range active, shrink it.
      if (showPomodoro && showHabits && timeRange === 'custom') {
        const diffDays = Math.ceil(Math.abs(customEndDate - customStartDate) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 60) {
          // Forcefully shrink the start date to be exactly 60 days from the end date
          customStartDate = new Date(customEndDate);
          customStartDate.setDate(customStartDate.getDate() - 59);
          if (typeof showToast === 'function') {
            showToast("Range automatically adjusted to 60 days to fit both charts.", "warning");
          }
        }
      }

      renderProgressDashboard();
      setModal.classList.remove('show');
    });
  }

  document.addEventListener('click', (e) => {
    if (setModal && e.target === setModal) {setModal.classList.remove('show');}
    if (repModal && e.target === repModal) {repModal.classList.remove('show');}
    if (customRangeModal && e.target === customRangeModal) {customRangeModal.classList.remove('show');}
  });

  document.addEventListener('tabChanged', () => {
    if (readRaw('focusActiveTab') === '2') {document.title = 'Focus App - Dashboard';}
  });
}