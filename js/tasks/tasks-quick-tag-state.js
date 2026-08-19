// ==========================================
// QUICK TAG — SHARED TRANSIENT STATE
// ==========================================
// The tag picked from the gear icon's quick-tag modal (tasks-quick-tag-
// modal.js) needs to be read back by addTask() (tasks.js) when the task
// is actually created — this is transient "what's currently picked
// before Add is clicked" UI state, not real task data, so it doesn't
// belong in state.js. Same plain-mutable-object pattern as
// habits-modal-state.js, for the same reason: every file that imports
// this gets the same object reference, so no setter functions needed.
export const quickTagState = {
  pendingQuickTag: null,
};
