import {
  tasks, focusedTaskId, savedTags, tagColors, currentFilter, currentSort, sortOrder,
  setTasks, setFocusedTaskId, setSavedTags, setTagColors, setCurrentFilter, setCurrentSort, setSortOrder
} from './state.js';
import { writeJSON, STORAGE_KEYS } from './storage.js';

export let currentPomodoroDate = new Date();
currentPomodoroDate.setHours(0, 0, 0, 0);

import { showToast } from './toast.js';
import { icons, escapeHTML, generateId } from './dom-utils.js';
import { getTagColor } from './color-utils.js';
import { centerButtonInScrollArea, setupHorizontalWheelScroll, keepInputVisibleOnMobileKeyboard } from './scroll-utils.js';
import { setupSelectDropdown } from './dropdown.js';
import { customConfirm } from './modal-utils.js';

// ==========================================
// DOM ELEMENTS
// ==========================================
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-task-btn');
const taskListContainer = document.querySelector('.task-list-container');
const tasksSection = document.querySelector('.tasks-section');
const currentTaskNameEl = document.getElementById('current-task-name');
const filterListEl = document.getElementById('filter-list');
const tagsModal = document.getElementById('tags-modal');
const closeTagsModal = document.getElementById('close-tags-modal');
const tagsManagementList = document.getElementById('tags-management-list');
const manageAddTagBtn = document.getElementById('manage-add-tag-btn');
const manageNewTagInput = document.getElementById('manage-new-tag-input');
const manageTagsBtn = document.getElementById('manage-tags-btn');

let pendingQuickTag = null; // Stores the tag selected from the gear

// ==========================================
// CORE HELPERS
// ==========================================
export function saveTasks() {
  writeJSON(STORAGE_KEYS.TASKS, tasks);
  writeJSON(STORAGE_KEYS.FOCUSED_TASK_ID, focusedTaskId);
  writeJSON(STORAGE_KEYS.TAGS_LIST, savedTags);
  writeJSON(STORAGE_KEYS.TAG_COLORS, tagColors);
}

export function formatTaskTime(totalSeconds) {
  if (totalSeconds === 0) {return '';}
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${icons.clock} ${m}m ${s}s`;
}

// ==========================================
// RENDER FILTERS & BUBBLE
// ==========================================
export function renderFilters() {
  if (!filterListEl) {return;}
  const scrollPos = filterListEl.scrollLeft;

  let html = `
    <div class="filter-bubble"></div>
    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" data-sound="click">All</button>
    <button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active" data-sound="click">Active</button>
    <button class="filter-btn ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed" data-sound="click">Done</button>
  `;

  savedTags.forEach(tag => {
    html += `<button class="filter-btn ${currentFilter === tag ? 'active' : ''}" data-filter="${escapeHTML(tag)}" data-sound="click">#${escapeHTML(tag)}</button>`;
  });

  filterListEl.innerHTML = html;

  const btns = filterListEl.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentFilter(btn.dataset.filter);

      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateFilterBubble();
      renderTasks();
    });
  });

  filterListEl.scrollLeft = scrollPos;

  // Prevent animation glitch on initial load/refresh
  const bubble = filterListEl.querySelector('.filter-bubble');
  if (bubble) {
    bubble.style.transition = 'none';
    updateFilterBubble();

    const event = new CustomEvent('updateColors');
    document.dispatchEvent(event);

    void bubble.offsetWidth; // Force reflow
    bubble.style.transition = '';
  }

  // Add horizontal wheel scroll support for desktop
  setupHorizontalWheelScroll(filterListEl);
}

