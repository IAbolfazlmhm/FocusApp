// ==========================================
// TASKS — ORCHESTRATOR
// ==========================================
// This file owns the Pomodoro tab's core CRUD (add/remove/toggle,
// restore-from-trash, the Progress tab's deep-link) plus
// setupTaskEvents(), which just wires up the sibling tasks-*.js modules
// below — each one owns a single concern of the Pomodoro tab's task UI
// (the edit modal, tag management, the quick-tag picker, date
// navigation, sorting). That split replaced what used to be one
// ~450-line setupTaskEvents() function; see tasks-quick-tag-state.js
// for the one piece of state (which tag is currently picked, before Add
// is clicked) that needs to be shared across that split.

import {
  tasks, focusedTaskId, savedTags, currentPomodoroDate,
  setTasks, setFocusedTaskId, setSavedTags, setCurrentPomodoroDate
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { generateId } from '../core/dom-utils.js';
import { keepInputVisibleOnMobileKeyboard } from '../ui/scroll-utils.js';
import { customConfirm } from '../ui/modal-utils.js';
import { saveTasks } from './tasks-storage.js';
import { renderTasks, renderFilters, setTaskHandlers } from './tasks-render.js';
import { moveToTrash } from '../trash/trash.js';
import { quickTagState } from './tasks-quick-tag-state.js';
import { setupTaskEditModal } from './tasks-edit-modal.js';
import { setupTagsManagement } from './tasks-tags-modal.js';
import { setupQuickTagModal } from './tasks-quick-tag-modal.js';
import { setupPomodoroDateNav } from './tasks-date-nav.js';
import { setupTaskSort } from './tasks-sort.js';

const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-task-btn');

// ==========================================
// CORE ACTIONS
// ==========================================
export function addTask() {
  if (!taskInput) {return;}
  const text = taskInput.value.trim();

  // Tag comes from the gear icon (quick-tag modal) — the app's only tag
  // input UI now that the old inline tag field has been removed.
  const tagRaw = quickTagState.pendingQuickTag || '';
  const tag = tagRaw ? tagRaw.charAt(0).toUpperCase() + tagRaw.slice(1) : null;

  if (!text) {
    showToast('Please enter a valid task.', 'warning');
    return;
  }

  // Clear the pending tag and visual cue after adding
  quickTagState.pendingQuickTag = null;
  const advancedBtn = document.getElementById('advanced-task-btn');
  if (advancedBtn) {
    advancedBtn.style.color = '';
    advancedBtn.style.borderColor = '';
  }

  // FIX: compare case-insensitively so "work" typed after "Work" already
  // exists reuses the existing tag instead of creating a visually
  // duplicate ("Work" and "WORK" both existing as separate tags).
  const existingTag = tag ? savedTags.find(t => t.toLowerCase() === tag.toLowerCase()) : null;
  const finalTag = existingTag || tag;
  if (finalTag && !existingTag) {
    setSavedTags([...savedTags, finalTag]);
  }

  // Create task for the currently viewed date, but keep the current time for sorting
  const taskDate = new Date(currentPomodoroDate);
  const now = new Date();
  taskDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

  setTasks([...tasks, {
    id: generateId(),
    text,
    tag: finalTag,
    completed: false,
    timeSpent: 0,
    timeByDate: {},
    createdAt: taskDate.getTime()
  }]);
  saveTasks();
  renderFilters();
  renderTasks();

  if (taskInput) {taskInput.value = '';}
}

function removeTask(id) {
  // FIX: checkAutoPause() used to fire unconditionally on every removal.
  // Its handler (timer.js) pauses the timer whenever focusedTaskId is
  // null and the timer is running — which is now also true, legitimately,
  // during an intentional taskless session (see timer.js). Removing some
  // unrelated task while running taskless would have incorrectly paused
  // that session, since focusedTaskId was already null for an unrelated
  // reason. Only call it when the task actually being removed was the
  // one holding focus.
  const wasFocused = focusedTaskId === id;
  const removedTask = tasks.find(t => t.id === id);
  setTasks(tasks.filter(t => t.id !== id));
  if (wasFocused) {setFocusedTaskId(null);}
  // Soft-delete: the full task object goes to Trash (Settings > Trash)
  // instead of being gone for good — restorable or permanently
  // deletable from there. See trash.js.
  if (removedTask) {moveToTrash('task', removedTask.text, removedTask);}
  saveTasks();
  renderTasks();
  if (wasFocused) {checkAutoPause();}
}

/**
 * Puts a trashed task back into the live list, preserving its original
 * id/timestamps/time-tracking data exactly as they were. Called from the
 * Trash modal (trash-ui.js) — exported here rather than duplicated there
 * since tasks.js already owns setTasks/saveTasks/renderTasks/renderFilters.
 */
export function restoreTask(taskData) {
  if (!taskData || tasks.some(t => t.id === taskData.id)) {return;}
  setTasks([...tasks, taskData]);
  saveTasks();
  renderTasks();
  renderFilters();
}

function toggleCompleted(id) {
  const t = tasks.find(x => x.id === id);
  if (t) {
    t.completed = !t.completed;
    t.completedAt = t.completed ? Date.now() : null;

    // FIX: toggleFocus() already refuses to let a completed task become
    // focused ("Task completed!" toast below) — i.e. this app's own rule
    // is that completed tasks aren't focusable. But completing a task
    // that was ALREADY focused never released that focus, leaving the
    // timer silently tracking time against a task that's now done. This
    // makes the same rule apply going the other direction: completing
    // the focused task releases focus too, instead of only blocking the
    // reverse case.
    //
    // checkAutoPause() is likewise only called when this action actually
    // changed focus — see the matching comment in removeTask() above;
    // completing some unrelated task must never touch a taskless
    // session that's already running.
    let releasedFocus = false;
    if (t.completed && focusedTaskId === id) {
      setFocusedTaskId(null);
      releasedFocus = true;
    }

    saveTasks();
    renderTasks();
    if (releasedFocus) {checkAutoPause();}
  }
}

function toggleFocus(id) {
  const t = tasks.find(x => x.id === id);
  if (t && t.completed) {
    showToast('Task completed!', 'warning');
    return;
  }
  setFocusedTaskId(focusedTaskId === id ? null : id);
  saveTasks();
  renderTasks();
  checkAutoPause();
}

function checkAutoPause() {
  // Dispatch event so timer.js can handle the pause logic
  const event = new CustomEvent('checkAutoPauseTimer');
  document.dispatchEvent(event);
}

// tasks-render.js renders each task card's focus/done/remove buttons, but
// doesn't import toggleFocus/toggleCompleted/removeTask directly — see the
// comment at the top of that file for why (tasks.js already needs to
// import renderTasks/renderFilters FROM tasks-render.js, and having
// tasks-render.js import back from here would make that a circular
// import). Registering these here instead — once, immediately, since
// toggleFocus/toggleCompleted/removeTask above are hoisted function
// declarations already available at this point in the module regardless
// of where they're defined in the file — keeps the dependency one-way.
setTaskHandlers({
  onFocus: toggleFocus,
  onComplete: toggleCompleted,
  onRemove: (id) => customConfirm("Delete this task?", () => removeTask(id)),
});

// ==========================================
// EVENTS SETUP
// ==========================================
export function setupTaskEvents() {
  setupTaskEditModal();
  setupTagsManagement();
  setupQuickTagModal();
  setupPomodoroDateNav();
  setupTaskSort();

  if (addBtn) {addBtn.addEventListener('click', addTask);}

  if (taskInput) {
    taskInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {addTask();}
    });
    keepInputVisibleOnMobileKeyboard(taskInput);
  }

  // External trigger for focusing from timer
  document.addEventListener('autoFocusTask', (e) => {
    if (e.detail && e.detail.id) {
      toggleFocus(e.detail.id);
    }
  });
}

// --- DEEP LINKING EXPORT ---
export function setTaskDate(dateObj) {
  setCurrentPomodoroDate(new Date(dateObj));
  currentPomodoroDate.setHours(0,0,0,0);

  // Safely update the Pomodoro Date text manually
  const display = document.getElementById('pomodoro-date-display');
  if (display) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffDays = Math.ceil((currentPomodoroDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {display.textContent = 'Today';}
    else if (diffDays === -1) {display.textContent = 'Yesterday';}
    else if (diffDays === 1) {display.textContent = 'Tomorrow';}
    else {display.textContent = currentPomodoroDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });}
  }
  renderTasks();
}
