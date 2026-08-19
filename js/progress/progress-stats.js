// ==========================================
// PROGRESS: DATA CALCULATION ENGINE
// ==========================================
// Pure calculation only — no DOM reads/writes. This is what
// tests/progress-stats.test.js exercises directly; keeping this file free
// of document.* calls is what makes that possible without a browser.
import { getDateKey, isHabitActiveOnDate } from '../habits/habits-logic.js';
import { readJSON, STORAGE_KEYS } from '../core/storage.js';
import { getLocalDateKey } from '../core/date-utils.js';

// For Habits (delegates to habits.js's getDateKey so both files can never
// drift apart on how a "day" is defined). This used to be its own
// `dayjs(dateObj).format('YYYY-MM-DD')` call — removed along with the
// dayjs CDN dependency; see the FIX note on getDateKey() in habits.js.
export const getHabitLogKey = getDateKey;

export function getDaysArray(start, end) {
  const arr = [];
  const d = new Date(start);
  while (d <= end) {
    arr.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

// showPomodoro/showHabits default to true (matching this app's default
// display settings) so every existing call site — including every test —
// that doesn't care about the toggles keeps working unchanged. progress.js
// (the only place these toggles are actually set, via the Settings
// checkboxes) passes its live values explicitly instead.
export function calculateStats(startDate, endDate, currentTasks, currentHabits, showPomodoro = true, showHabits = true) {
  let focusMinutes = 0, focusSeconds = 0, itemsCompleted = 0, perfectDaysCount = 0;
  let totalExpectedLogs = 0, totalSuccessfulLogs = 0;
  let totalTasksCreated = 0, totalTasksCompleted = 0;

  // Taskless-session time (see timer.js's addTasklessFocusTime, which
  // writes this same key) — read locally rather than importing a value
  // from timer.js, since STORAGE_KEYS (storage.js) is already the single
  // shared source of truth for the key name itself.
  const tasklessByDate = readJSON(STORAGE_KEYS.TASKLESS_TIME, {});

  const d = new Date(startDate);
  while (d <= endDate) {
    const localDateStr = getLocalDateKey(d);
    const habitLogKey = getHabitLogKey(d);

    let dailyFocus = 0, dailyFocusSeconds = 0, dailyTasksDone = 0, dailyHabitsExpected = 0, dailyHabitsDone = 0;

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
        dailyFocusSeconds += dayTimeSeconds;

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

      // Taskless sessions earned this day — previously discarded
      // entirely (nothing stored them). Counted alongside task time
      // here since both represent real work-phase minutes; the Daily
      // Report modal (progress-report.js) breaks the two back out
      // separately for anyone who wants that distinction.
      dailyFocus += Math.floor((tasklessByDate[localDateStr] || 0) / 60);
      dailyFocusSeconds += (tasklessByDate[localDateStr] || 0);
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
    focusSeconds += dailyFocusSeconds;
    itemsCompleted += (dailyTasksDone + dailyHabitsDone);
    totalExpectedLogs += dailyHabitsExpected;
    totalSuccessfulLogs += dailyHabitsDone;

    if (showHabits && dailyHabitsExpected > 0 && dailyHabitsDone === dailyHabitsExpected) {perfectDaysCount++;}
    else if (!showHabits && dailyTasksDone > 0) {perfectDaysCount++;}

    d.setDate(d.getDate() + 1);
  }

  return { focusMinutes, focusSeconds, itemsCompleted, perfectDaysCount, totalExpectedLogs, totalSuccessfulLogs, totalTasksCreated, totalTasksCompleted };
}
