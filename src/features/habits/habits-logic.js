// ==========================================
// HABIT SCHEDULING & STREAK LOGIC (pure — no DOM, no storage)
// ==========================================
// Kept separate from habits.js's rendering/event-wiring code for two
// reasons: this is what tests/habits-logic.test.js exercises directly
// without needing a DOM at all, and it's a genuinely shared dependency —
// progress-stats.js, progress-heatmap.js, and progress-report.js all need
// isHabitActiveOnDate() to know whether a given day counts for a habit,
// with no reason to also pull in habits.js's ~700 lines of modal/form/
// event-wiring code just to get it.

// FIX: this used to come from the dayjs CDN script tag in index.html
// (`dayjs(dateObj).format('YYYY-MM-DD')`) — meaning if that CDN was ever
// slow, blocked (ad blockers, restrictive networks, offline use), or the
// <script> tag ever got removed, every habit feature would silently break
// with a "dayjs is not defined" error. This does the exact same
// YYYY-MM-DD local-date formatting timer.js and tasks.js already do
// elsewhere in the app, with zero dependencies and zero network requests.
export function getDateKey(dateObj) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    if (!habit.customDays.map(Number).includes(dayOfWeek)) {return false;}

    // "Every: [N] [Week(s)/Month(s)]" — replaces the old separate
    // "Custom Interval" frequency (habit.repeatEvery didn't exist before
    // this). Missing/invalid data defaults to every 1 week, i.e. exactly
    // the old plain "Custom Days" behavior with no skipping, so existing
    // custom-day habits saved before this feature keep working unchanged.
    const repeatEvery = habit.repeatEvery;
    const everyValue = Math.max(1, parseInt(repeatEvery && repeatEvery.value, 10) || 1);
    const everyUnit = (repeatEvery && repeatEvery.unit === 'month') ? 'month' : 'week';

    if (everyValue <= 1) {return true;}

    if (everyUnit === 'month') {
      // Active only in months where monthsSinceCreation is a multiple of
      // everyValue — every selected weekday within a qualifying month.
      const monthsSinceCreation = (target.getFullYear() - creationDate.getFullYear()) * 12
        + (target.getMonth() - creationDate.getMonth());
      return monthsSinceCreation % everyValue === 0;
    }

    // 'week' (default): align to the Sunday-starting week of creation —
    // same week-counting approach as the 'biweekly' preset below — so
    // every selected weekday stays in sync with the same "week block"
    // instead of drifting against each other.
    const weekStart = (d) => {
      const s = new Date(d);
      s.setDate(s.getDate() - s.getDay());
      s.setHours(0, 0, 0, 0);
      return s;
    };
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceCreation = Math.round((weekStart(target).getTime() - weekStart(creationDate).getTime()) / msPerWeek);
    return weeksSinceCreation % everyValue === 0;
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
