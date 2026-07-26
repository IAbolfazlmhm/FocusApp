import { readJSON } from './storage.js';

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
export let tasks = readJSON('focusTasks', [], 'array');
export let focusedTaskId = readJSON('focusedTaskId', null);
export let savedTags = readJSON('focusTagsList', ['Work', 'Study', 'Personal'], 'array');
// Custom user-picked colors, keyed by tag name (e.g. { "Work": "#3b82f6" }).
// A tag with no entry here just falls back to its deterministic hash color
// (see getTagColor in ui-utils.js) — this only needs to store the tags
// someone has actually chosen to override.
export let tagColors = readJSON('focusTagColors', {});
export let currentFilter = 'all';
export let currentSort = 'newest';
export let sortOrder = 'desc';

// --- HABITS STATE ---
export let habits = readJSON('focusHabits', [], 'array');
export let savedHabitCategories = readJSON('focusHabitCategories', ['Health', 'Learning', 'Productivity', 'Mindfulness'], 'array');
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
export function setTagColors(val) { tagColors = val; }
export function setCurrentFilter(val) { currentFilter = val; }
export function setCurrentSort(val) { currentSort = val; }
export function setSortOrder(val) { sortOrder = val; }

export function setHabits(val) { habits = val; }
export function setSavedHabitCategories(val) { savedHabitCategories = val; }
export function setCurrentHabitDate(val) { currentHabitDate = val; }