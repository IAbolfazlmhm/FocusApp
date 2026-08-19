// ==========================================
// HABIT MODAL — SHARED TRANSIENT STATE
// ==========================================
// The habit create/edit modal's logic is split across several sibling
// files (habits-modal-open.js, habits-modal-pickers.js,
// habits-modal-frequency.js, habits-modal-save.js) — one per concern,
// rather than one ~500-line function doing all of it. A couple of
// pieces of state genuinely need to be shared across that split:
// which habit (if any) is being edited, and which color is currently
// picked. This is UI-only, transient state that resets the moment the
// modal closes — it does not belong in state.js alongside real app
// data (tasks, habits, settings) that persists to localStorage.
//
// A plain mutable object (rather than state.js's `let` + setter-function
// pattern) is enough here: every file that imports `habitModalState`
// gets the same object reference, so mutating a property in one file is
// immediately visible to every other file that reads it — no setters
// needed, since nothing here is ever reassigned wholesale, only its
// fields are updated in place.
export const habitModalState = {
  editingHabitId: null,
  selectedHabitColor: '#3b82f6',
};

const habitColorCustomInput = document.getElementById('habit-color-custom');
const habitColorCustomWrapper = document.getElementById('habit-color-custom-wrapper');

// The visible "selected" ring lives on the wrapper label (see
// .custom-color-swatch-wrapper.selected in tags.css) since the actual
// <input type="color"> is opacity:0 there — but the input still needs
// its own .selected class too, for code elsewhere that reads "which
// swatch is currently selected" via a plain DOM query. One helper here
// keeps both elements in sync instead of every call site (in multiple
// files) remembering to toggle two elements itself.
export function setCustomSwatchSelected(isSelected) {
  habitColorCustomInput?.classList.toggle('selected', isSelected);
  habitColorCustomWrapper?.classList.toggle('selected', isSelected);
}
