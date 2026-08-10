import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHabitActiveOnDate, calculateStreak, getDateKey } from '../js/habits.js';

// Fixed reference point so these tests don't depend on the day they
// happen to run. A Wednesday.
const WED = new Date(2026, 7, 5); // Aug 5, 2026 is a Wednesday
const dayOffset = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

function makeHabit(overrides = {}) {
  return {
    id: 1,
    name: 'Test habit',
    createdAt: WED.getTime(),
    frequency: 'everyday',
    logs: {},
    ...overrides,
  };
}

test('isHabitActiveOnDate: an "everyday" habit is active every day on/after creation', () => {
  const habit = makeHabit({ frequency: 'everyday' });
  assert.equal(isHabitActiveOnDate(habit, WED), true);
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 5)), true);
});

test('isHabitActiveOnDate: never active before the habit was created', () => {
  const habit = makeHabit({ frequency: 'everyday' });
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, -1)), false);
});

test('isHabitActiveOnDate: a specific-weekday habit ("monday") is only active on that weekday', () => {
  const habit = makeHabit({ frequency: 'monday', createdAt: dayOffset(WED, -2).getTime() });
  const mondayAfter = dayOffset(WED, 5); // next Monday after this Wednesday
  assert.equal(isHabitActiveOnDate(habit, WED), false);
  assert.equal(isHabitActiveOnDate(habit, mondayAfter), true);
});

test('isHabitActiveOnDate: "custom" frequency is active only on the listed weekdays', () => {
  // customDays: 1 = Monday, 3 = Wednesday (per the 0=Sunday map in habits.js)
  const habit = makeHabit({ frequency: 'custom', customDays: [1, 3] });
  assert.equal(isHabitActiveOnDate(habit, WED), true); // Wednesday
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 1)), false); // Thursday
});

test('isHabitActiveOnDate: "custom" with no days configured is never active', () => {
  const habit = makeHabit({ frequency: 'custom', customDays: [] });
  assert.equal(isHabitActiveOnDate(habit, WED), false);
});

test('isHabitActiveOnDate: "weekly" is active only on the same weekday it was created', () => {
  const habit = makeHabit({ frequency: 'weekly', createdAt: WED.getTime() });
  assert.equal(isHabitActiveOnDate(habit, WED), true);
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 7)), true);
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 1)), false);
});

test('isHabitActiveOnDate: "biweekly" skips alternate weeks', () => {
  const habit = makeHabit({ frequency: 'biweekly', createdAt: WED.getTime() });
  assert.equal(isHabitActiveOnDate(habit, WED), true); // week 0 — active
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 7)), false); // week 1 — skipped
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 14)), true); // week 2 — active
});

test('isHabitActiveOnDate: a stopped habit (endDate) is inactive after that date', () => {
  const stopDay = dayOffset(WED, 3);
  const habit = makeHabit({ frequency: 'everyday', endDate: stopDay.getTime() });
  assert.equal(isHabitActiveOnDate(habit, stopDay), true); // still active on the stop day itself
  assert.equal(isHabitActiveOnDate(habit, dayOffset(WED, 4)), false); // inactive the day after
});

test('calculateStreak: counts consecutive "done" days ending today', () => {
  const today = getDateKey(new Date());
  const yesterday = getDateKey(dayOffset(new Date(), -1));
  const twoDaysAgo = getDateKey(dayOffset(new Date(), -2));
  const habit = makeHabit({
    createdAt: dayOffset(new Date(), -10).getTime(),
    logs: { [today]: 'done', [yesterday]: 'done', [twoDaysAgo]: 'done' },
  });
  assert.equal(calculateStreak(habit), 3);
});

test('calculateStreak: a gap (neither done nor skipped) breaks the streak', () => {
  const today = getDateKey(new Date());
  const yesterday = getDateKey(dayOffset(new Date(), -1));
  // Two days ago is missing entirely — should stop the count there.
  const habit = makeHabit({
    createdAt: dayOffset(new Date(), -10).getTime(),
    logs: { [today]: 'done', [yesterday]: 'done' },
  });
  assert.equal(calculateStreak(habit), 2);
});

test('calculateStreak: a "skipped" day does not break the streak (but does not count toward it either)', () => {
  const today = getDateKey(new Date());
  const yesterday = getDateKey(dayOffset(new Date(), -1));
  const twoDaysAgo = getDateKey(dayOffset(new Date(), -2));
  const habit = makeHabit({
    createdAt: dayOffset(new Date(), -10).getTime(),
    logs: { [today]: 'done', [yesterday]: 'skipped', [twoDaysAgo]: 'done' },
  });
  // Only "done" days increment the streak counter; "skipped" is a no-op
  // that just doesn't reset it — so this is 2 (today + two days ago),
  // not 3, even though the chain isn't broken.
  assert.equal(calculateStreak(habit), 2);
});

test('calculateStreak: today not yet logged does not break an otherwise-continuing streak', () => {
  const yesterday = getDateKey(dayOffset(new Date(), -1));
  const twoDaysAgo = getDateKey(dayOffset(new Date(), -2));
  const habit = makeHabit({
    createdAt: dayOffset(new Date(), -10).getTime(),
    logs: { [yesterday]: 'done', [twoDaysAgo]: 'done' },
  });
  assert.equal(calculateStreak(habit), 2);
});

test('calculateStreak: a brand-new habit with no logs has a streak of 0', () => {
  const habit = makeHabit({ createdAt: new Date().getTime(), logs: {} });
  assert.equal(calculateStreak(habit), 0);
});
