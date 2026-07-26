import { playUI } from './audio.js';
import { readRaw, writeRaw } from './storage.js';

// ==========================================
// SECURITY: HTML ESCAPING
// ==========================================
// Any user-typed string (task name, habit name, tag, category, etc.) MUST
// be passed through this before it is interpolated into an innerHTML
// template. This turns "<img src=x onerror=...>" into inert text instead
// of a tag the browser will parse and execute.
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// ID GENERATION
// ==========================================
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
// ==========================================
// SCOPED HORIZONTAL SCROLL (filter/tab pill rows)
// ==========================================
// Horizontally centers `btn` inside `container`'s own scroll position —
// deliberately touches nothing but container.scrollLeft, so it can never
// cascade into scrolling the page. This replaced Element.scrollIntoView()
// in both the task and habit filter rows: those rows only scroll
// horizontally, so scrollIntoView's vertical "nearest" component had
// nowhere to resolve except the page itself — if the row wasn't fully
// inside the viewport (routine on mobile, where a panel above it can push
// it near/past the fold), the browser would scroll the whole page to
// satisfy it, on every load since these run during initial render, not
// just on click.
export function centerButtonInScrollArea(container, btn) {
  if (!container || !btn) return;
  const target = btn.offsetLeft - (container.clientWidth / 2) + (btn.offsetWidth / 2);
  container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ==========================================
// DETERMINISTIC TAG COLOR
// ==========================================
// FIX: renderTasks() in tasks.js used to look for `window.getTagObj` /
// `window.hexToRgba` to color tag chips, but neither was ever defined
// anywhere in the app (only referenced, behind a `typeof === 'function'`
// guard) — so the guard was always false and every tag chip silently
// rendered in the plain/uncolored fallback style. This gives tags a real,
// stable color without needing to store one: the same tag name always
// hashes to the same hue, so chips stay visually consistent across
// reloads and don't need a color picker UI of their own (unlike habits,
// which already have one).
// Converts "#3b82f6" (+ alpha) into "rgba(59, 130, 246, 0.15)". Needed
// because hsla()/hsl() strings (used for the hash-based default color)
// can't take a hex color as input, and vice versa — this is the one
// conversion point shared by both color paths.
export function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Small internal helper: converts h/s/l (the same values getTagColor's
// hash branch computes) into a "#rrggbb" string. Only needed so
// getTagColor can also return a `hex` value for UI that requires one
// (e.g. a native <input type="color">, which can't accept hsl()).
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export function getTagColor(tag, customHex) {
  // FIX: tags used to always get an auto-hashed color with no way for the
  // user to change it — even though some tags (a habit-style "Work" or
  // "Health") might already have a color meaning to the user elsewhere.
  // Passing a stored custom hex (see tagColors in state.js, wired up in
  // tasks.js) here now takes priority; the hash is only ever a fallback
  // for tags nobody has customized yet.
  if (customHex) {
    return {
      solid: customHex,
      bg: hexToRgba(customHex, 0.15),
      border: hexToRgba(customHex, 0.3),
      hex: customHex
    };
  }

  let hash = 0;
  const str = String(tag);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Returned as hsl()/hsla() strings (not a bare hex color) so the caller
  // can use `solid` for text/border and `bg` for a translucent fill
  // without needing to append an alpha suffix to a color format that
  // doesn't support one. `hex` is provided alongside for UI (like a color
  // swatch input) that specifically needs a hex value.
  return {
    solid: `hsl(${hue}, 65%, 45%)`,
    bg: `hsla(${hue}, 65%, 45%, 0.15)`,
    border: `hsla(${hue}, 65%, 45%, 0.3)`,
    hex: hslToHex(hue, 65, 45)
  };
}

// ==========================================
// SVG ICONS DICTIONARY
// ==========================================
export const icons = {
  work: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  short: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  long: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  clock: `<svg class="ui-icon" style="width:14px; height:14px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
export function showToast(message, type = 'info', silent = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const existingToasts = container.querySelectorAll('.toast');
  for (let t of existingToasts) {
    if (t.innerText.includes(message)) return;
  }

  if (container.childElementCount >= 3) {
    const oldest = container.firstChild;
    oldest.style.animation = 'toastOut 0.2s forwards';
    setTimeout(() => oldest.remove(), 200);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '<span style="color:#10b981">✔</span>'; 
  if (type === 'warning') icon = '<span style="color:#f59e0b">⚠️</span>'; 

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
          if (type === 'success') playUI('success');
          if (type === 'warning') playUI('click');
      }
  }

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// ==========================================
// TABS & NAVIGATION
// ==========================================
export function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const bubble = document.querySelector('.active-bubble');

  // FIX: previously animated by changing `left`/`width` directly, which
  // (a) forces a layout recalc every frame and (b) sits inside a
  // `backdrop-filter: blur()` container, so every frame also re-ran an
  // expensive blur repaint — together these made the slide look laggy
  // instead of smooth. Width barely ever changes (the 3 tabs are equal
  // flex-1 slices of the same bar), so only position needs to animate;
  // driving that with `transform: translateX()` lets the browser animate
  // it on the compositor (GPU) without touching layout at all. See the
  // matching `.active-bubble` rule in layout.css.
  function updateBubble(targetTab) {
    if (!targetTab || !bubble) return;
    bubble.style.width = `${targetTab.offsetWidth}px`;
    bubble.style.transform = `translateX(${targetTab.offsetLeft}px)`;
  }

  window.addEventListener('load', () => {
    document.body.classList.remove('preload');
    
    const savedTabIndex = readRaw('focusActiveTab', 0);
    
    if (tabs[savedTabIndex]) {
        setTimeout(() => {
            tabs[savedTabIndex].click();
        }, 50);
    }
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { 
      playUI('click');
      
      writeRaw('focusActiveTab', index);
      document.dispatchEvent(new Event('tabChanged'));
      
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); }); 
      tab.classList.add('active'); 
      tab.setAttribute('aria-selected', 'true');
      updateBubble(tab); 
      
      const pomodoroView = document.getElementById('pomodoro-view');
      const habitsView = document.getElementById('habits-view');
      const progressView = document.getElementById('progress-view');
      
      if (pomodoroView) pomodoroView.style.display = 'none';
      if (habitsView) habitsView.style.display = 'none';
      if (progressView) progressView.style.display = 'none';
      
      if (index === 0) {
        if (pomodoroView) pomodoroView.style.display = 'flex'; 
        document.body.classList.remove('phase-habits', 'phase-progress');
        const event = new CustomEvent('updateColors');
        document.dispatchEvent(event);
      } else {
        document.body.classList.remove('phase-work', 'phase-short', 'phase-long', 'phase-stopwatch');
        if (index === 1 && habitsView) {
            habitsView.style.display = 'flex';
            document.body.classList.add('phase-habits');
            document.body.classList.remove('phase-progress');
        }
        if (index === 2 && progressView) {
            progressView.style.display = 'flex';
            document.body.classList.remove('phase-habits');
            document.body.classList.add('phase-progress');
            // FIX: this used to dispatch synchronously, right here in the
            // click handler — meaning the (fairly heavy) dashboard
            // rebuild it triggers (heatmaps, stats, deltas) ran BEFORE the
            // browser got a chance to paint the tab-switch bubble's first
            // animation frame. Since the whole handler is one synchronous
            // task, the bubble's slide would stall for however long that
            // rebuild took, then jump to catch up — reading as lag.
            // requestAnimationFrame defers it to right after the browser's
            // next paint, so the bubble gets its first smooth frame in
            // before the dashboard work happens (still effectively
            // instant to the user, just no longer blocking the animation).
            requestAnimationFrame(() => {
                document.dispatchEvent(new Event('progressTabOpened'));
            });
        }
      }

      const pomodoroSettings = document.getElementById('pomodoro-settings-wrapper');
      const modeSelect = document.getElementById('mode-select');
      
      // Hide Timer Settings & Mode Select when not on Pomodoro tab
      if (pomodoroSettings) pomodoroSettings.style.display = index === 0 ? 'block' : 'none';
      // Trigger bubble recalculation if switching to Habits tab (index 1)
      if (index === 1) {
          document.dispatchEvent(new Event('habitsTabOpened'));
      }
      if (modeSelect) {
          const modeWrapper = modeSelect.closest('.setting-group');
          if (modeWrapper) modeWrapper.style.display = index === 0 ? 'flex' : 'none';
      }
    });
  });

  window.addEventListener('resize', () => {
     const activeTab = document.querySelector('.tab.active');
     if (activeTab) updateBubble(activeTab);
  });
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
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null);
}

function trapTabKey(event, modal) {
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(modal);
  if (focusable.length === 0) return;

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
    const observer = new MutationObserver(() => {
      const isOpen = modal.classList.contains('show');

      if (isOpen && !activeTraps.has(modal)) {
        lastFocusedBeforeModal = document.activeElement;

        const focusable = getFocusableElements(modal);
        if (focusable.length > 0) focusable[0].focus();

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