function updateFilterBubble() {
  if (!filterListEl) {return;}
  const activeBtn = filterListEl.querySelector('.filter-btn.active');
  const bubble = filterListEl.querySelector('.filter-bubble');

  if (activeBtn && bubble) {
    bubble.style.width = `${activeBtn.offsetWidth}px`;
    bubble.style.left = `${activeBtn.offsetLeft}px`;
    // FIX: this used to be activeBtn.scrollIntoView({ block: 'nearest', ... }).
    // filterListEl only scrolls horizontally (overflow-x: auto), so
    // scrollIntoView's vertical "nearest" component had nowhere to resolve
    // except the page itself — if this row wasn't fully inside the
    // viewport (routine on mobile, where the timer panel above it can
    // push it near/past the fold), the browser would scroll the whole
    // page down to satisfy it. That ran on every load/refresh, since
    // renderFilters() (which calls this) runs on initial setup, not just
    // on click. Scrolling filterListEl directly keeps this entirely
    // inside its own horizontal strip and can never move the page.
    centerButtonInScrollArea(filterListEl, activeBtn);
  }
}

// ==========================================
// RENDER TASKS ENGINE
// ==========================================
window.groupSortStates = window.groupSortStates || {};

export function renderTasks() {
  if (!taskListContainer) {return;}
  taskListContainer.innerHTML = '';

  // 1. Filter by Tag/Status
  let filtered = tasks;
  if (currentFilter === 'active') {filtered = tasks.filter(t => !t.completed);}
  else if (currentFilter === 'completed') {filtered = tasks.filter(t => t.completed);}
  else if (currentFilter !== 'all') {filtered = tasks.filter(t => t.tag === currentFilter);}

  // 2. Filter by Date (Only show tasks for the date selected in the top bar)
  if (typeof currentPomodoroDate !== 'undefined') {
    const targetDateString = currentPomodoroDate.toDateString(); // "Fri Oct 27 2023"
    filtered = filtered.filter(task => {
      const taskDateString = new Date(task.createdAt).toDateString();
      return taskDateString === targetDateString;
    });
  }

  // 3. Sort using the new Top Bar logic
  filtered.sort((a, b) => {
    // 1. Primary Sort: Completed tasks ALWAYS sink to the bottom
    if (a.completed !== b.completed) {return a.completed ? 1 : -1;}

    // 2. Secondary Sort: User's choice
    let val = 0;
    if (currentSort === 'newest') {val = a.createdAt - b.createdAt;}
    else if (currentSort === 'az') {val = a.text.localeCompare(b.text);}
    else if (currentSort === 'tag') {val = (a.tag || '').localeCompare(b.tag || '');}
    else if (currentSort === 'time') {val = a.timeSpent - b.timeSpent;}

    return sortOrder === 'asc' ? val : -val;
  });

  // 4. Render the Tasks (With Reschedule/Focus Logic)
  const actualToday = new Date();
  actualToday.setHours(0, 0, 0, 0);
  const isToday = currentPomodoroDate.getTime() === actualToday.getTime();

  // Built up in a fragment and appended once at the end instead of per
  // task — avoids a separate reflow-triggering insertion into the live,
  // visible list for every single task on every render (add/delete/
  // complete/filter/sort all call renderTasks()).
  const fragment = document.createDocumentFragment();

  filtered.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === focusedTaskId ? 'active-focus' : ''}`;

    // Rock-Solid Tag Badge (Now with Max-Width and Ellipsis Truncation!)
    let tagHTML = '';
    if (task.tag) {
      // Tags now get a color from one of two places: a color the user
      // explicitly picked in "Manage Tags" (tagColors, set below in
      // renderTagsManagement), or — if they never bothered — a
      // deterministic hash color so it's still visually consistent
      // without requiring any setup.
      const tagColor = getTagColor(task.tag, tagColors[task.tag]);
      tagHTML = `<span class="task-tag" title="${escapeHTML(task.tag)}" style="--tag-color:${tagColor.solid}; --tag-bg:${tagColor.bg}; --tag-border:${tagColor.border};">#${escapeHTML(task.tag)}</span>`;
    }

    let actionButtons = '';
    if (!isToday && !task.completed) {
      actionButtons += `
        <button class="focus-btn reschedule-btn" title="Move to Today" aria-label="Move task to today" data-sound="success">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
        </button>
      `;
    }

    // Focus is independent from the task's calendar date. Always expose a
    // real toggle so a focused task from an older day can be unfocused
    // directly without moving it or creating a replacement task.
    const isFocused = task.id === focusedTaskId;
    actionButtons += `
      <button class="focus-btn focus-action ${isFocused ? 'is-focused' : ''}"
        title="${isFocused ? 'Unfocus' : 'Focus'}"
        aria-label="${isFocused ? 'Unfocus task' : 'Focus task'}"
        aria-pressed="${isFocused}"
        data-sound="click">
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      </button>
    `;

    taskDiv.style.cursor = 'pointer';
    taskDiv.dataset.id = task.id;
    // FIX: the card opens an edit modal on click, but had no keyboard
    // equivalent — a keyboard-only user could tab past it and never
    // reach the edit action at all. tabindex + role="button" + the
    // Enter/Space handler below (delegated, added once in
    // setupTaskEvents) makes it behave like a real button.
    taskDiv.tabIndex = 0;
    taskDiv.setAttribute('role', 'button');
    taskDiv.setAttribute('aria-label', `Edit task: ${task.text}`);

    // Layout/spacing for this card lives in .task-info, .task-name,
    // .task-tag-row, .task-tag, .task-time-badge (see pomodoro.css) —
    // flex-wrap:nowrap on the tag row and tabular-nums on the time
    // badge (which prevent layout breaking and the digits wiggling)
    // are part of those classes now, not repeated inline every render.
    taskDiv.innerHTML = `
      <div class="task-info">

        <span class="task-name" title="${escapeHTML(task.text)}">${escapeHTML(task.text)}</span>

        <div class="task-tag-row">
          ${tagHTML}
          <span class="task-time-badge" id="badge-${task.id}">${formatTaskTime(task.timeSpent)}</span>
        </div>

      </div>
      <div class="task-actions">
        ${actionButtons}
        <button class="done-btn" title="Done" data-sound="success"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
        <button class="remove-btn" title="Remove"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    `;

    // Wire up the dynamic buttons
    const focusBtn = taskDiv.querySelector('.focus-action');
    if (focusBtn) {focusBtn.addEventListener('click', () => toggleFocus(task.id));}

    const rescheduleBtn = taskDiv.querySelector('.reschedule-btn');
    if (rescheduleBtn) {
      rescheduleBtn.addEventListener('click', () => {
        task.createdAt = Date.now(); // Updates timestamp to "Right Now"
        saveTasks();
        renderTasks();
        showToast('Task moved to Today!', 'success');
      });
    }

    taskDiv.querySelector('.done-btn').addEventListener('click', () => toggleCompleted(task.id));
    taskDiv.querySelector('.remove-btn').addEventListener('click', () => customConfirm("Delete this task?", () => removeTask(task.id)));

    fragment.appendChild(taskDiv);
  });

  taskListContainer.appendChild(fragment);

  // 5. Handle UI states
  if (focusedTaskId) {
    if (tasksSection) {tasksSection.classList.add('zen-mode');}
    const t = tasks.find(x => x.id === focusedTaskId);
    if (currentTaskNameEl) {currentTaskNameEl.textContent = t ? t.text : 'Nothing';}
    if (taskListContainer) {taskListContainer.scrollTop = 0;}
  } else {
    if (tasksSection) {tasksSection.classList.remove('zen-mode');}
    if (currentTaskNameEl) {currentTaskNameEl.textContent = 'Nothing';}
  }

  if (filtered.length === 0) {
    let msg;
    if (tasks.length === 0) {
      msg = "No tasks yet. Take a deep breath and start planning!";
    } else if (currentFilter === 'completed') {
      msg = "No completed tasks yet. Finish one to see it here!";
    } else if (currentFilter === 'active') {
      msg = "All caught up! No active tasks remain.";
    } else if (currentFilter !== 'all') {
      msg = `No tasks tagged #${escapeHTML(currentFilter)}.`;
    } else {
      msg = "No tasks match the current filter.";
    }
    taskListContainer.innerHTML = `
      <div class="empty-state lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
        <p>${msg}</p>
      </div>`;
  }
}

