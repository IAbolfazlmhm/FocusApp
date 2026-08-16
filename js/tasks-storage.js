// ==========================================
// TASK PERSISTENCE
// ==========================================
// Deliberately its own file rather than living in tasks.js (where the CRUD
// functions that call it are) or tasks-render.js (where the one rendering
// call site — the reschedule button — also needs it). Both of those files
// need saveTasks(); putting it in either one would force the other to
// import from it, and tasks.js/tasks-render.js already depend on each
// other in the opposite direction (tasks.js calls into tasks-render.js's
// renderTasks/renderFilters). A shared leaf dependency with nothing of
// its own to import keeps that a one-way relationship instead of a cycle.
import { tasks, focusedTaskId, savedTags, tagColors } from './state.js';
import { writeJSON, STORAGE_KEYS } from './storage.js';

export function saveTasks() {
  writeJSON(STORAGE_KEYS.TASKS, tasks);
  writeJSON(STORAGE_KEYS.FOCUSED_TASK_ID, focusedTaskId);
  writeJSON(STORAGE_KEYS.TAGS_LIST, savedTags);
  writeJSON(STORAGE_KEYS.TAG_COLORS, tagColors);
}
