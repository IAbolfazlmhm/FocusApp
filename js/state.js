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
export let tasks = JSON.parse(localStorage.getItem('focusTasks')) || [];
export let focusedTaskId = JSON.parse(localStorage.getItem('focusedTaskId')) || null;
export let savedTags = JSON.parse(localStorage.getItem('focusTagsList')) || ['Work', 'Study', 'Personal'];
export let currentFilter = 'all';
export let currentSort = 'newest'; 
export let sortOrder = 'desc'; 

// --- HABITS STATE ---
export let habits = JSON.parse(localStorage.getItem('focusHabits')) || [];
export let savedHabitCategories = JSON.parse(localStorage.getItem('focusHabitCategories')) || ['Health', 'Learning', 'Productivity', 'Mindfulness'];
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