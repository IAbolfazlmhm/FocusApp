// ==========================================
// HELP & GUIDE
// ==========================================
// Central "how does this app work" reference: a modal (#help-modal,
// index.html) with one collapsible <details> section per part of the
// app — Getting Started, Pomodoro, Tasks, Habits, Progress, Data, Tips.
// It's reachable from a small "?" icon in every view header
// (data-help-section on each button picks which section it opens to)
// and from Settings → Help & Guide (no section — just opens as-is).
//
// #help-modal is already a normal .modal-overlay, so
// setupModalAccessibility() (shared/modal/modal-utils.js) picks it up
// automatically — this file only owns opening/closing it and the two
// first-visit nudges below. Nothing here touches app data (tasks/
// habits/settings), so it carries no risk to any of that.

import { readJSON, writeJSON, STORAGE_KEYS } from '../../core/storage.js';
import { showToast } from '../../shared/toast/toast.js';

const helpModal = document.getElementById('help-modal');

function defaultHelpState() {
  return { welcomeShown: false, tabsSeen: { habits: false, progress: false } };
}

function getHelpState() {
  return readJSON(STORAGE_KEYS.HELP_STATE, defaultHelpState());
}

function saveHelpState(state) {
  writeJSON(STORAGE_KEYS.HELP_STATE, state);
}

/**
 * Opens the Help modal. If a sectionId is given (matching one of the
 * <details> ids in the markup), that section is expanded and scrolled
 * into view — used by the per-view "?" buttons so each one lands on the
 * guidance that's actually relevant to what the person is looking at.
 * Called with no argument from the Settings modal's own entry, which
 * just opens to the top since there's no single "current view" to favor.
 */
export function openHelpModal(sectionId) {
  if (!helpModal) {return;}

  // The Settings row is the one entry point that lives inside another
  // modal — close it first so the two don't stack, matching how the
  // Trash modal is opened from the same place (settings.js).
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {settingsModal.classList.remove('show');}

  helpModal.classList.add('show');

  if (!sectionId) {return;}
  const target = document.getElementById(sectionId);
  if (!target || target.tagName !== 'DETAILS') {return;}

  target.open = true;
  // Two rAFs: one for the modal's own show transition, one for the
  // browser to finish laying out the now-expanded <details> — without
  // this, scrollIntoView can measure the pre-expansion height and stop
  // short of the section it's supposed to land on.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    });
  });
}

function closeHelpModal() {
  if (helpModal) {helpModal.classList.remove('show');}
}

export function setupHelpEvents() {
  if (!helpModal) {return;}

  const closeBtn = document.getElementById('close-help-modal');
  if (closeBtn) {closeBtn.addEventListener('click', closeHelpModal);}

  // Tap-outside-to-close, same pattern as every other modal in the app.
  helpModal.addEventListener('click', (event) => {
    if (event.target === helpModal) {closeHelpModal();}
  });

  const openFromSettingsBtn = document.getElementById('open-help-btn');
  if (openFromSettingsBtn) {
    openFromSettingsBtn.addEventListener('click', () => openHelpModal());
  }

  const jumpRow = document.getElementById('help-jump-row');
  if (jumpRow) {
    jumpRow.querySelectorAll('.help-jump-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const target = document.getElementById(chip.dataset.jump);
        if (target && target.tagName === 'DETAILS') {
          target.open = true;
          if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }
        }
      });
    });
  }

  setupFirstVisitGuidance();
}

/**
 * Two lightweight, one-time-only nudges for a brand-new user — both
 * gated on the same persisted flag object so neither repeats once seen:
 *
 *  1. On the very first load ever, auto-open the Help modal (scoped to
 *     Getting Started, since Pomodoro is the default/first view) after
 *     a short delay, so it doesn't collide with page-load entrance
 *     animations.
 *  2. The first time the person switches to the Habits or Progress tab,
 *     a short toast points at the "?" icon now visible in that view's
 *     header — a lighter touch than re-opening a full modal every time
 *     someone lands on a tab for the first time.
 */
function setupFirstVisitGuidance() {
  const state = getHelpState();

  if (!state.welcomeShown) {
    setTimeout(() => {
      openHelpModal('help-getting-started');
      const latest = getHelpState();
      latest.welcomeShown = true;
      saveHelpState(latest);
    }, 900);
  }

  const firstVisitTip = (tabBtnId, key, message) => {
    const tabBtn = document.getElementById(tabBtnId);
    if (!tabBtn) {return;}
    tabBtn.addEventListener('click', () => {
      const current = getHelpState();
      if (current.tabsSeen[key]) {return;}
      current.tabsSeen[key] = true;
      saveHelpState(current);
      setTimeout(() => showToast(message, 'info'), 500);
    });
  };

  firstVisitTip('tab-habits', 'habits', 'New here? Tap the ? icon above for a quick Habits guide.');
  firstVisitTip('tab-progress', 'progress', 'New here? Tap the ? icon above for a quick Progress guide.');
}
