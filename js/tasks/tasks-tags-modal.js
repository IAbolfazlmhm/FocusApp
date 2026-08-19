// ==========================================
// MANAGE TAGS MODAL
// ==========================================
// The standalone "Manage Tags" modal reached via its own gear/manage
// button — distinct from the quick-tag picker (tasks-quick-tag-modal.js)
// reached from the Add Task row, though that modal can also add a new
// tag and dispatches 'refreshTagsManagement' (listened for below) to
// keep this modal's list in sync if it happens to already be open.

import {
  tasks, savedTags, tagColors, currentFilter,
  setSavedTags, setTagColors, setCurrentFilter
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { icons, animateNewListItem } from '../core/dom-utils.js';
import { getTagColor, suggestTagColor } from '../ui/color-utils.js';
import { customConfirm } from '../ui/modal-utils.js';
import { moveToTrash } from '../trash/trash.js';
import { saveTasks } from './tasks-storage.js';
import { renderTasks, renderFilters } from './tasks-render.js';

export function renderTagsManagement() {
  const tagsManagementList = document.getElementById('tags-management-list');
  if (!tagsManagementList) {return;}
  tagsManagementList.innerHTML = '';

  savedTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip deletable manageable';
    chip.dataset.tag = tag;

    const currentColor = getTagColor(tag, tagColors[tag]);

    // Native <input type="color"> — small, no extra CSS component to
    // build, works on every platform's own color picker UI, and is fully
    // keyboard/screen-reader operable out of the box.
    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'tag-color-swatch';
    swatch.value = currentColor.hex;
    swatch.title = `Choose a color for #${tag}`;
    swatch.setAttribute('aria-label', `Color for tag ${tag}`);
    swatch.addEventListener('input', (e) => {
      // Stop this from also triggering the chip's own click→delete handler.
      e.stopPropagation();
    });
    swatch.addEventListener('change', (e) => {
      setTagColors({ ...tagColors, [tag]: e.target.value });
      saveTasks();
      renderTasks();
      renderTagsManagement();
    });
    swatch.addEventListener('click', (e) => e.stopPropagation());
    // FIX: keydown bubbles up to the chip's own keydown listener before
    // the browser turns Enter/Space into the native color picker opening
    // — without stopping it here, pressing Enter while focused on the
    // swatch triggered the chip's delete handler instead of opening the
    // picker. click/input above only cover the mouse path.
    swatch.addEventListener('keydown', (e) => e.stopPropagation());

    const label = document.createElement('span');
    label.className = 'tag-chip-label';
    label.textContent = `#${tag}`;

    chip.appendChild(swatch);
    chip.appendChild(label);

    // FIX: this chip's only affordance was a click handler — a
    // keyboard-only user could never reach or trigger it (see the
    // matching, already-accessible category chip in
    // renderCategoriesManagement(), habits-categories.js, which this
    // now matches).
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', `Delete tag ${tag}`);

    // Only a custom color needs a way back to "no override" — the hash
    // default has nothing to reset away from.
    if (tagColors[tag]) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'tag-color-reset';
      resetBtn.title = `Reset #${tag} to its default color`;
      resetBtn.setAttribute('aria-label', `Reset color for tag ${tag}`);
      resetBtn.innerHTML = icons.reset || '↺';
      resetBtn.dataset.sound = 'click';
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { [tag]: _removed, ...rest } = tagColors;
        setTagColors(rest);
        saveTasks();
        renderTasks();
        renderTagsManagement();
      });
      // FIX: same bubbling issue as the swatch above — a <button>'s
      // Enter/Space keydown still bubbles to the chip's listener before
      // the browser synthesizes the click, so without this the chip's
      // delete handler fired instead of (or in addition to) reset.
      resetBtn.addEventListener('keydown', (e) => e.stopPropagation());
      chip.appendChild(resetBtn);
    }

    const deleteTag = () => {
      customConfirm(`Delete tag "${tag}"?`, () => {
        setSavedTags(savedTags.filter(t => t !== tag));

        tasks.forEach(t => {
            if (t.tag === tag) {t.tag = null;}
        });

        if (currentFilter === tag) {setCurrentFilter('all');}

        // Custom colors are keyed by tag name — clear the override too so
        // a brand new, unrelated tag with the same name later doesn't
        // silently inherit an old color from a tag that no longer exists.
        const tagColor = tagColors[tag] || null;
        if (tagColor) {
          const { [tag]: _removed, ...rest } = tagColors;
          setTagColors(rest);
        }

        // Soft-delete: the tag's name + any custom color go to Trash so
        // it can be restored later — see trash.js.
        moveToTrash('tag', tag, { name: tag, color: tagColor });

        saveTasks();
        renderTagsManagement();
        renderFilters();
        renderTasks();
      });
    };

    chip.addEventListener('click', deleteTag);
    // Enter/Space activate this chip the same way a real <button> would
    // — see the matching handler on the category chip (habits) for why
    // this is needed alongside role="button"/tabindex above.
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        deleteTag();
      }
    });
    tagsManagementList.appendChild(chip);
  });
}

