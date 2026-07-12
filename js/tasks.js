import { 
  tasks, focusedTaskId, savedTags, currentFilter, currentSort, sortOrder,
  setTasks, setFocusedTaskId, setSavedTags, setCurrentFilter, setCurrentSort, setSortOrder 
} from './state.js';

export let currentPomodoroDate = new Date();
currentPomodoroDate.setHours(0, 0, 0, 0);

import { playUI } from './audio.js';
import { showToast, icons, escapeHTML } from './ui-utils.js';

// ==========================================
// DOM ELEMENTS
// ==========================================
const taskInput = document.querySelector('.task-input');
const tagInput = document.getElementById('new-task-tag');
const addBtn = document.querySelector('.add-btn');
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

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmMsg = document.getElementById('confirm-message');
const editTagModal = document.getElementById('edit-tag-modal');
const editTagList = document.getElementById('edit-tag-list');
const closeEditTagBtn = document.getElementById('close-edit-tag');

let confirmCallback = null;
let editingTaskId = null;
let pendingQuickTag = null; // Stores the tag selected from the gear

const iconTag = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;

// ==========================================
// CORE HELPERS
// ==========================================
export function saveTasks() { 
  localStorage.setItem('focusTasks', JSON.stringify(tasks)); 
  localStorage.setItem('focusedTaskId', JSON.stringify(focusedTaskId)); 
  localStorage.setItem('focusTagsList', JSON.stringify(savedTags));
}

export function formatTaskTime(totalSeconds) { 
  if (totalSeconds === 0) return ''; 
  const m = Math.floor(totalSeconds / 60); 
  const s = totalSeconds % 60; 
  return `${icons.clock} ${m}m ${s}s`; 
}

function getRelativeDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ==========================================
// CUSTOM CONFIRM DIALOG
// ==========================================
export function customConfirm(message, onConfirm) {
  if (!confirmMsg || !confirmModal) return;
  confirmMsg.textContent = message;
  confirmCallback = onConfirm;
  confirmModal.classList.add('show');
}

export function initConfirmModal() {
  const confirmYes = document.getElementById('confirm-yes-btn');
  const confirmNo = document.getElementById('confirm-no-btn');
  if (confirmYes) {
    confirmYes.onclick = () => { 
      if (confirmCallback) confirmCallback(); 
      confirmModal.classList.remove('show'); 
    };
  }
  if (confirmNo) {
    confirmNo.onclick = () => { 
      confirmModal.classList.remove('show'); 
    };
  }
}

// ==========================================
// RENDER FILTERS & BUBBLE
// ==========================================
export function renderFilters() {
  if (!filterListEl) return;
  const scrollPos = filterListEl.scrollLeft;

  let html = `
    <div class="filter-bubble"></div>
    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
    <button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
    <button class="filter-btn ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">Done</button>
  `;
  
  savedTags.forEach(tag => {
    html += `<button class="filter-btn ${currentFilter === tag ? 'active' : ''}" data-filter="${escapeHTML(tag)}">#${escapeHTML(tag)}</button>`;
  });

  filterListEl.innerHTML = html;

  const btns = filterListEl.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      playUI('click');
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
}

