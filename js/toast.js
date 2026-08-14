// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
import { playUI } from './audio.js';

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

  let icon = '';
  if (type === 'success') {icon = '<span style="color:#10b981">✔</span>';}
  if (type === 'warning') {icon = '<span style="color:#f59e0b">⚠️</span>';}

  // Icon is always one of our own hardcoded strings above (safe). The
  // message can contain user-typed text (e.g. a tag name), so it's inserted
  // as a text node via a separate span, never through innerHTML.
  toast.innerHTML = icon;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  if (type !== 'info' && !silent) {
    const soundToggle = document.getElementById('sound-toggle');
    if (!soundToggle || soundToggle.checked) {
      if (type === 'success') {playUI('success');}
      if (type === 'warning') {playUI('click');}
    }
  }

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}
