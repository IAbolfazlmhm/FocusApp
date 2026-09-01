// ==========================================
// HELP & GUIDE
// ==========================================
import { readJSON, writeJSON, STORAGE_KEYS } from '../../core/storage.js';
import { showToast } from '../../shared/toast/toast.js';
import { helpTopics } from './help-data.js';
import { t } from '../../core/i18n.js';

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

export function renderHelpContent() {
  const container = document.getElementById('help-sections-container');
  if (!container) {return;}

  container.innerHTML = helpTopics.map(topic => {
    const title = t(topic.titleKey) !== topic.titleKey ? t(topic.titleKey) : topic.defaultTitle;
    const pointsHTML = topic.points.map(p => {
      const strong = t(p.strongKey) !== p.strongKey ? t(p.strongKey) : p.strongDefault;
      const text = t(p.textKey) !== p.textKey ? t(p.textKey) : p.textDefault;
      return `<li><strong>${strong}</strong>${text}</li>`;
    }).join('');

    return `
      <details class="help-section" id="${topic.id}" ${topic.open ? 'open' : ''}>
        <summary class="help-section-summary">
          <svg class="ui-icon help-topic-icon" aria-hidden="true"><use href="#${topic.icon}"/></svg>
          <span>${title}</span>
          <svg class="ui-icon help-chevron" aria-hidden="true"><use href="#icon-chevron-down"/></svg>
        </summary>
        <div class="help-section-body">
          <ul>${pointsHTML}</ul>
        </div>
      </details>
    `;
  }).join('');
}

/**
 * Opens the Help modal. If a sectionId is given, that section is expanded and scrolled into view.
 */
export function openHelpModal(sectionId) {
  if (!helpModal) {return;}

  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {settingsModal.classList.remove('show');}

  renderHelpContent();
  helpModal.classList.add('show');

  if (!sectionId) {return;}
  const target = document.getElementById(sectionId);
  if (!target || target.tagName !== 'DETAILS') {return;}

  target.open = true;
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

  helpModal.addEventListener('click', (event) => {
    if (event.target === helpModal) {closeHelpModal();}
  });

  const openFromSettingsBtn = document.getElementById('open-help-btn');
  if (openFromSettingsBtn) {
    openFromSettingsBtn.addEventListener('click', () => openHelpModal());
  }

  setupFirstVisitGuidance();
}

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

  const firstVisitTip = (tabBtnId, key, messageKey, defaultMessage) => {
    const tabBtn = document.getElementById(tabBtnId);
    if (!tabBtn) {return;}
    tabBtn.addEventListener('click', () => {
      const current = getHelpState();
      if (current.tabsSeen[key]) {return;}
      current.tabsSeen[key] = true;
      saveHelpState(current);
      const msg = t(messageKey) !== messageKey ? t(messageKey) : defaultMessage;
      setTimeout(() => showToast(msg, 'info'), 500);
    });
  };

  firstVisitTip('tab-habits', 'habits', 'first_visit_habits_tip', 'New here? Open Settings → Help & Guide for a quick overview.');
  firstVisitTip('tab-progress', 'progress', 'first_visit_progress_tip', 'New here? Open Settings → Help & Guide for dashboard guidance.');
}
