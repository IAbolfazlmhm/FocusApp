// ==========================================
// TRASH MODAL (UI)
// ==========================================
// Renders the Trash modal (Settings > Trash) — restoring an entry calls
// straight back into whichever feature file owns that data type
// (tasks.js/habits.js/motivation.js), the same "one UI file imports
// restore/render helpers from several feature files" pattern
// progress-report.js already uses for setTaskDate/setHabitDate. This
// file owns none of the underlying data itself, only the list/modal.

import { getTrash, permanentlyDelete, emptyTrash, getTrashCount } from './trash.js';
import { restoreTask } from '../tasks/tasks.js';
import { restoreTag } from '../tasks/tasks-tags-modal.js';
import { restoreHabit, restoreHabitCategory } from '../habits/habits.js';
import { restoreUserQuote } from '../quotes/motivation.js';
import { customConfirm } from '../ui/modal-utils.js';
import { showToast } from '../ui/toast.js';
import { escapeHTML } from '../core/dom-utils.js';

const TYPE_LABELS = { task: 'Task', habit: 'Habit', tag: 'Tag', category: 'Category', quote: 'Quote' };

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) {return 'just now';}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ago`;}
  return `${Math.floor(hrs / 24)}d ago`;
}

// Dispatched so the rest of the app (Progress tab, tag/category filter
// pills, etc.) picks up a restore the same way it already picks up any
// other data change — see habits.js's identical use of this event.
function notifyDataChanged() {
  document.dispatchEvent(new Event('dataUpdated'));
}

function restoreEntry(entry) {
  switch (entry.type) {
    case 'task': restoreTask(entry.data); break;
    case 'habit': restoreHabit(entry.data); break;
    case 'tag': restoreTag(entry.data); break;
    case 'category': restoreHabitCategory(entry.data); break;
    case 'quote': restoreUserQuote(entry.data); break;
    default: break;
  }
  notifyDataChanged();
}

function updateTrashBadge() {
  const badge = document.getElementById('trash-count-badge');
  if (!badge) {return;}
  const count = getTrashCount();
  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function renderTrashList() {
  const list = document.getElementById('trash-list');
  const emptyMsg = document.getElementById('trash-empty-message');
  const emptyBtn = document.getElementById('empty-trash-btn');
  if (!list) {return;}

  const trash = getTrash();
  list.innerHTML = '';
  if (emptyMsg) {emptyMsg.style.display = trash.length === 0 ? 'block' : 'none';}
  if (emptyBtn) {emptyBtn.disabled = trash.length === 0;}

  trash.forEach(entry => {
    const label = entry.label || 'Untitled';
    const row = document.createElement('div');
    row.className = 'trash-item';

    const info = document.createElement('div');
    info.className = 'trash-item-info';
    info.innerHTML = `
      <span class="trash-item-type-badge">${escapeHTML(TYPE_LABELS[entry.type] || entry.type)}</span>
      <span class="trash-item-label">${escapeHTML(String(label))}</span>
      <span class="trash-item-time">${timeAgo(entry.deletedAt)}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'trash-item-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'btn-outline trash-restore-btn';
    restoreBtn.dataset.sound = 'click';
    restoreBtn.textContent = 'Restore';
    restoreBtn.setAttribute('aria-label', `Restore ${label}`);
    restoreBtn.addEventListener('click', () => {
      restoreEntry(entry);
      permanentlyDelete(entry.id);
      renderTrashList();
      updateTrashBadge();
      showToast(`Restored "${label}".`, 'success', true);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'remove-btn trash-delete-btn';
    deleteBtn.dataset.sound = 'trash';
    deleteBtn.setAttribute('aria-label', `Delete ${label} forever`);
    deleteBtn.innerHTML = '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteBtn.addEventListener('click', () => {
      customConfirm(`Permanently delete "${label}"? This cannot be undone.`, () => {
        permanentlyDelete(entry.id);
        renderTrashList();
        updateTrashBadge();
      });
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

export function openTrashModal() {
  const modal = document.getElementById('trash-modal');
  renderTrashList();
  if (modal) {modal.classList.add('show');}
}

export function setupTrashEvents() {
  const modal = document.getElementById('trash-modal');
  const closeModal = () => modal?.classList.remove('show');

  document.getElementById('close-trash-modal')?.addEventListener('click', closeModal);
  document.getElementById('close-trash-modal-btn')?.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) {closeModal();} });
  }

  document.getElementById('empty-trash-btn')?.addEventListener('click', () => {
    if (getTrashCount() === 0) {return;}
    customConfirm('Permanently delete everything in the Trash? This cannot be undone.', () => {
      emptyTrash();
      renderTrashList();
      updateTrashBadge();
    });
  });

  // FIX: keeps the badge correct when something is trashed/restored/
  // purged from anywhere else in the app (removeTask, tag/category
  // delete, quote delete, ...) — not just from actions taken inside
  // this modal. See notifyTrashChanged()'s comment in trash.js.
  document.addEventListener('trashUpdated', updateTrashBadge);

  updateTrashBadge();
}
