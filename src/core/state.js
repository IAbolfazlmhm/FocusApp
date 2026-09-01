import { readJSON, STORAGE_KEYS } from './storage.js';

// ==========================================
// APP INITIAL STATE (GLOBAL VARIABLES)
// ==========================================
// NOTE ON THIS PATTERN: these are module-level `let` exports with a
// matching setter function for each one (e.g. `timeLeft` + `setTimeLeft`).
// That's needed because reassigning an imported binding directly
// (`timeLeft = 5`) only rebinds the LOCAL copy in whatever file does it —
// other modules that imported `timeLeft` would never see the change. The
// setter functions run inside this module, where the reassignment is real.
// It works, but it is effectively a global-variables pattern with extra
// steps. If this app grows further, consider replacing this file with a
// single mutable `state` object (`state.timeLeft`, mutated in place) or a
// tiny pub/sub store — either removes the need for a setter per field.

// --- TIMER STATE ---
export let totalTime = 25 * 60;
export let timeLeft = totalTime;
export let timerId = null;
export let isRunning = false;
export let currentPhase = 'work';
export let completedSessions = 0;

// --- TASKS STATE ---
export let tasks = readJSON(STORAGE_KEYS.TASKS, [], 'array');
export let focusedTaskId = readJSON(STORAGE_KEYS.FOCUSED_TASK_ID, null);
export let savedTags = readJSON(STORAGE_KEYS.TAGS_LIST, ['Work', 'Study', 'Personal'], 'array');
// Custom user-picked colors, keyed by tag name (e.g. { "Work": "#3b82f6" }).
// A tag with no entry here just falls back to its deterministic hash color
// (see getTagColor in color-utils.js) — this only needs to store the tags
// someone has actually chosen to override.
export let tagColors = readJSON(STORAGE_KEYS.TAG_COLORS, {});

const savedTaskPrefs = readJSON(STORAGE_KEYS.TASK_VIEW_PREFS, {});
export let currentFilter = savedTaskPrefs.filter || 'all';
export let currentSort = savedTaskPrefs.sort || 'newest';
export let sortOrder = savedTaskPrefs.sortOrder || 'desc';

// --- HABITS STATE ---
export let habits = readJSON(STORAGE_KEYS.HABITS, [], 'array');
export let savedHabitCategories = readJSON(STORAGE_KEYS.HABIT_CATEGORIES, ['Health', 'Learning', 'Productivity', 'Mindfulness'], 'array');
export let categoryColors = readJSON(STORAGE_KEYS.CATEGORY_COLORS, {});
export let currentHabitDate = new Date();
currentHabitDate.setHours(0, 0, 0, 0);

const savedHabitPrefs = readJSON(STORAGE_KEYS.HABIT_VIEW_PREFS, {});
export let currentHabitFilter = savedHabitPrefs.filter || 'all';
export let currentHabitSort = savedHabitPrefs.sort || 'newest';
export let habitSortOrder = savedHabitPrefs.sortOrder || 'desc';

// --- POMODORO/TASKS DATE STATE ---
// FIX: used to be an `export let` living directly in tasks.js — the one
// piece of shared date state that wasn't centralized here alongside its
// sibling currentHabitDate above. Moved here for the same reason
// everything else in this file is here: any other module that needs to
// read or change it does so through this single source of truth, instead
// of importing it from whichever feature file happened to declare it
// first.
export let currentPomodoroDate = new Date();
currentPomodoroDate.setHours(0, 0, 0, 0);

// --- QUOTES STATE ---
// User-created quotes only. Built-in quotes are loaded separately by
// motivation.js straight from assets/motivation.json and never touch
// localStorage — keeping the two pools structurally separate rather than
// merging them into one array on disk (see motivation.js for how they're
// combined at read time for rotation).
export let userQuotes = readJSON(STORAGE_KEYS.USER_QUOTES, [], 'array');

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
export function setTagColors(val) { tagColors = val; }
export function setCurrentFilter(val) { currentFilter = val; }
export function setCurrentSort(val) { currentSort = val; }
export function setSortOrder(val) { sortOrder = val; }

export function setHabits(val) { habits = val; }
export function setSavedHabitCategories(val) { savedHabitCategories = val; }
export function setCategoryColors(val) { categoryColors = val; }
export function setCurrentHabitDate(val) { currentHabitDate = val; }
export function setCurrentPomodoroDate(val) { currentPomodoroDate = val; }
export function setCurrentHabitFilter(val) { currentHabitFilter = val; }
export function setCurrentHabitSort(val) { currentHabitSort = val; }
export function setHabitSortOrder(val) { habitSortOrder = val; }

export function setUserQuotes(val) { userQuotes = val; }