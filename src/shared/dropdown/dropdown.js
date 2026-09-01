// ==========================================
// ACCESSIBLE DROPDOWN MECHANICS
// ==========================================
// FIX: none of this app's custom dropdowns could be opened, navigated, or
// closed via keyboard at all — confirmed by grepping the whole codebase
// for keydown/keyup/keypress near any dropdown trigger (zero matches
// outside the modal Tab-trap), and there's no <form> anywhere in the page,
// so Enter did nothing on the readonly-input triggers either. That's a
// WCAG 2.1.1 (Level A) failure, not a polish gap.
//
// setupSelectDropdown() is the shared, single implementation of the
// *mechanics* every "select"-style custom dropdown needs: open/close,
// roving-focus arrow navigation between options, Enter/Space/Escape/
// Home/End, and the ARIA that announces it as a listbox. It deliberately
// does NOT own what happens when an option is picked — each call site
// keeps its own existing per-item click handler (which already sets
// whatever display text/hidden value/side effects it needs); a keyboard
// Enter/Space here just calls that same option's real .click(), so
// selection logic is never duplicated or reimplemented.
export function setupSelectDropdown({ wrapperId, triggerId, dropdownId, valueInputId }) {
  const wrapper = document.getElementById(wrapperId);
  const trigger = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  if (!wrapper || !trigger || !dropdown) {return;}

  const valueInput = valueInputId ? document.getElementById(valueInputId) : null;
  const getItems = () => Array.from(dropdown.querySelectorAll('.dropdown-item'));
  const isOpen = () => dropdown.classList.contains('show');

  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  dropdown.setAttribute('role', 'listbox');
  getItems().forEach(item => { item.setAttribute('role', 'option'); item.tabIndex = -1; });

  // Keep aria-selected in sync with the hidden value input's own "change"
  // event, which every one of these dropdowns already dispatches after a
  // selection — reusing that existing contract instead of hooking into
  // each site's own click handler.
  function syncSelectedState() {
    if (!valueInput) {return;}
    getItems().forEach(item => {
      item.setAttribute('aria-selected', String(item.dataset.val === valueInput.value));
    });
  }
  syncSelectedState();
  if (valueInput) {valueInput.addEventListener('change', syncSelectedState);}

  // FIX: these dropdowns show their current selection in a readonly
  // "display" input whose .value is set imperatively at selection time —
  // translateDOM() re-translates the .dropdown-item options (they carry
  // data-i18n) but can never touch an input's value, so after a language
  // switch the closed preview stayed in the old language until the user
  // re-picked an option. Registering every value-backed dropdown here
  // lets syncDropdownDisplays() re-derive the preview from the (already
  // re-translated) matching option on every languageChanged.
  if (valueInput) {
    displaySyncTargets.push({ triggerEl: trigger, valueInputEl: valueInput, dropdownEl: dropdown });
  }

  // Keep aria-expanded truthful no matter which path closes the dropdown
  // (an item's own click handler, an outside click, Escape, etc.) — same
  // MutationObserver pattern modal-utils.js uses for modal .show/inert sync.
  new MutationObserver(() => {
    trigger.setAttribute('aria-expanded', String(isOpen()));
  }).observe(dropdown, { attributes: true, attributeFilter: ['class'] });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  trigger.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      dropdown.classList.add('show');
      const items = getItems();
      if (items.length) {items[e.key === 'ArrowUp' ? items.length - 1 : 0].focus();}
    } else if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      dropdown.classList.remove('show');
    }
  });

  dropdown.addEventListener('keydown', (e) => {
    const items = getItems();
    const currentIndex = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(currentIndex + 1, items.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(currentIndex - 1, 0)]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.activeElement?.click(); // reuses the call site's own selection logic
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dropdown.classList.remove('show');
      trigger.focus();
    } else if (e.key === 'Tab') {
      dropdown.classList.remove('show');
    }
  });

  // Register with centralized outside-click handler
  registerOutsideClickTarget(wrapper, dropdown, valueInputId);
}

// ==========================================
// CENTRALIZED OUTSIDE-CLICK HANDLER
// ==========================================
// Replaces per-dropdown outside-click listeners with a single delegated
// handler. Each dropdown registers its trigger + dropdown via
// registerOutsideClickTarget() — called automatically by
// setupSelectDropdown() above for any dropdown wired through it, and
// directly by call sites (e.g. habits.js's category dropdown) that
// build their own dropdown mechanics but still want the shared
// outside-click behavior. On click, we check if the click was outside
// all registered dropdowns and close the one that was open. This
// eliminates the 6+ duplicate document.addEventListener('click') calls
// that were scattered across tasks.js, habits.js (3), settings.js,
// progress.js.
const outsideClickTargets = new Map(); // wrapperEl -> { dropdownEl, valueInputId? }

// Every value-backed dropdown registered via setupSelectDropdown(), so a
// single syncDropdownDisplays() pass can refresh all their readonly
// display inputs at once (see the registration note inside
// setupSelectDropdown). Not used for dropdowns without a valueInput
// (sort buttons, progress range — those own their own display logic).
const displaySyncTargets = [];

// Re-derive each registered dropdown's display preview from its current
// hidden value, reading the matching .dropdown-item's textContent — the
// items themselves are re-translated by translateDOM() on every
// languageChanged (they carry data-i18n), so by the time this runs the
// preview text it copies is already in the new language. Called from
// main.js's languageChanged cascade.
export function syncDropdownDisplays() {
  displaySyncTargets.forEach(({ triggerEl, valueInputEl, dropdownEl }) => {
    if (!triggerEl.isConnected) {return;}
    const match = dropdownEl.querySelector(`.dropdown-item[data-val="${valueInputEl.value}"]`);
    if (match) {triggerEl.value = match.textContent;}
  });
}

export function registerOutsideClickTarget(wrapperEl, dropdownEl, valueInputId) {
  if (!wrapperEl || !dropdownEl) {return;}
  outsideClickTargets.set(wrapperEl, { dropdownEl, valueInputId });
}

// Single delegated click handler — closes any open dropdown whose
// wrapper doesn't contain the click target.
document.addEventListener('click', (e) => {
  for (const [wrapperEl, { dropdownEl, valueInputId }] of outsideClickTargets) {
    if (dropdownEl.classList.contains('show') && !wrapperEl.contains(e.target)) {
      dropdownEl.classList.remove('show');
      // Sync aria-selected state if there's a hidden value input
      if (valueInputId) {
        const valueInput = document.getElementById(valueInputId);
        if (valueInput) {
          const items = dropdownEl.querySelectorAll('.dropdown-item');
          items.forEach(item => {
            item.setAttribute('aria-selected', String(item.dataset.val === valueInput.value));
          });
        }
      }
    }
  }
});
