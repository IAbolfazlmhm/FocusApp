import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats } from '../js/progress.js';
import { getLocalDateKey } from '../js/date-utils.js';

function dayAt(y, m, d) {
  const date = new Date(y, m, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

test('calculateStats sums focus minutes across the date range from timeByDate', () => {
  const start = dayAt(2026, 7, 1);
  const end = dayAt(2026, 7, 2);
  const tasks = [
    {
      createdAt: dayAt(2026, 7, 1).getTime(),
      completed: false,
      timeByDate: {
        [getLocalDateKey(dayAt(2026, 7, 1))]: 600,  // 10 min
        [getLocalDateKey(dayAt(2026, 7, 2))]: 1200, // 20 min
      },
    },
  ];
  const stats = calculateStats(start, end, tasks, []);
  assert.equal(stats.focusMinutes, 30);
});

test('calculateStats falls back to timeSpent (all attributed to createdAt) for legacy tasks with no timeByDate', () => {
  const day = dayAt(2026, 7, 1);
  const tasks = [
    { createdAt: day.getTime(), completed: false, timeSpent: 300 }, // 5 min, no timeByDate
  ];
  const stats = calculateStats(day, day, tasks, []);
  assert.equal(stats.focusMinutes, 5);
});

test('calculateStats counts a task as completed on its completedAt day, not its createdAt day', () => {
  const created = dayAt(2026, 7, 1);
  const completed = dayAt(2026, 7, 3);
  const tasks = [
    { createdAt: created.getTime(), completed: true, completedAt: completed.getTime() },
  ];
  const statsOnCreatedDay = calculateStats(created, created, tasks, []);
  const statsOnCompletedDay = calculateStats(completed, completed, tasks, []);
  assert.equal(statsOnCreatedDay.itemsCompleted, 0);
  assert.equal(statsOnCompletedDay.itemsCompleted, 1);
  assert.equal(statsOnCompletedDay.totalTasksCompleted, 1);
});

test('calculateStats falls back to createdAt for a legacy completed task with no completedAt', () => {
  const created = dayAt(2026, 7, 1);
  const tasks = [
    { createdAt: created.getTime(), completed: true }, // no completedAt at all
  ];
  const stats = calculateStats(created, created, tasks, []);
  assert.equal(stats.itemsCompleted, 1);
});

test('calculateStats counts a perfect day when every active habit was done', () => {
  const day = dayAt(2026, 7, 5); // a Wednesday
  const habits = [
    { createdAt: dayAt(2026, 7, 1).getTime(), frequency: 'everyday', logs: { [getLocalDateKey(day)]: 'done' } },
  ];
  const stats = calculateStats(day, day, [], habits);
  assert.equal(stats.perfectDaysCount, 1);
  assert.equal(stats.totalExpectedLogs, 1);
  assert.equal(stats.totalSuccessfulLogs, 1);
});

test('calculateStats does not count a perfect day when a habit was expected but not done', () => {
  const day = dayAt(2026, 7, 5);
  const habits = [
    { createdAt: dayAt(2026, 7, 1).getTime(), frequency: 'everyday', logs: {} },
  ];
  const stats = calculateStats(day, day, [], habits);
  assert.equal(stats.perfectDaysCount, 0);
  assert.equal(stats.totalExpectedLogs, 1);
  assert.equal(stats.totalSuccessfulLogs, 0);
});

test('calculateStats returns all zeros for an empty range with no tasks or habits', () => {
  const day = dayAt(2026, 7, 5);
  const stats = calculateStats(day, day, [], []);
  assert.deepEqual(stats, {
    focusMinutes: 0,
    itemsCompleted: 0,
    perfectDaysCount: 0,
    totalExpectedLogs: 0,
    totalSuccessfulLogs: 0,
    totalTasksCreated: 0,
    totalTasksCompleted: 0,
  });
});
