// ==========================================
// TRASH (soft-delete bin for habits, tasks, tags, categories & quotes)
// ==========================================
// A single shared bin for anything the app "deletes". Every delete flow
// that used to remove data outright (removeTask, "Delete All History",
// tag/category delete, user quote delete) now stashes the full original
// object here first via moveToTrash() — the Trash modal (trash-ui.js) is
// the only place left that performs a true, unrecoverable delete, via
// permanentlyDelete()/emptyTrash().
//
// Deliberately generic (a `type` string + a free-form `data` blob) rather
// than a separate array per feature — every trashable thing already has
// its own home array (tasks, habits, savedTags, ...) to restore back
// into; this file only needs to remember enough to put it back there.
// Type-specific restore logic lives with each feature's other CRUD
// (tasks.js, habits.js, motivation.js) and is orchestrated by
// trash-ui.js, the same "UI file imports from several feature files"
// pattern progress-report.js already uses for setTaskDate/setHabitDate.

import { readJSON, writeJSON, STORAGE_KEYS } from '../core/storage.js';
import { generateId } from '../core/dom-utils.js';

// Keeps the bin from growing forever on a long-lived install — oldest
// entries quietly age out past this once new ones push them over the
// edge, rather than the user ever having to notice a cap being hit.
const MAX_TRASH_ITEMS = 200;

export function getTrash() {
  return readJSON(STORAGE_KEYS.TRASH, [], 'array');
}

export function getTrashByType(type) {
  return getTrash().filter(e => e.type === type);
}

export function getTrashCount() {
  return getTrash().length;
}

/**
 * Stashes `data` (the full original object — a task, a habit, a
 * {name,color} pair for a tag/category, etc.) under `type`, newest
 * first. `label` is a short human-readable name shown in the Trash list
 * (a task's text, a habit's name, a tag's name, a quote's own text).
 */
export function moveToTrash(type, label, data) {
  const trash = getTrash();
  const entry = { id: generateId(), type, label, data, deletedAt: Date.now() };
  const updated = [entry, ...trash].slice(0, MAX_TRASH_ITEMS);
  writeJSON(STORAGE_KEYS.TRASH, updated);
  return entry;
}

/** Removes one entry from the bin without restoring it — the permanent-delete action. */
export function permanentlyDelete(id) {
  const updated = getTrash().filter(e => e.id !== id);
  writeJSON(STORAGE_KEYS.TRASH, updated);
}

/** Removes an entry from the bin because it's being restored elsewhere — same effect as permanentlyDelete, named for what the caller is doing. */
export function removeFromTrash(id) {
  permanentlyDelete(id);
}

export function emptyTrash() {
  writeJSON(STORAGE_KEYS.TRASH, []);
}

export function findTrashEntry(id) {
  return getTrash().find(e => e.id === id) || null;
}