/**
 * Puts a trashed tag back into savedTags (and its custom color, if it
 * had one). Called from the Trash modal — see restoreTask() in tasks.js
 * for why this restore logic lives with the rest of a feature's own
 * CRUD rather than in trash-ui.js.
 */
export function restoreTag(tagData) {
  if (!tagData || !tagData.name || savedTags.includes(tagData.name)) {return;}
  setSavedTags([...savedTags, tagData.name]);
  if (tagData.color) {setTagColors({ ...tagColors, [tagData.name]: tagData.color });}
  saveTasks();
  renderTagsManagement();
  renderFilters();
  renderTasks();
}

export function setupTagsManagement() {
  const tagsModal = document.getElementById('tags-modal');
  const closeTagsModal = document.getElementById('close-tags-modal');
  const manageAddTagBtn = document.getElementById('manage-add-tag-btn');
  const manageNewTagInput = document.getElementById('manage-new-tag-input');
  const manageTagsBtn = document.getElementById('manage-tags-btn');
  const manageNewTagColor = document.getElementById('manage-new-tag-color');

  // Pre-fills the new-tag color swatch with a hue that doesn't collide
  // with any tag's current color (custom or hash-based) — see
  // suggestTagColor's own comment in color-utils.js for why that matters.
  function refreshSuggestedTagColor() {
    if (!manageNewTagColor) {return;}
    const existingHexes = savedTags.map(t => getTagColor(t, tagColors[t]).hex);
    manageNewTagColor.value = suggestTagColor(existingHexes);
  }

  if (manageTagsBtn) {
    manageTagsBtn.addEventListener('click', () => {
      if (tagsModal) {tagsModal.classList.add('show');}
      renderTagsManagement();
      refreshSuggestedTagColor();
    });
  }

  if (manageNewTagInput) {
    manageNewTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (manageAddTagBtn) {manageAddTagBtn.click();}
      }
    });
  }

  if (closeTagsModal) {
    closeTagsModal.addEventListener('click', () => {
      if (tagsModal) {tagsModal.classList.remove('show');}
    });
  }

  if (manageAddTagBtn) {
    manageAddTagBtn.addEventListener('click', () => {
      if (!manageNewTagInput) {return;}
      const newTagName = manageNewTagInput.value.trim();

      if (!newTagName) {
        showToast('Please enter a valid tag name.', 'warning');
        return;
      }

      const alreadyExists = savedTags.some(t => t.toLowerCase() === newTagName.toLowerCase());
      if (!alreadyExists) {
        const finalName = newTagName.charAt(0).toUpperCase() + newTagName.slice(1);

        // FIX: there was previously no way to set a tag's color at
        // creation time at all — it always started out hash-based (see
        // getTagColor, color-utils.js) and could only be customized by
        // opening this same modal again afterward. The swatch here was
        // pre-filled with a suggestion (refreshSuggestedTagColor) that
        // already avoids colliding with existing tags, but the user may
        // also have picked their own — check against the tag list as it
        // stood before this addition, then save whatever the swatch
        // currently holds instead of discarding it.
        const pickedColor = manageNewTagColor ? manageNewTagColor.value : null;
        const collision = pickedColor && savedTags.some(t =>
          getTagColor(t, tagColors[t]).hex.toLowerCase() === pickedColor.toLowerCase()
        );

        setSavedTags([...savedTags, finalName]);
        if (pickedColor) {
          setTagColors({ ...tagColors, [finalName]: pickedColor });
        }

        saveTasks();
        renderTagsManagement();
        renderFilters();
        animateNewListItem(document.getElementById('tags-management-list'), finalName, 'data-tag');
        manageNewTagInput.value = '';
        refreshSuggestedTagColor();
        showToast(collision ? 'Tag added — that color is already in use by another tag.' : 'Tag added', collision ? 'warning' : 'success');
      } else {
        showToast('That tag already exists.', 'warning');
      }
    });
  }

  // Listen for new tags added from the gear icon (tasks-quick-tag-modal.js)
  // to update this modal's list, in case it happens to already be open.
  document.addEventListener('refreshTagsManagement', () => {
    renderTagsManagement();
  });
}
