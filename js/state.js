// ==========================================
// SAFE STORAGE READ
// ==========================================
// Without this, one corrupted/tampered localStorage key throws inside
// JSON.parse at module-load time. Since every other module imports from
// state.js, that single throw kills the whole app at startup (blank white
// screen, nothing recoverable without the user manually clearing storage).
// safeParse guarantees state.js always finishes loading with sane defaults.
function safeParse(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (err) {
    console.warn(`Corrupted data in localStorage["${key}"], resetting to default.`, err);
    return fallback;
  }
}

// ==========================================
// APP INITIAL STATE (GLOBAL VARIABLES)
// ==========================================

// --- TIMER STATE ---
export let totalTime = 25 * 60; 
export let timeLeft = totalTime; 
export let timerId = null; 
export let isRunning = false;
export let currentPhase = 'work'; 
export let completedSessions = 0; 

// --- TASKS STATE ---
export let tasks = safeParse('focusTasks', []);
export let focusedTaskId = safeParse('focusedTaskId', null);
export let savedTags = safeParse('focusTagsList', ['Work', 'Study', 'Personal']);
export let currentFilter = 'all';
export let currentSort = 'newest'; 
export let sortOrder = 'desc'; 

// --- HABITS STATE ---
export let habits = safeParse('focusHabits', []);
export let savedHabitCategories = safeParse('focusHabitCategories', ['Health', 'Learning', 'Productivity', 'Mindfulness']);
export let currentHabitDate = new Date();
currentHabitDate.setHours(0, 0, 0, 0);

// ==========================================
// STATE SETTERS (For Module Mutation)
// ==========================================
export function setTimerId(val) { timerId = val; }
export function setIsRunning(val) { isRunning = val; }
export function setTimeLeft(val) { timeLeft = val; }
export function setTotalTime(val) { totalTime = val; }
export function setCurrentPhase(val) { currentPhase = val; }
export function setCompletedSessions(val) { completedSessions = val; }

export function setTasks(val) { tasks = val; }
export function setFocusedTaskId(val) { focusedTaskId = val; }
export function setSavedTags(val) { savedTags = val; }
export function setCurrentFilter(val) { currentFilter = val; }
export function setCurrentSort(val) { currentSort = val; }
export function setSortOrder(val) { sortOrder = val; }

export function setCurrentHabitDate(val) { currentHabitDate = val; }