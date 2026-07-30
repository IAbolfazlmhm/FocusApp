// ==========================================
// DATE UTILITIES
// ==========================================
// Shared YYYY-MM-DD local-date formatting, used anywhere a "day" needs to
// be treated as a plain calendar date rather than a precise timestamp
// (grouping focus time by day, matching a task's creation day, etc.).
// Previously duplicated as two separately-maintained copies with
// identical logic under different names — localDateKey() in timer.js and
// getLocalDateStr() in progress.js. One shared version here means a
// future date-formatting bug (e.g. a timezone edge case) only needs
// fixing in one place instead of two.
export function getLocalDateKey(dateObj = new Date()) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}