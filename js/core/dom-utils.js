// ==========================================
// DOM UTILITIES
// ==========================================
// Small, dependency-free helpers used across every feature module:
// escaping user text for safe HTML insertion, generating collision-proof
// ids, and the app's SVG icon set. Nothing here touches app state or
// localStorage — nothing here needs its own tests beyond what already
// exercises it indirectly through the features that call it.

// Any user-typed string (task name, habit name, tag, category, etc.) MUST
// be passed through this before it is interpolated into an innerHTML
// template. This turns "<img src=x onerror=...>" into inert text instead
// of a tag the browser will parse and execute.
export function escapeHTML(str) {
  if (str === null || str === undefined) {return '';}
  return String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
}

// FIX: tasks.js and habits.js used to create every new item's id with
// `Date.now()`. That's a millisecond timestamp, so two items created in
// the same millisecond (a fast double-click, a keyboard "Enter" repeat, or
// two calls triggered programmatically in the same tick) get the SAME id.
// Since ids are how the app tells items apart (find/filter/delete/focus
// all match on id), a collision means the second item silently overwrites
// or gets confused with the first one. crypto.randomUUID() is
// effectively collision-proof, so this is now the single place every
// new task/habit id comes from. Falls back to timestamp+random for the
// rare case of a non-secure context (e.g. plain http://) where
// crypto.randomUUID isn't available.
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Plays a short "lift and settle" entrance animation (see .item-enter,
 * utilities.css) on a just-added list item. Every render function in
 * this app (renderTasks(), renderHabits(), renderTagsManagement(), etc.)
 * wipes and rebuilds its container's innerHTML from the underlying data
 * array on every call — there's no framework-level concept of "this one
 * node is new" to hook into. Call this right after such a render has
 * already run and inserted the new node, passing the container it landed
 * in and the id to find it by; it locates that one element and animates
 * only it, leaving every other (pre-existing) item alone.
 */
export function animateNewListItem(container, id, attr = 'data-id') {
  if (!container || id === undefined || id === null) {return;}
  const el = container.querySelector(`[${attr}="${CSS.escape(String(id))}"]`);
  if (!el) {return;}
  el.classList.add('item-enter');
  el.addEventListener('animationend', () => el.classList.remove('item-enter'), { once: true });
}

export const icons = {
  work: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  short: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  long: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  clock: `<svg class="ui-icon" style="width:14px; height:14px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};