// ==========================================
// CORE ACTIONS
// ==========================================
export function addTask() {
  if (!taskInput) {return;}
  const text = taskInput.value.trim();

  // Tag comes from the gear icon (quick-tag modal) — the app's only tag
  // input UI now that the old inline tag field has been removed.
  const tagRaw = pendingQuickTag || '';
  const tag = tagRaw ? tagRaw.charAt(0).toUpperCase() + tagRaw.slice(1) : null;

  if (!text) {
    showToast('Please enter a valid task.', 'warning');
    return;
  }

  // Clear the pending tag and visual cue after adding
  pendingQuickTag = null;
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
  setTasks(tasks.filter(t => t.id !== id));
  if (wasFocused) {setFocusedTaskId(null);}
  saveTasks();
  renderTasks();
  if (wasFocused) {checkAutoPause();}
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

// ==========================================
// TAG MANAGEMENT & EDIT MODALS
// ==========================================
export function setupTaskEvents() {
  // --- TASK EDITING MODAL LOGIC ---
  let currentlyEditingTaskId = null;

  if (taskListContainer) {
    taskListContainer.addEventListener('click', (e) => {
      // Ignore clicks on action buttons
      if (e.target.closest('button') || e.target.closest('.task-actions')) {return;}

      const taskItem = e.target.closest('.task-item');
      if (taskItem) {
        const id = taskItem.dataset.id;
        openEditTaskModal(id);
      }
    });

    // Keyboard equivalent of the click handler above, so Tab + Enter/Space
    // can open the edit modal the same way a mouse click does.
    taskListContainer.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') {return;}
      if (e.target.closest('button') || e.target.closest('.task-actions')) {return;}

      const taskItem = e.target.closest('.task-item');
      if (taskItem) {
        e.preventDefault();
        openEditTaskModal(taskItem.dataset.id);
      }
    });
  }

  function openEditTaskModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) {return;}

    currentlyEditingTaskId = id;

    const nameInput = document.getElementById('edit-task-name-input');
    if (nameInput) {nameInput.value = task.text;}

    const tagList = document.getElementById('edit-task-tag-list');
    if (tagList) {
      // FIX: used to build tag buttons via innerHTML += inside a forEach,
      // the classic O(n²) anti-pattern (every iteration re-serializes and
      // re-parses everything already in the container). Now builds a single
      // HTML string and sets it once — same pattern already used correctly
      // by renderTagsManagement() and renderQuickTagModal() in this file.
      const noneSelected = !task.tag ? 'selected' : '';
      let html = `<button class="tag-select-btn ${noneSelected}" data-tag="" data-sound="click">None</button>`;
      savedTags.forEach(tag => {
        const isSelected = task.tag === tag ? 'selected' : '';
        html += `<button class="tag-select-btn ${isSelected}" data-tag="${escapeHTML(tag)}" data-sound="click">${escapeHTML(tag)}</button>`;
      });
      tagList.innerHTML = html;

      tagList.querySelectorAll('.tag-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          tagList.querySelectorAll('.tag-select-btn').forEach(b => b.classList.remove('selected'));
          e.target.classList.add('selected');
        });
      });
    }

    const modal = document.getElementById('edit-tag-modal');
    if (modal) {
      modal.classList.add('show');
    }
  }

  const saveEditBtn = document.getElementById('save-task-edit-btn');
  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', () => {
      if (!currentlyEditingTaskId) {return;}

      const task = tasks.find(t => t.id === currentlyEditingTaskId);
      if (task) {
        const nameInput = document.getElementById('edit-task-name-input');
        const newName = nameInput.value.trim();

        if (!newName) {
          showToast('Task name cannot be empty.', 'warning');
          return;
        }

        const selectedTag = document.querySelector('#edit-task-tag-list .tag-select-btn.selected');
        const newTag = selectedTag ? selectedTag.dataset.tag : '';

        task.text = newName;
        task.tag = newTag === '' ? null : newTag;

        saveTasks();
        renderTasks();
        renderFilters();

        // Update dynamic title if the active task was edited
        if (typeof focusedTaskId !== 'undefined' && focusedTaskId === task.id) {
          const event = new Event('tabChanged');
          document.dispatchEvent(event);
        }
      }

      document.getElementById('edit-tag-modal').classList.remove('show');
      currentlyEditingTaskId = null;
    });
  }

  const editModal = document.getElementById('edit-tag-modal');
  const editNameInput = document.getElementById('edit-task-name-input');
  const closeEditModalBtn = document.getElementById('close-edit-tag-modal');

  // Press Enter to save
  if (editNameInput && saveEditBtn) {
    editNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEditBtn.click();
      }
    });
  }

  // Click background overlay to close
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.classList.remove('show');
        currentlyEditingTaskId = null;
      }
    });
  }

  // Close button
  if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', () => {
      editModal.classList.remove('show');
      currentlyEditingTaskId = null;
    });
  }

  if (addBtn) {addBtn.addEventListener('click', addTask);}

  if (taskInput) {
    taskInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {addTask();}
    });
    keepInputVisibleOnMobileKeyboard(taskInput);
  }

  if (manageTagsBtn) {
    manageTagsBtn.addEventListener('click', () => {
      if (tagsModal) {tagsModal.classList.add('show');}
      renderTagsManagement();
    });
  }

  if (manageNewTagInput) {
    manageNewTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (manageAddTagBtn) {manageAddTagBtn.click();}
      }
    });
  }

  if (closeTagsModal) {
    closeTagsModal.addEventListener('click', () => {
      if (tagsModal) {tagsModal.classList.remove('show');}
    });
  }

  if (manageAddTagBtn) {
    manageAddTagBtn.addEventListener('click', () => {
      if (!manageNewTagInput) {return;}
      const newTagName = manageNewTagInput.value.trim();

      if (!newTagName) {
        showToast('Please enter a valid tag name.', 'warning');
        return;
      }

      const alreadyExists = savedTags.some(t => t.toLowerCase() === newTagName.toLowerCase());
      if (!alreadyExists) {
        setSavedTags([...savedTags, newTagName.charAt(0).toUpperCase() + newTagName.slice(1)]);
        saveTasks();
        renderTagsManagement();
        renderFilters();
        manageNewTagInput.value = '';
        showToast('Tag added', 'success');
      } else {
        showToast('That tag already exists.', 'warning');
      }
    });
  }

  // External trigger for focusing from timer
  document.addEventListener('autoFocusTask', (e) => {
    if (e.detail && e.detail.id) {
      toggleFocus(e.detail.id);
    }
  });

  // --- GEAR ICON (QUICK TAG MODAL) LOGIC ---
  const advancedTaskBtn = document.getElementById('advanced-task-btn');
  const quickTagModal = document.getElementById('quick-tag-modal');
  const closeQuickTagModal = document.getElementById('close-quick-tag-modal');
  const quickModalTagList = document.getElementById('quick-modal-tag-list');
  const quickModalAddBtn = document.getElementById('quick-modal-add-btn');
  const quickModalTagInput = document.getElementById('quick-modal-tag-input');

  function renderQuickTagModal() {
    if (!quickModalTagList) {return;}
    quickModalTagList.innerHTML = '';

    // "No Tag" option
    const noTagBtn = document.createElement('button');
    noTagBtn.type = 'button';
    noTagBtn.className = 'tag-chip selectable';
    noTagBtn.setAttribute('aria-label', 'No tag');
    noTagBtn.textContent = '❌ No Tag';
    noTagBtn.dataset.sound = 'click';
    noTagBtn.onclick = () => selectQuickTag(null);
    quickModalTagList.appendChild(noTagBtn);

    // Existing Tags
    savedTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip selectable';
      btn.setAttribute('aria-label', `Select tag ${tag}`);
      btn.textContent = `#${tag}`;
      btn.dataset.sound = 'click';
      btn.onclick = () => selectQuickTag(tag);
      quickModalTagList.appendChild(btn);
    });
  }

  function selectQuickTag(tag) {
    pendingQuickTag = tag;
    if (quickTagModal) {quickTagModal.classList.remove('show');}
    if (taskInput) {taskInput.focus();}

    if (tag) {showToast(`Tag #${escapeHTML(tag)} selected`, 'success');}
  }

  if (advancedTaskBtn) {
    advancedTaskBtn.addEventListener('click', () => {
      renderQuickTagModal();
      if (quickTagModal) {quickTagModal.classList.add('show');}
      if (quickModalTagInput) {
        quickModalTagInput.value = '';
      }
    });
  }

  if (closeQuickTagModal) {
    closeQuickTagModal.addEventListener('click', () => {
      if (quickTagModal) {quickTagModal.classList.remove('show');}
    });
  }

  // Handle adding new tag from inside the modal
  function addNewQuickTag() {
    if (!quickModalTagInput) {return;}
    const newTagRaw = quickModalTagInput.value.trim();

    if (!newTagRaw) {
      showToast('Please enter a valid tag name.', 'warning');
      return;
    }

    if (newTagRaw) {
      const existing = savedTags.find(t => t.toLowerCase() === newTagRaw.toLowerCase());
      const newTag = existing || (newTagRaw.charAt(0).toUpperCase() + newTagRaw.slice(1));
      if (!existing) {
        setSavedTags([...savedTags, newTag]);
        saveTasks();
        renderFilters();

        const tagsManagementList = document.getElementById('tags-management-list');
        if (tagsManagementList && tagsManagementList.innerHTML !== '') {
          const renderTagsEvent = new Event('refreshTagsManagement');
          document.dispatchEvent(renderTagsEvent);
        }
      }
      selectQuickTag(newTag);
    }
  }

  if (quickModalAddBtn) {
    quickModalAddBtn.addEventListener('click', addNewQuickTag);
  }

  if (quickModalTagInput) {
    quickModalTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNewQuickTag();
      }
    });
  }

  if (quickTagModal) {
    quickTagModal.addEventListener('click', (e) => {
      if (e.target === quickTagModal) {quickTagModal.classList.remove('show');}
    });
  }

  // --- Pomodoro Date Navigation & Calendar ---
  const pomodoroDisplayBtn = document.getElementById('pomodoro-date-display');
  const pomodoroDatePicker = document.getElementById('pomodoro-date-picker');
  const pomodoroPrevDate = document.getElementById('pomodoro-prev-date');
  const pomodoroNextDate = document.getElementById('pomodoro-next-date');

  // 1. Arrows
  if (pomodoroPrevDate) {
    pomodoroPrevDate.addEventListener('click', () => {
      currentPomodoroDate.setDate(currentPomodoroDate.getDate() - 1);
      updatePomodoroDateUI();
      renderTasks();
    });
  }
  if (pomodoroNextDate) {
    pomodoroNextDate.addEventListener('click', () => {
      currentPomodoroDate.setDate(currentPomodoroDate.getDate() + 1);
      updatePomodoroDateUI();
      renderTasks();
    });
  }

  // 2. Calendar Popup
  if (pomodoroDisplayBtn && pomodoroDatePicker) {
    pomodoroDisplayBtn.addEventListener('click', () => {
      try { pomodoroDatePicker.showPicker(); }
      catch { pomodoroDatePicker.click(); }
    });

  pomodoroDatePicker.addEventListener('change', (e) => {
      if (!e.target.value) {return;}
      // value is formatted as "YYYY-MM-DD"
      const [year, month, day] = e.target.value.split('-').map(Number);
      currentPomodoroDate = new Date(year, month - 1, day);
      currentPomodoroDate.setHours(0, 0, 0, 0);
      updatePomodoroDateUI();
      renderTasks();
    });
  }

  // UI Updater for Pomodoro Date
  function updatePomodoroDateUI() {
    if (!pomodoroDisplayBtn) {return;}
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = currentPomodoroDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {pomodoroDisplayBtn.textContent = 'Today';}
    else if (diffDays === -1) {pomodoroDisplayBtn.textContent = 'Yesterday';}
    else if (diffDays === 1) {pomodoroDisplayBtn.textContent = 'Tomorrow';}
    else {pomodoroDisplayBtn.textContent = currentPomodoroDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });}
  }

  // --- Sort Button Logic ---
  // Opening, closing, keyboard navigation, and ARIA now live in the shared
  // setupSelectDropdown() (dropdown.js). This also switches the dropdown
  // from a raw inline style.display toggle onto the .show class the CSS
  // already defines for every .custom-dropdown (including its popIn
  // animation), which this dropdown was previously bypassing.
  const taskSortBtn = document.getElementById('task-sort-btn');
  const sortDropdown = document.getElementById('sort-dropdown');

  if (taskSortBtn && sortDropdown) {
    sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const clickedSort = item.getAttribute('data-sort');
        if (currentSort === clickedSort) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          setCurrentSort(clickedSort);
          setSortOrder((clickedSort === 'az' || clickedSort === 'tag') ? 'asc' : 'desc');
        }

        // Clear old arrows and active states
        sortDropdown.querySelectorAll('.dropdown-item').forEach(i => {
          i.classList.remove('active-sort');
          i.querySelector('.sort-dir').textContent = '';
        });

        // Add active state and arrow to clicked item
        item.classList.add('active-sort');
        item.querySelector('.sort-dir').textContent = sortOrder === 'asc' ? '↑' : '↓';

        sortDropdown.classList.remove('show');
        renderTasks();
      });
    });

    setupSelectDropdown({ wrapperId: 'task-sort-wrapper', triggerId: 'task-sort-btn', dropdownId: 'sort-dropdown' });
  }

  // Listen for new tags added from the gear icon to update the modal
  document.addEventListener('refreshTagsManagement', () => {
    renderTagsManagement();
  });
}