function updateFilterBubble() {
  if (!filterListEl) return;
  const activeBtn = filterListEl.querySelector('.filter-btn.active');
  const bubble = filterListEl.querySelector('.filter-bubble');
  
  if (activeBtn && bubble) {
    bubble.style.width = `${activeBtn.offsetWidth}px`;
    bubble.style.left = `${activeBtn.offsetLeft}px`;
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// ==========================================
// RENDER TASKS ENGINE
// ==========================================
window.groupSortStates = window.groupSortStates || {};

export function renderTasks() {
  if (!taskListContainer) return;
  taskListContainer.innerHTML = ''; 

  // 1. Filter by Tag/Status
  let filtered = tasks;
  if (currentFilter === 'active') filtered = tasks.filter(t => !t.completed);
  else if (currentFilter === 'completed') filtered = tasks.filter(t => t.completed);
  else if (currentFilter !== 'all') filtered = tasks.filter(t => t.tag === currentFilter);

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
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // 2. Secondary Sort: User's choice
      let val = 0;
      if (currentSort === 'newest') val = a.createdAt - b.createdAt; 
      else if (currentSort === 'az') val = a.text.localeCompare(b.text);
      else if (currentSort === 'tag') val = (a.tag || '').localeCompare(b.tag || '');
      else if (currentSort === 'time') val = a.timeSpent - b.timeSpent;

      return sortOrder === 'asc' ? val : -val;
  });

  // 4. Render the Tasks (With Reschedule/Focus Logic)
  const actualToday = new Date();
  actualToday.setHours(0, 0, 0, 0);
  const isToday = currentPomodoroDate.getTime() === actualToday.getTime();

  filtered.forEach(task => {
      const taskDiv = document.createElement('div');
      taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === focusedTaskId ? 'active-focus' : ''}`;
      
      // Rock-Solid Tag Badge (Now with Max-Width and Ellipsis Truncation!)
        let tagHTML = '';
        if (task.tag) {
            if (typeof window.getTagObj === 'function') {
                const tagObj = window.getTagObj(task.tag);
                const bg = window.hexToRgba ? window.hexToRgba(tagObj.color, 0.15) : 'transparent';
                const border = window.hexToRgba ? window.hexToRgba(tagObj.color, 0.3) : 'transparent';
                tagHTML = `<span class="task-tag" title="${task.tag}" style="background:${bg}; color:${tagObj.color}; border: 1px solid ${border}; padding: 3px 9px 3px 11px; border-radius: 12px; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; flex: 0 0 auto; display: inline-block; height: max-content; line-height: 1;">#${task.tag}</span>`;
            } else {
                tagHTML = `<span class="task-tag" title="${task.tag}" style="background: var(--glass-bg); padding: 3px 9px 3px 11px; border-radius: 12px; font-size: 0.75rem; color: var(--text-muted); border: 1px solid var(--glass-border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; flex: 0 0 auto; display: inline-block; height: max-content; line-height: 1;">#${task.tag}</span>`;
            }
        }

        let actionButtons = '';
        if (!isToday && !task.completed) {
            actionButtons = `
              <button class="focus-btn reschedule-btn" title="Move to Today">
                  <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              </button>
            `;
        } else {
            actionButtons = `
              <button class="focus-btn focus-action" title="Focus">
                  <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              </button>
            `;
        }

        taskDiv.style.cursor = 'pointer'; 
        taskDiv.dataset.id = task.id; 

        // BUG FIX: flex-wrap: nowrap prevents layout breaking, tabular-nums stops time from wiggling
        taskDiv.innerHTML = `
          <div class="task-info" style="display: flex; flex-direction: column; justify-content: center; gap: 8px; flex: 1; min-width: 0; padding-right: 15px;">
            
            <span class="task-name" title="${escapeHTML(task.text)}" style="font-weight: 600; color: var(--text-main); font-size: 1.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">${escapeHTML(task.text)}</span>
            
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;">
              ${tagHTML}
              <span class="task-time-badge" id="badge-${task.id}" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin: 0; white-space: nowrap; flex: 0 0 auto; display: flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums;">${formatTaskTime(task.timeSpent)}</span>
            </div>

          </div>
          <div class="task-actions">
            ${actionButtons}
            <button class="done-btn" title="Done"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
            <button class="remove-btn" title="Remove"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        `;

      // Wire up the dynamic buttons
      const focusBtn = taskDiv.querySelector('.focus-action');
      if (focusBtn) focusBtn.addEventListener('click', () => toggleFocus(task.id));

      const rescheduleBtn = taskDiv.querySelector('.reschedule-btn');
      if (rescheduleBtn) {
          rescheduleBtn.addEventListener('click', () => {
              task.createdAt = Date.now(); // Updates timestamp to "Right Now"
              playUI('success');
              saveTasks();
              renderTasks();
              showToast('Task moved to Today!', 'success');
          });
      }

      taskDiv.querySelector('.done-btn').addEventListener('click', () => toggleCompleted(task.id));
      taskDiv.querySelector('.remove-btn').addEventListener('click', () => customConfirm("Delete this task?", () => removeTask(task.id)));

      taskListContainer.appendChild(taskDiv);
  });

  // 5. Handle UI states
  if (focusedTaskId) {
    if (tasksSection) tasksSection.classList.add('zen-mode');
    const t = tasks.find(x => x.id === focusedTaskId);
    if (currentTaskNameEl) currentTaskNameEl.textContent = t ? t.text : 'Nothing';
    if (taskListContainer) taskListContainer.scrollTop = 0;
  } else {
    if (tasksSection) tasksSection.classList.remove('zen-mode');
    if (currentTaskNameEl) currentTaskNameEl.textContent = 'Nothing';
  }
  
  if (filtered.length === 0) {
    let msg = "No tasks yet. Take a deep breath and start planning!";
    taskListContainer.innerHTML = `
      <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; margin-top: 40px; opacity: 0.7;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 60px; height: 60px; margin-bottom: 10px;"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
        <p>${msg}</p>
      </div>`;
  }
}

