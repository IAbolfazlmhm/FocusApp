// ==========================================
// QUOTE MANAGEMENT (Settings > Manage Quotes)
// ==========================================
// UI layer only — rendering the modal's list and wiring its form. All
// quote *data* (built-in load, pool merging for rotation, CRUD,
// persistence) lives in motivation.js, same split as every other
// feature module owning its DOM over storage.js/state.js.

import { escapeHTML, animateNewListItem } from '../../core/dom-utils.js';
import { showToast } from '../../shared/toast/toast.js';
import { customConfirm } from '../../shared/modal/modal-utils.js';
import { setupSelectDropdown } from '../../shared/dropdown/dropdown.js';
import {
  getUserQuotes, addUserQuote, updateUserQuote, deleteUserQuote, toggleUserQuoteEnabled,
  getBuiltInQuotesForManagement, updateBuiltInQuoteOverride, toggleBuiltInQuoteEnabled, resetBuiltInQuoteOverride
} from './motivation.js';
import { t } from '../../core/i18n.js';

function getCategoryLabels() {
  return {
    general: t('quote_category_general'),
    focus: t('quote_category_focus'),
    habits: t('quote_category_habits')
  };
}

const MAX_QUOTE_LENGTH = 140;

export function setupQuotesEvents() {
  const manageBtn = document.getElementById('manage-quotes-btn');
  const modal = document.getElementById('quotes-modal');
  const closeBtn = document.getElementById('close-quotes-modal');
  const listEl = document.getElementById('user-quotes-list');
  const emptyMsg = document.getElementById('user-quotes-empty');
  const textInput = document.getElementById('new-quote-input');
  const addBtn = document.getElementById('add-quote-btn');
  const categoryDisplay = document.getElementById('quote-category-display');
  const categorySelect = document.getElementById('quote-category-select');
  const categoryDropdown = document.getElementById('quote-category-dropdown');

  if (!modal || !listEl || !textInput || !addBtn || !categorySelect || !categoryDisplay) {return;}

  // Tracks which quote is being edited, if any. null means the form's
  // next Add click creates a new quote instead of updating one.
  let editingId = null;

  function setCategory(value, label) {
    categorySelect.value = value;
    categorySelect.dispatchEvent(new Event('change'));
    categoryDisplay.value = label;
  }

  function resetForm() {
    editingId = null;
    textInput.value = '';
    setCategory('general', getCategoryLabels().general);
    addBtn.textContent = t('add');
  }

  function renderList() {
    const quotes = getUserQuotes();
    listEl.innerHTML = '';

    if (emptyMsg) {emptyMsg.style.display = quotes.length === 0 ? 'block' : 'none';}

    const catLabels = getCategoryLabels();
    quotes.forEach(q => {
      const row = document.createElement('div');
      const isEnabled = q.enabled !== false;
      row.className = `quote-manage-item${isEnabled ? '' : ' quote-disabled'}`;
      row.dataset.id = q.id;
      // escapeHTML on both fields — quote text and category label are the
      // only user-supplied strings in this template.
      row.innerHTML = `
        <div class="quote-manage-text">
          <span class="quote-category-badge">${escapeHTML(catLabels[q.category] || catLabels.general)}</span>
          <p>&ldquo;${escapeHTML(q.quote)}&rdquo;</p>
        </div>
        <div class="quote-manage-actions">
          <button type="button" class="icon-btn toggle-quote-btn" title="${isEnabled ? t('disable_quote') : t('enable_quote')}" aria-label="${isEnabled ? t('disable_quote') : t('enable_quote')}" aria-pressed="${isEnabled}" data-sound="click">
            <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isEnabled ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle>' : '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.61 3.85M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'}</svg>
          </button>
          <button type="button" class="icon-btn edit-quote-btn" title="${t('edit_quote')}" aria-label="${t('edit_quote')}" data-sound="click">
            <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          <button type="button" class="icon-btn delete-quote-btn" title="${t('delete_quote')}" aria-label="${t('delete_quote')}" data-sound="click">
            <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      row.querySelector('.toggle-quote-btn').addEventListener('click', () => {
        const nowEnabled = toggleUserQuoteEnabled(q.id);
        showToast(nowEnabled ? t('quote_enabled_toast') : t('quote_disabled_toast'), 'success');
        renderList();
      });

      row.querySelector('.edit-quote-btn').addEventListener('click', () => {
        editingId = q.id;
        textInput.value = q.quote;
        const catLabels = getCategoryLabels();
        setCategory(q.category, catLabels[q.category] || catLabels.general);
        addBtn.textContent = t('save_changes');
        textInput.focus();
      });

      row.querySelector('.delete-quote-btn').addEventListener('click', () => {
        customConfirm(t('delete_quote_confirm'), () => {
          deleteUserQuote(q.id);
          if (editingId === q.id) {resetForm();}
          renderList();
          showToast(t('quote_deleted_toast'), 'success');
        });
      });

      listEl.appendChild(row);
    });
  }

  // --- BUILT-IN (DEFAULT) QUOTES ---
  // Same list/row shape as the user quotes above, but "delete" doesn't
  // apply to a shipped static asset — the toggle IS the removal, and a
  // "Reset" button (only shown once a quote's text/category has been
  // edited) reverts it back to the original shipped wording. See
  // motivation.js's getBuiltInQuotesForManagement() for how the override
  // layer this reads/writes actually works.
  const builtInListEl = document.getElementById('builtin-quotes-list');

  async function renderBuiltInList() {
    if (!builtInListEl) {return;}
    const quotes = await getBuiltInQuotesForManagement();
    builtInListEl.innerHTML = '';

    const catLabels = getCategoryLabels();
    quotes.forEach(q => {
      const row = document.createElement('div');
      const isEnabled = q.enabled !== false;
      row.className = `quote-manage-item${isEnabled ? '' : ' quote-disabled'}`;
      row.dataset.id = q.id;
      row.innerHTML = `
        <div class="quote-manage-text">
          <span class="quote-category-badge">${escapeHTML(catLabels[q.category] || catLabels.general)}</span>
          <span class="quote-default-badge">${t('default_badge')}</span>
          <p>&ldquo;${escapeHTML(q.quote)}&rdquo;</p>
        </div>
        <div class="quote-manage-actions">
          <button type="button" class="icon-btn toggle-quote-btn" title="${isEnabled ? t('disable_quote') : t('enable_quote')}" aria-label="${isEnabled ? t('disable_quote') : t('enable_quote')}" aria-pressed="${isEnabled}" data-sound="click">
            <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isEnabled ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle>' : '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.61 3.85M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'}</svg>
          </button>
          <button type="button" class="icon-btn edit-quote-btn" title="${t('edit_quote')}" aria-label="${t('edit_quote')}" data-sound="click">
            <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          ${q.isEdited ? `<button type="button" class="icon-btn reset-quote-btn" title="${t('reset_to_original_wording')}" aria-label="${t('reset_to_original_wording')}" data-sound="click">
            <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          </button>` : ''}
        </div>
      `;

      row.querySelector('.toggle-quote-btn').addEventListener('click', () => {
        const nowEnabled = toggleBuiltInQuoteEnabled(q.id);
        showToast(nowEnabled ? t('quote_enabled_toast') : t('quote_disabled_toast'), 'success');
        renderBuiltInList();
      });

      row.querySelector('.edit-quote-btn').addEventListener('click', () => {
        editingId = q.id;
        textInput.value = q.quote;
        const catLabels = getCategoryLabels();
        setCategory(q.category, catLabels[q.category] || catLabels.general);
        addBtn.textContent = t('save_changes');
        textInput.focus();
      });

      row.querySelector('.reset-quote-btn')?.addEventListener('click', () => {
        resetBuiltInQuoteOverride(q.id);
        if (editingId === q.id) {resetForm();}
        renderBuiltInList();
        showToast(t('reverted_to_original_quote_toast'), 'success');
      });

      builtInListEl.appendChild(row);
    });
  }

  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      resetForm();
      renderList();
      renderBuiltInList();
      modal.classList.add('show');
    });
  }

  if (closeBtn) {closeBtn.addEventListener('click', () => modal.classList.remove('show'));}

  document.addEventListener('click', (e) => {
    if (e.target === modal) {modal.classList.remove('show');}
  });

  addBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    const category = categorySelect.value;

    if (!text) {
      showToast(t('please_write_quote_warning'), 'warning');
      return;
    }
    if (text.length > MAX_QUOTE_LENGTH) {
      showToast(t('quote_length_limit_warning', { max: MAX_QUOTE_LENGTH }), 'warning');
      return;
    }

    if (editingId) {
      if (String(editingId).startsWith('builtin-')) {
        updateBuiltInQuoteOverride(editingId, { quote: text, category });
        renderBuiltInList();
      } else {
        updateUserQuote(editingId, { quote: text, category });
        renderList();
      }
      showToast(t('quote_updated_toast'), 'success');
    } else {
      const newQuote = addUserQuote(text, category);
      showToast(t('quote_added_toast'), 'success');
      renderList();
      animateNewListItem(listEl, newQuote.id);
    }

    resetForm();
  });

  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });

  // Re-render the lists and form chrome when the language changes while
  // this modal is open (it's reachable from the same settings flow that
  // dispatches languageChanged). renderBuiltInList() re-derives quote text
  // for the active locale (quote_fa under fa), so the Default Quotes list
  // can't stay English after a switch. resetForm() is deliberately NOT
  // called — it would wipe text the user is mid-typing; only the
  // locale-derived labels (Add/Save, category display) are refreshed.
  document.addEventListener('languageChanged', () => {
    if (modal.classList.contains('show')) {
      renderList();
      renderBuiltInList();
    }
    addBtn.textContent = editingId ? t('save_changes') : t('add');
    const labels = getCategoryLabels();
    categoryDisplay.value = labels[categorySelect.value] || labels.general;
  });

  // --- CATEGORY DROPDOWN ---
  // Same split as settings.js's setupCustomDropdown: selection assignment
  // (what happens when an option is picked) stays local to this call
  // site; open/close/keyboard-nav/ARIA come from the shared
  // setupSelectDropdown() in dropdown.js.
  if (categoryDropdown) {
    categoryDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        setCategory(item.dataset.val, item.textContent);
        categoryDropdown.classList.remove('show');
      });
    });
  }

  setupSelectDropdown({
    wrapperId: 'quote-category-wrapper',
    triggerId: 'quote-category-display',
    dropdownId: 'quote-category-dropdown',
    valueInputId: 'quote-category-select'
  });
}
