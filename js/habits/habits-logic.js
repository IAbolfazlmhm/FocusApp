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
    return habit.customDays.map(Number).includes(dayOfWeek);
  }

  if (freq === 'interval') {
    // "Repeat every N days" — due on creation day and every Nth day
    // after it, regardless of day-of-week (habits.js clamps intervalDays
    // to 2-365 at save time; 3 here is just a defensive fallback for
    // any pre-existing record that somehow lacks it).
    const intervalDays = habit.intervalDays || 3;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceCreation = Math.round((target.getTime() - creationDate.getTime()) / msPerDay);
    return daysSinceCreation % intervalDays === 0;
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