// ==========================================
// CORE ACTIONS
// ==========================================
export function addTask() {
  if (!taskInput) return;
  const text = taskInput.value.trim();
  
  // Use the pending tag from the gear icon, OR the dedicated tag input
  let tagRaw = pendingQuickTag || (tagInput ? tagInput.value.trim() : '');
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

  if (!text) { 
    showToast('Please enter a valid task.', 'warning'); 
    return; 
  }

  if (tag && !savedTags.includes(tag)) {
    setSavedTags([...savedTags, tag]);
  }

  // Create task for the currently viewed date, but keep the current time for sorting
  let taskDate = new Date(currentPomodoroDate);
  const now = new Date();
  taskDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

  setTasks([...tasks, { 
    id: Date.now(), 
    text, 
    tag, 
    completed: false, 
    timeSpent: 0, 
    timeByDate: {}, 
    createdAt: taskDate.getTime() 
  }]);

  playUI('click'); 
  saveTasks(); 
  renderFilters(); 
  renderTasks(); 
  
  if (taskInput) taskInput.value = '';
}

function removeTask(id) {
  playUI('trash'); 
  setTasks(tasks.filter(t => t.id !== id));
  if (focusedTaskId === id) setFocusedTaskId(null);
  saveTasks(); 
  renderTasks(); 
  checkAutoPause();
}

function toggleCompleted(id) {
  const t = tasks.find(x => x.id === id);
  if (t) { 
    t.completed = !t.completed; 
    t.completedAt = t.completed ? Date.now() : null; 
    
    if (t.completed) { 
      playUI('success'); 
      if (focusedTaskId === id) setFocusedTaskId(null); 
    } 
    saveTasks(); 
    renderTasks(); 
    checkAutoPause(); 
  }
}