function renderTagsManagement() {
  if (!tagsManagementList) {return;}
  tagsManagementList.innerHTML = '';

  savedTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip deletable manageable';

    const currentColor = getTagColor(tag, tagColors[tag]);

    // Native <input type="color"> — small, no extra CSS component to
    // build, works on every platform's own color picker UI, and is fully
    // keyboard/screen-reader operable out of the box.
    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'tag-color-swatch';
    swatch.value = currentColor.hex;
    swatch.title = `Choose a color for #${tag}`;
    swatch.setAttribute('aria-label', `Color for tag ${tag}`);
    swatch.addEventListener('input', (e) => {
      // Stop this from also triggering the chip's own click→delete handler.
      e.stopPropagation();
    });
    swatch.addEventListener('change', (e) => {
      setTagColors({ ...tagColors, [tag]: e.target.value });
      saveTasks();
      renderTasks();
      renderTagsManagement();
    });
    swatch.addEventListener('click', (e) => e.stopPropagation());

    const label = document.createElement('span');
    label.className = 'tag-chip-label';
    label.textContent = `#${tag}`;

    chip.appendChild(swatch);
    chip.appendChild(label);

    // Only a custom color needs a way back to "no override" — the hash
    // default has nothing to reset away from.
    if (tagColors[tag]) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'tag-color-reset';
      resetBtn.title = `Reset #${tag} to its default color`;
      resetBtn.setAttribute('aria-label', `Reset color for tag ${tag}`);
      resetBtn.innerHTML = icons.reset || '↺';
      resetBtn.dataset.sound = 'click';
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { [tag]: _removed, ...rest } = tagColors;
        setTagColors(rest);
        saveTasks();
        renderTasks();
        renderTagsManagement();
      });
      chip.appendChild(resetBtn);
    }

    chip.addEventListener('click', () => {
      customConfirm(`Delete tag "${tag}"?`, () => {
        setSavedTags(savedTags.filter(t => t !== tag));

        tasks.forEach(t => {
            if (t.tag === tag) {t.tag = null;}
        });

        if (currentFilter === tag) {setCurrentFilter('all');}

        // Custom colors are keyed by tag name — clear the override too so
        // a brand new, unrelated tag with the same name later doesn't
        // silently inherit an old color from a tag that no longer exists.
        if (tagColors[tag]) {
          const { [tag]: _removed, ...rest } = tagColors;
          setTagColors(rest);
        }

        saveTasks();
        renderTagsManagement();
        renderFilters();
        renderTasks();
      });
    });
    tagsManagementList.appendChild(chip);
  });
}

// --- DEEP LINKING EXPORT ---
export function setTaskDate(dateObj) {
  currentPomodoroDate = new Date(dateObj);
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
