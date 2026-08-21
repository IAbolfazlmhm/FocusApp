// ==========================================
// TASK EDIT MODAL
// ==========================================
import { tasks, savedTags, focusedTaskId } from '../../core/state.js';
import { showToast } from '../../shared/toast/toast.js';
import { escapeHTML } from '../../core/dom-utils.js';
import { saveTasks } from './tasks-storage.js';
import { renderTasks, renderFilters } from './tasks-render.js';

export function setupTaskEditModal() {
  const taskListContainer = document.querySelector('.task-list-container');
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
      // by renderTagsManagement() and renderQuickTagModal() (tasks-tags-modal.js
      // / tasks-quick-tag-modal.js).
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
}
