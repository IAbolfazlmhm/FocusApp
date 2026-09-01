// ==========================================
// QUICK TAG MODAL (gear icon next to Add Task)
// ==========================================
import { savedTags, setSavedTags } from '../../core/state.js';
import { showToast } from '../../shared/toast/toast.js';
import { t } from '../../core/i18n.js';
import { escapeHTML } from '../../core/dom-utils.js';
import { saveTasks } from './tasks-storage.js';
import { renderFilters } from './tasks-render.js';
import { quickTagState } from './tasks-quick-tag-state.js';

export function setupQuickTagModal() {
  const taskInput = document.getElementById('task-input');
  const advancedTaskBtn = document.getElementById('advanced-task-btn');
  const quickTagModal = document.getElementById('quick-tag-modal');
  const closeQuickTagModal = document.getElementById('close-quick-tag-modal');
  const quickModalTagList = document.getElementById('quick-modal-tag-list');
  const quickModalAddBtn = document.getElementById('quick-modal-add-btn');
  const quickModalTagInput = document.getElementById('quick-modal-tag-input');

  function renderQuickTagModal() {
    if (!quickModalTagList) {return;}
    quickModalTagList.innerHTML = '';

    // "No Tag" option
    const noTagBtn = document.createElement('button');
    noTagBtn.type = 'button';
    noTagBtn.className = 'tag-chip selectable';
    noTagBtn.setAttribute('aria-label', t('no_tag'));
    // FIX: was a literal ❌ emoji — swapped for the app's own close-icon
    // SVG so it renders consistently across platforms instead of
    // whichever emoji glyph the OS happens to supply.
    // FIX: the visible label and aria-label here were hardcoded English
    // ("No tag" / "No Tag") even though a matching no_tag locale key
    // already existed, unused — this was the one tag-chip in the picker
    // that never translated.
    noTagBtn.innerHTML = `<svg class="ui-icon" aria-hidden="true" style="width:14px;height:14px;"><use href="#icon-close"/></svg> ${t('no_tag')}`;
    noTagBtn.dataset.sound = 'click';
    noTagBtn.onclick = () => selectQuickTag(null);
    // FIX: reopening this modal always rendered every chip in its plain,
    // unselected state, even when a tag had already been picked earlier
    // in the same task-composing session (pendingQuickTag) — there was
    // no code anywhere that compared the chips to it. Theme-colored via
    // .selected (tags.css) so it matches whichever Pomodoro phase is
    // currently active, same as every other "current choice" indicator
    // in the app.
    const isNoTagSelected = !quickTagState.pendingQuickTag;
    noTagBtn.classList.toggle('selected', isNoTagSelected);
    noTagBtn.setAttribute('aria-pressed', String(isNoTagSelected));
    quickModalTagList.appendChild(noTagBtn);

    // Existing Tags
    savedTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip selectable';
      btn.setAttribute('aria-label', t('select_tag_aria', { tag }));
      btn.textContent = `#${tag}`;
      btn.dataset.sound = 'click';
      btn.onclick = () => selectQuickTag(tag);
      const isSelected = quickTagState.pendingQuickTag === tag;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
      quickModalTagList.appendChild(btn);
    });
  }

  function selectQuickTag(tag) {
    quickTagState.pendingQuickTag = tag;
    if (quickTagModal) {quickTagModal.classList.remove('show');}
    if (taskInput) {taskInput.focus();}

    if (tag) {showToast(t('tag_selected', { tag: escapeHTML(tag) }), 'success');}
  }

  if (advancedTaskBtn) {
    advancedTaskBtn.addEventListener('click', () => {
      renderQuickTagModal();
      if (quickTagModal) {quickTagModal.classList.add('show');}
      if (quickModalTagInput) {
        quickModalTagInput.value = '';
      }
    });
  }

  if (closeQuickTagModal) {
    closeQuickTagModal.addEventListener('click', () => {
      if (quickTagModal) {quickTagModal.classList.remove('show');}
    });
  }

  // Handle adding new tag from inside the modal
  function addNewQuickTag() {
    if (!quickModalTagInput) {return;}
    const newTagRaw = quickModalTagInput.value.trim();

    if (!newTagRaw) {
      showToast(t('invalid_tag_name_warning'), 'warning');
      return;
    }

    if (newTagRaw) {
      const existing = savedTags.find(t => t.toLowerCase() === newTagRaw.toLowerCase());
      const newTag = existing || (newTagRaw.charAt(0).toUpperCase() + newTagRaw.slice(1));
      if (!existing) {
        setSavedTags([...savedTags, newTag]);
        saveTasks();
        renderFilters();

        const tagsManagementList = document.getElementById('tags-management-list');
        if (tagsManagementList && tagsManagementList.innerHTML !== '') {
          const renderTagsEvent = new Event('refreshTagsManagement');
          document.dispatchEvent(renderTagsEvent);
        }
      }
      selectQuickTag(newTag);
    }
  }

  if (quickModalAddBtn) {
    quickModalAddBtn.addEventListener('click', addNewQuickTag);
  }

  if (quickModalTagInput) {
    quickModalTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNewQuickTag();
      }
    });
  }

  if (quickTagModal) {
    quickTagModal.addEventListener('click', (e) => {
      if (e.target === quickTagModal) {quickTagModal.classList.remove('show');}
    });
  }
}
