// ==========================================
// CENTRALIZED LOCALSTORAGE ACCESS
// ==========================================
// FIX: Previously every module (habits.js, progress.js, settings.js,
// tasks.js, timer.js) called localStorage.getItem/setItem directly, so the
// safeParse() protection that state.js had only covered the very first
// load. Any write later in the app's life, or a read in a different file,
// could still throw on corrupted/tampered data. Routing everything through
// this one module means "storage can never crash the app" is true
// everywhere, not just at startup — and if the storage strategy ever needs
// to change (e.g. namespacing keys, adding a quota-exceeded fallback), it
// only needs to change here.

// FIX: the key name for each of these was a raw string literal repeated
// at every call site across 8 files (40+ occurrences total) — 'focusTasks'
// typed out again in tasks.js, progress.js, and main.js, and so on for
// every key below. A typo in any one of those occurrences wouldn't throw;
// it would just silently read/write a new, disconnected key that happened
// to look almost right. One definition per key here means every call site
// either imports the real thing or fails to import at all — never a typo
// that quietly works.
export const STORAGE_KEYS = {
  ACTIVE_TAB: 'focusActiveTab',
  TASKS: 'focusTasks',
  HABITS: 'focusHabits',
  HABIT_CATEGORIES: 'focusHabitCategories',
  USER_QUOTES: 'focusUserQuotes',
  TIMER_STATE: 'focusTimerState',
  TASKLESS_TIME: 'focusTasklessTime',
  SETTINGS: 'focusSettings',
  FOCUSED_TASK_ID: 'focusedTaskId',
  TAGS_LIST: 'focusTagsList',
  TAG_COLORS: 'focusTagColors',
  CATEGORY_COLORS: 'focusCategoryColors',
  TRASH: 'focusTrash',
  BUILT_IN_QUOTE_OVERRIDES: 'focusBuiltInQuoteOverrides',
  HELP_STATE: 'focusHelpState',
  PROGRESS_VIEW_PREFS: 'focusProgressViewPrefs',
  TASK_VIEW_PREFS: 'focusTaskViewPrefs',
  HABIT_VIEW_PREFS: 'focusHabitViewPrefs'
};

/**
 * Read and JSON.parse a key, falling back safely if it's missing, invalid
 * JSON, or (when expectedType is 'array') the wrong shape.
 */
export function readJSON(key, fallback, expectedType = null) {
  const raw = localStorage.getItem(key);
  if (raw === null) {return fallback;}
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) {return fallback;}
    if (expectedType === 'array' && !Array.isArray(parsed)) {
      console.warn(`localStorage["${key}"] was valid JSON but not an array, resetting to default.`);
      return fallback;
    }
    return parsed;
  } catch (err) {
    console.warn(`Corrupted data in localStorage["${key}"], resetting to default.`, err);
    return fallback;
  }
}

/**
 * JSON.stringify and write a key. Wrapped in try/catch because
 * localStorage.setItem can throw (private browsing mode in some browsers,
 * or quota exceeded) — better to lose one save than crash the app.
 */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Failed to save localStorage["${key}"].`, err);
    return false;
  }
}

/** Read a raw (non-JSON) string value, e.g. the active tab index. */
export function readRaw(key, fallback = null) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw;
}

/** Write a raw (non-JSON) string value. */
export function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Failed to save localStorage["${key}"].`, err);
    return false;
  }
}

export function remove(key) {
  localStorage.removeItem(key);
}
