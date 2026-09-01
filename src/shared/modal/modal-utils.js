// ==========================================
// MODAL STACK (for Escape-key handling & body scroll locking)
// ==========================================
const openModals = [];

function updateBodyScrollLock() {
  if (typeof document === 'undefined') {return;}
  if (openModals.length > 0) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

export function registerModalOpen(modal) {
  if (modal && !openModals.includes(modal)) {
    openModals.push(modal);
    updateBodyScrollLock();
  }
}

export function registerModalClose(modal) {
  const index = openModals.indexOf(modal);
  if (index !== -1) {
    openModals.splice(index, 1);
    updateBodyScrollLock();
  }
}

export function closeTopmostModal() {
  if (openModals.length > 0) {
    const topModal = openModals[openModals.length - 1];
    topModal.classList.remove('show');
  }
}

// ==========================================
// MODAL ACCESSIBILITY (FOCUS TRAP + FOCUS RETURN)
// ==========================================
// FIX: modals are opened from ~15 different call sites across tasks.js,
// habits.js, progress.js, and settings.js, each just doing
// `someModal.classList.add('show')`. Rather than editing every one of
// those sites (and every future one) to add focus handling, this watches
// the whole document for the .show class appearing/disappearing on any
// .modal-overlay and reacts generically:
//  - on open: remembers what had focus, moves focus into the modal, and
//    traps Tab/Shift+Tab inside it so keyboard users can't tab out to the
//    page underneath
//  - on close: returns focus to whatever triggered the modal
// This covers every modal, including ones added later, with no per-modal
// wiring required.
let lastFocusedBeforeModal = null;

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      // `summary` is included for the Help modal's <details> accordion —
      // it's natively Tab-focusable in every browser but isn't matched by
      // any of the other selectors, so without it Tab could walk past the
      // trap's computed "last" element into a summary and out of the
      // modal. No other modal in the app uses <details>, so this is a
      // no-op everywhere else.
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null);
}

function trapTabKey(event, modal) {
  if (event.key !== 'Tab') {return;}
  const focusable = getFocusableElements(modal);
  if (focusable.length === 0) {return;}

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function setupModalAccessibility() {
  const activeTraps = new WeakMap();

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    // FIX: closed modals were only hidden with `opacity: 0;
    // pointer-events: none;` (see .modal-overlay in components.css) —
    // never `display: none`. That hides them visually and blocks clicks,
    // but does NOT remove them from the keyboard Tab order: a keyboard
    // user tabbing through the page could land on a button/input inside a
    // modal that's invisible and unclickable, with no visual sign of
    // where focus went. `inert` fixes this at the browser level, removing
    // the whole subtree from Tab order (and screen-reader traversal)
    // whenever the modal isn't open — set once here on load, then kept in
    // sync by the same MutationObserver that already watches `.show`, so
    // every modal is covered with no per-call-site changes required.
    modal.inert = !modal.classList.contains('show');

    // FIX: the focus trap and Tab-order fixes above make modals correct
    // to navigate, but a screen reader had no way to know one had even
    // opened, or what to call it. role="dialog" + aria-modal="true"
    // announce that context; aria-labelledby points at the modal's own
    // heading so its name is announced too, reusing the heading that's
    // already there instead of duplicating its text into a new attribute.
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const heading = modal.querySelector('h2, h3');
    if (heading && !modal.hasAttribute('aria-labelledby')) {
      if (!heading.id) {heading.id = `${modal.id}-title`;}
      modal.setAttribute('aria-labelledby', heading.id);
    }

    const observer = new MutationObserver(() => {
      const isOpen = modal.classList.contains('show');
      modal.inert = !isOpen;

      // Register with the modal stack above for Escape-key handling.
      if (isOpen) {
        registerModalOpen(modal);
      } else {
        registerModalClose(modal);
      }

      if (isOpen && !activeTraps.has(modal)) {
        lastFocusedBeforeModal = document.activeElement;

        const focusable = getFocusableElements(modal);
        if (focusable.length > 0) {focusable[0].focus();}

        const handler = (event) => trapTabKey(event, modal);
        modal.addEventListener('keydown', handler);
        activeTraps.set(modal, handler);
      } else if (!isOpen && activeTraps.has(modal)) {
        modal.removeEventListener('keydown', activeTraps.get(modal));
        activeTraps.delete(modal);

        if (lastFocusedBeforeModal && document.body.contains(lastFocusedBeforeModal)) {
          lastFocusedBeforeModal.focus();
        }
        lastFocusedBeforeModal = null;
      }
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
}

// ==========================================
// CUSTOM CONFIRM DIALOG
// ==========================================
// This dialog is used by multiple features (Tasks, Habits, and Settings),
// so it belongs in the shared UI layer rather than in any one feature module.
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
let confirmCallback = null;

export function customConfirm(message, onConfirm) {
  if (!confirmMessage || !confirmModal) {return;}
  confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  confirmModal.classList.add('show');
}

export function initConfirmModal() {
  const confirmYes = document.getElementById('confirm-yes-btn');
  const confirmNo = document.getElementById('confirm-no-btn');

  if (confirmYes) {
    confirmYes.onclick = () => {
      if (confirmCallback) {confirmCallback();}
      confirmModal.classList.remove('show');
    };
  }

  if (confirmNo) {
    confirmNo.onclick = () => {
      confirmModal.classList.remove('show');
    };
  }
}
