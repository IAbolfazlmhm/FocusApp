import {
  tasks, focusedTaskId, savedTags, tagColors, currentFilter, currentSort, sortOrder, currentPomodoroDate,
  setTasks, setFocusedTaskId, setSavedTags, setTagColors, setCurrentFilter, setCurrentSort, setSortOrder, setCurrentPomodoroDate
} from './state.js';
import { showToast } from './toast.js';
import { icons, escapeHTML, generateId } from './dom-utils.js';
import { getTagColor } from './color-utils.js';
import { keepInputVisibleOnMobileKeyboard } from './scroll-utils.js';
import { setupSelectDropdown } from './dropdown.js';
import { customConfirm } from './modal-utils.js';
import { saveTasks } from './tasks-storage.js';
import { renderTasks, renderFilters, setTaskHandlers } from './tasks-render.js';

// ==========================================
// DOM ELEMENTS
// ==========================================
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-task-btn');
// Also queried independently in tasks-render.js, which needs it for its
// own rendering — see the comment at the top of that file for why DOM
// refs aren't shared across the module boundary here. This one is only
// needed below for the click/keydown delegation that opens the edit
// modal (setupTaskEvents), a concern that belongs with the modal logic,
// not with rendering.
const taskListContainer = document.querySelector('.task-list-container');
const tagsModal = document.getElementById('tags-modal');
const closeTagsModal = document.getElementById('close-tags-modal');
const tagsManagementList = document.getElementById('tags-management-list');
const manageAddTagBtn = document.getElementById('manage-add-tag-btn');
const manageNewTagInput = document.getElementById('manage-new-tag-input');
const manageTagsBtn = document.getElementById('manage-tags-btn');

let pendingQuickTag = null; // Stores the tag selected from the gear

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
      setCurrentPomodoroDate(new Date(year, month - 1, day));
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