function toggleFocus(id) {
  const t = tasks.find(x => x.id === id);
  if (t && t.completed) { 
    showToast('Task completed!', 'warning'); 
    return; 
  }
  setFocusedTaskId(focusedTaskId === id ? null : id);
  playUI('click'); 
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
            if (e.target.closest('button') || e.target.closest('.task-actions')) return;

            const taskItem = e.target.closest('.task-item');
            if (taskItem) {
                const id = parseInt(taskItem.dataset.id);
                openEditTaskModal(id);
            }
        });
    }

    function openEditTaskModal(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        currentlyEditingTaskId = id;
        
        const nameInput = document.getElementById('edit-task-name-input');
        if (nameInput) nameInput.value = task.text;

        const tagList = document.getElementById('edit-task-tag-list');
        if (tagList) {
            tagList.innerHTML = `<button class="tag-select-btn ${!task.tag ? 'selected' : ''}" data-tag="">None</button>`;
            
            savedTags.forEach(tag => {
                const isSelected = task.tag === tag ? 'selected' : '';
                tagList.innerHTML += `<button class="tag-select-btn ${isSelected}" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`;
            });

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
            if (nameInput) setTimeout(() => nameInput.focus(), 100);
        }
    }

    const saveEditBtn = document.getElementById('save-task-edit-btn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            if (!currentlyEditingTaskId) return;
            
            const task = tasks.find(t => t.id === currentlyEditingTaskId);
            if (task) {
                const nameInput = document.getElementById('edit-task-name-input');
                const newName = nameInput.value.trim();
                
                if (!newName) {
                    if (typeof showToast === 'function') showToast('Task name cannot be empty.', 'warning');
                    return;
                }

                const selectedTag = document.querySelector('#edit-task-tag-list .tag-select-btn.selected');
                const newTag = selectedTag ? selectedTag.dataset.tag : '';

                task.text = newName;
                task.tag = newTag === '' ? null : newTag;
                
                saveTasks();
                renderTasks();
                if (typeof renderFilters === 'function') renderFilters(); 
                
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

  if (addBtn) addBtn.addEventListener('click', addTask);
  
  if (taskInput) {
    taskInput.addEventListener('keypress', e => { 
      if (e.key === 'Enter') addTask(); 
    });
  }
  
  if (tagInput) {
    tagInput.addEventListener('keypress', e => { 
      if (e.key === 'Enter') addTask(); 
    });
  }

  if (manageTagsBtn) {
    manageTagsBtn.addEventListener('click', () => {
      if (tagsModal) tagsModal.classList.add('show');
      renderTagsManagement();
    });
  }

  if (manageNewTagInput) {
    manageNewTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            if (manageAddTagBtn) manageAddTagBtn.click(); 
        }
    });
  }

  if (closeTagsModal) {
    closeTagsModal.addEventListener('click', () => {
      if (tagsModal) tagsModal.classList.remove('show');
    });
  }

  if (manageAddTagBtn) {
    manageAddTagBtn.addEventListener('click', () => {
        if (!manageNewTagInput) return;
        const newTagName = manageNewTagInput.value.trim();
        
        if (!newTagName) {
            showToast('Please enter a valid tag name.', 'warning');
            return;
        }

        if (newTagName && !savedTags.includes(newTagName)) {
            setSavedTags([...savedTags, newTagName.charAt(0).toUpperCase() + newTagName.slice(1)]);
            saveTasks();
            renderTagsManagement();
            renderFilters();
            manageNewTagInput.value = '';
            showToast('Tag added', 'success');
        }
    });
  }

  // External trigger for focusing from timer
  document.addEventListener('autoFocusTask', (e) => {
      if (e.detail && e.detail.id) {
          toggleFocus(e.detail.id);
      }
  });

  // --- ADD TO BOTTOM OF setupTaskEvents() in js/tasks.js ---
  const customTagDropdown = document.getElementById('custom-tag-dropdown');
  
  function showCustomDropdown() {
    if (!tagInput || !customTagDropdown) return;
    const val = tagInput.value.toLowerCase().trim();
    
    const filteredTags = savedTags.filter(t => t.toLowerCase().includes(val));
    
    if (filteredTags.length === 0) {
        customTagDropdown.classList.remove('show');
        return;
    }
    
    customTagDropdown.innerHTML = filteredTags.map(tag => 
        `<div class="dropdown-item">#${escapeHTML(tag)}</div>`
    ).join('');
    
    customTagDropdown.classList.add('show');
    
    customTagDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            tagInput.value = item.textContent.replace('#', ''); 
            customTagDropdown.classList.remove('show');
            if (taskInput) taskInput.focus(); 
        });
    });
  }

  // --- GEAR ICON (QUICK TAG MODAL) LOGIC ---
  const advancedTaskBtn = document.getElementById('advanced-task-btn');
  const quickTagModal = document.getElementById('quick-tag-modal');
  const closeQuickTagModal = document.getElementById('close-quick-tag-modal');
  const quickModalTagList = document.getElementById('quick-modal-tag-list');
  const quickModalAddBtn = document.getElementById('quick-modal-add-btn');
  const quickModalTagInput = document.getElementById('quick-modal-tag-input');

  function renderQuickTagModal() {
      if (!quickModalTagList) return;
      quickModalTagList.innerHTML = '';
      
      // "No Tag" option
      const noTagBtn = document.createElement('div');
      noTagBtn.className = 'tag-chip selectable'; 
      noTagBtn.textContent = '❌ No Tag';
      noTagBtn.onclick = () => selectQuickTag(null);
      quickModalTagList.appendChild(noTagBtn);

      // Existing Tags
      savedTags.forEach(tag => {
          const btn = document.createElement('div');
          btn.className = 'tag-chip selectable'; 
          btn.textContent = `#${tag}`;
          btn.onclick = () => selectQuickTag(tag);
          quickModalTagList.appendChild(btn);
      });
  }

  function selectQuickTag(tag) {
      pendingQuickTag = tag;
      if (quickTagModal) quickTagModal.classList.remove('show');
      if (taskInput) taskInput.focus();
      
      if (tag) showToast(`Tag #${escapeHTML(tag)} selected`, 'success');
  }

  if (advancedTaskBtn) {
      advancedTaskBtn.addEventListener('click', () => {
          playUI('click');
          renderQuickTagModal();
          if (quickTagModal) quickTagModal.classList.add('show');
          if (quickModalTagInput) {
              quickModalTagInput.value = '';
              setTimeout(() => quickModalTagInput.focus(), 100);
          }
      });
  }

  if (closeQuickTagModal) {
      closeQuickTagModal.addEventListener('click', () => {
          if (quickTagModal) quickTagModal.classList.remove('show');
      });
  }

  // Handle adding new tag from inside the modal
  function addNewQuickTag() {
      if (!quickModalTagInput) return;
      const newTagRaw = quickModalTagInput.value.trim();
      
      if (!newTagRaw) {
          showToast('Please enter a valid tag name.', 'warning');
          return;
      }
      
      if (newTagRaw) {
          const newTag = newTagRaw.charAt(0).toUpperCase() + newTagRaw.slice(1);
          if (!savedTags.includes(newTag)) {
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
          if (e.target === quickTagModal) quickTagModal.classList.remove('show');
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
            catch (e) { pomodoroDatePicker.click(); }
        });

        pomodoroDatePicker.addEventListener('change', (e) => {
            if (!e.target.value) return;
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
        if (!pomodoroDisplayBtn) return;
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffTime = currentPomodoroDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) pomodoroDisplayBtn.textContent = 'Today';
        else if (diffDays === -1) pomodoroDisplayBtn.textContent = 'Yesterday';
        else if (diffDays === 1) pomodoroDisplayBtn.textContent = 'Tomorrow';
        else pomodoroDisplayBtn.textContent = currentPomodoroDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

  // --- Sort Button Logic ---
  const taskSortBtn = document.getElementById('task-sort-btn');
  const sortDropdown = document.getElementById('sort-dropdown');

  if (taskSortBtn && sortDropdown) {
      taskSortBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          sortDropdown.style.display = sortDropdown.style.display === 'block' ? 'none' : 'block';
      });

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
            
            playUI('click');
            sortDropdown.style.display = 'none';
            renderTasks();
          });
      });

      document.addEventListener('click', (e) => {
          if (!taskSortBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
              sortDropdown.style.display = 'none';
          }
      });
  }

  // Listen for new tags added from the gear icon to update the modal
  document.addEventListener('refreshTagsManagement', () => {
      // renderTagsManagement is defined at the bottom of tasks.js
      if (typeof renderTagsManagement === 'function') {
          renderTagsManagement();
      }
  });
}



function renderTagsManagement() {
  if (!tagsManagementList) return;
  tagsManagementList.innerHTML = '';
  
  savedTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip deletable';
    chip.textContent = `#${tag}`;
    
    chip.addEventListener('click', () => {
      customConfirm(`Delete tag "${tag}"?`, () => {
        setSavedTags(savedTags.filter(t => t !== tag));
        
        tasks.forEach(t => {
            if (t.tag === tag) t.tag = null;
        });

        if (currentFilter === tag) setCurrentFilter('all');
        
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
        
        if (diffDays === 0) display.textContent = 'Today';
        else if (diffDays === -1) display.textContent = 'Yesterday';
        else if (diffDays === 1) display.textContent = 'Tomorrow';
        else display.textContent = currentPomodoroDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    renderTasks();
}