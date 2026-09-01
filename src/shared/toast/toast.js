// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
import { playUI } from '../audio.js';

// Pure mapping from toast type to which sound it should play (or null for
// none) — kept separate from the DOM/audio side effects below so it's
// testable on its own without needing a real AudioContext.
// FIX: 'warning' used to map to 'click' — the exact same neutral tap that
// plays for an ordinary successful interaction, so a blocked action (e.g.
// "task name can't be empty") sounded no different from one that worked.
export function soundForToastType(type) {
  if (type === 'success') {return 'success';}
  if (type === 'warning') {return 'error';}
  return null;
}

export function showToast(message, type = 'info', silent = false) {
  const container = document.getElementById('toast-container');
  if (!container) {return;}

  const existingToasts = container.querySelectorAll('.toast');
  for (const t of existingToasts) {
    if (t.textContent.includes(message)) {return;}
  }

  if (container.childElementCount >= 3) {
    const oldest = container.firstChild;
    oldest.style.animation = 'toastOut 0.2s forwards';
    setTimeout(() => oldest.remove(), 200);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // FIX: was inline emoji (✔ / ⚠️) — swapped for the app's existing SVG
  // sprite icons (index.html) so toasts match every other icon in the
  // app (stroke-based, currentColor, scales cleanly) instead of relying
  // on whatever emoji glyph the OS/browser happens to render. 'info' now
  // gets an icon too — the CSS (.toast.info) already themed a border for
  // it, it just never had a matching icon.
  const iconIds = { success: 'icon-check-circle', warning: 'icon-alert-triangle', info: 'icon-info-circle' };
  const iconId = iconIds[type];

  // Icon is always one of our own sprite refs above (safe). The message
  // can contain user-typed text (e.g. a tag name), so it's inserted as a
  // text node via a separate span, never through innerHTML.
  toast.innerHTML = iconId
    ? `<svg class="ui-icon toast-icon" aria-hidden="true"><use href="#${iconId}"/></svg>`
    : '';
  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  if (type !== 'info' && !silent) {
    const soundType = soundForToastType(type);
    if (soundType) {
      const soundToggle = document.getElementById('sound-toggle');
      if (!soundToggle || soundToggle.checked) {
        playUI(soundType);
      }
    }
  }

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}
