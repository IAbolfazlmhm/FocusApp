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
import { customConfirm } from '../../shared/modal/modal-utils.js';
import { showToast } from '../../shared/toast/toast.js';
import { escapeHTML } from '../../core/dom-utils.js';
import { t, formatNumber } from '../../core/i18n.js';

function getTypeLabels() {
  return {
    task: t('task_name'),
    habit: t('tab_habits'),
    tag: t('task_tag'),
    category: t('category'),
    quote: t('motivational_quotes')
  };
}

// FIX: this entire function was hardcoded English — both the wording
// ('just now', 'm ago', 'h ago', 'd ago') and the numbers themselves,
// which never went through formatNumber() even after everything else in
// the app did. t()'s numeric-param auto-formatting (see i18n.js) means
// passing the raw number through here is enough — no separate
// formatNumber() call needed at the call site.
function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) {return t('time_just_now');}
  if (mins < 60) {return t('time_mins_ago', { mins });}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return t('time_hrs_ago', { hrs });}
  return t('time_days_ago', { days: Math.floor(hrs / 24) });
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
  // FIX: was String(count) — never formatted, so this badge stayed in
  // Latin digits even under fa locale while every other count in the app
  // switched.
  badge.textContent = formatNumber(count);
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

  const typeLabels = getTypeLabels();
  trash.forEach(entry => {
    const label = entry.label || t('untitled');
    const row = document.createElement('div');
    row.className = 'trash-item';

    const info = document.createElement('div');
    info.className = 'trash-item-info';
    info.innerHTML = `
      <span class="trash-item-type-badge">${escapeHTML(typeLabels[entry.type] || entry.type)}</span>
      <span class="trash-item-label">${escapeHTML(String(label))}</span>
      <span class="trash-item-time">${timeAgo(entry.deletedAt)}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'trash-item-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'btn-outline trash-restore-btn';
    restoreBtn.dataset.sound = 'click';
    // FIX: this button's text and both aria-labels below were hardcoded
    // English ('Restore', 'Restore {label}', 'Delete {label} forever') —
    // this was "the buttons inside trash modal" with no fa styling at
    // all, regardless of locale.
    restoreBtn.textContent = t('restore_btn');
    restoreBtn.setAttribute('aria-label', t('restore_label', { label }));
    restoreBtn.addEventListener('click', () => {
      restoreEntry(entry);
      permanentlyDelete(entry.id);
      renderTrashList();
      updateTrashBadge();
      showToast(t('restored_item_toast', { label }), 'success', true);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'remove-btn trash-delete-btn';
    deleteBtn.dataset.sound = 'trash';
    deleteBtn.setAttribute('aria-label', t('delete_forever_label', { label }));
    deleteBtn.innerHTML = '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteBtn.addEventListener('click', () => {
      customConfirm(t('permanently_delete_confirm', { label }), () => {
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
    customConfirm(t('empty_trash_confirm'), () => {
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
  document.addEventListener('languageChanged', () => {
    updateTrashBadge();
    // FIX: the badge count is always visible, but the list itself (item
    // labels' relative-time text, Restore button text/aria-labels) only
    // needs a fresh render if the modal happens to be open at the exact
    // moment language changes — mirrors the same open-check pattern
    // already used for the Quotes/Categories/Tags management modals.
    if (modal && modal.classList.contains('show')) {
      renderTrashList();
    }
  });

  updateTrashBadge();
}
