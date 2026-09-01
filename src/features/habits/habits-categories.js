// ==========================================
// CATEGORY MANAGEMENT (Habits tab)
// ==========================================
// The "Manage Categories" modal — distinct from the small autocomplete
// dropdown inside the create/edit habit modal (habits-modal-pickers.js);
// this is the standalone list of every category with add/recolor/delete.
// Mirrors renderTagsManagement() in tasks.js closely (same chip
// structure, same swatch/reset pattern) — see that file for the
// original this was based on.

import {
  habits, savedHabitCategories, setSavedHabitCategories,
  categoryColors, setCategoryColors, currentHabitFilter, setCurrentHabitFilter
} from '../../core/state.js';
import { showToast } from '../../shared/toast/toast.js';
import { customConfirm } from '../../shared/modal/modal-utils.js';
import { getTagColor, suggestTagColor } from '../../shared/color-utils.js';
import { moveToTrash } from '../trash/trash.js';
import { saveHabits, saveHabitCategories } from './habits-storage.js';
import { renderHabits, renderHabitCategories } from './habits-render.js';
import { animateNewListItem } from '../../core/dom-utils.js';
import { t } from '../../core/i18n.js';

export function renderCategoriesManagement() {
  const categoriesManagementList = document.getElementById('categories-management-list');
  if (!categoriesManagementList) {return;}
  categoriesManagementList.innerHTML = '';

  // Filter out empty strings and the default category
  const validCategories = savedHabitCategories.filter(cat => cat && cat.trim() !== '' && cat !== 'Uncategorized');

  // FIX: categories had no color system at all — mirrors tasks.js's
  // renderTagsManagement() exactly (same chip structure, same swatch/
  // reset pattern), reusing getTagColor/tagColors' generic design for
  // categoryColors instead of building a second, parallel system.
  validCategories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip deletable manageable';
    chip.dataset.category = cat;

    const currentColor = getTagColor(cat, categoryColors[cat]);

    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'tag-color-swatch';
    swatch.value = currentColor.hex;
    swatch.title = t('choose_color_for_category', { category: cat });
    swatch.setAttribute('aria-label', t('color_for_category', { category: cat }));
    swatch.addEventListener('input', (e) => e.stopPropagation());
    swatch.addEventListener('change', (e) => {
      setCategoryColors({ ...categoryColors, [cat]: e.target.value });
      saveHabitCategories();
      renderHabits();
      renderCategoriesManagement();
    });
    swatch.addEventListener('click', (e) => e.stopPropagation());
    // FIX: see the matching fix + comment on the tag chip's swatch in
    // tasks-tags-modal.js — keydown bubbles to the chip's own listener
    // before Enter/Space opens the native picker, so without stopping
    // it here the chip's delete handler fired instead.
    swatch.addEventListener('keydown', (e) => e.stopPropagation());

    const label = document.createElement('span');
    label.className = 'tag-chip-label';
    label.textContent = cat;

    chip.appendChild(swatch);
    chip.appendChild(label);

    if (categoryColors[cat]) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'tag-color-reset';
      resetBtn.title = t('reset_category_color', { category: cat });
      resetBtn.setAttribute('aria-label', t('reset_category_color_aria', { category: cat }));
      resetBtn.innerHTML = '↺';
      resetBtn.dataset.sound = 'click';
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { [cat]: _removed, ...rest } = categoryColors;
        setCategoryColors(rest);
        saveHabitCategories();
        renderHabits();
        renderCategoriesManagement();
      });
      // FIX: same bubbling issue as the swatch above (see its comment).
      resetBtn.addEventListener('keydown', (e) => e.stopPropagation());
      chip.appendChild(resetBtn);
    }

    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', t('delete_category_aria', { category: cat }));
    const requestDelete = () => {
      customConfirm(t('delete_category_confirm', { category: cat }), () => {
        // SECURE FIX: Mutate array using splice, do NOT reassign
        const targetIndex = savedHabitCategories.indexOf(cat);
        if (targetIndex > -1) {
          savedHabitCategories.splice(targetIndex, 1);
        }

        // Move habits to Uncategorized if their category is deleted
        habits.forEach(h => { if (h.category === cat) {h.category = 'Uncategorized';} });

        // Its color entry (if any) is now orphaned — clean it up too.
        const catColor = categoryColors[cat] || null;
        if (catColor) {
          const { [cat]: _removed, ...rest } = categoryColors;
          setCategoryColors(rest);
        }

        // Soft-delete: the category's name + any custom color go to
        // Trash so it can be restored later — see trash.js.
        moveToTrash('category', cat, { name: cat, color: catColor });

        saveHabitCategories();
        saveHabits();

        if (currentHabitFilter === cat) {setCurrentHabitFilter('all');}

        renderCategoriesManagement();
        renderHabitCategories();
        renderHabits();
      });
    };
    chip.addEventListener('click', requestDelete);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        requestDelete();
      }
    });
    categoriesManagementList.appendChild(chip);
  });
}

export function setupCategoryManagement() {
  const manageCategoriesBtn = document.getElementById('manage-categories-btn');
  const categoriesModal = document.getElementById('categories-modal');
  const closeCategoriesModal = document.getElementById('close-categories-modal');
  const manageAddCategoryBtn = document.getElementById('manage-add-category-btn');
  const manageNewCategoryInput = document.getElementById('manage-new-category-input');
  const manageNewCategoryColor = document.getElementById('manage-new-category-color');

  // Mirrors refreshSuggestedTagColor in tasks.js.
  function refreshSuggestedCategoryColor() {
    if (!manageNewCategoryColor) {return;}
    const existingHexes = savedHabitCategories.map(c => getTagColor(c, categoryColors[c]).hex);
    manageNewCategoryColor.value = suggestTagColor(existingHexes);
  }

  if (manageCategoriesBtn && categoriesModal) {
    manageCategoriesBtn.addEventListener('click', () => {
      renderCategoriesManagement();
      categoriesModal.classList.add('show');
      refreshSuggestedCategoryColor();
    });
  }

  if (closeCategoriesModal) {closeCategoriesModal.addEventListener('click', () => categoriesModal.classList.remove('show'));}

  if (manageAddCategoryBtn) {
    manageAddCategoryBtn.addEventListener('click', () => {
      if (!manageNewCategoryInput) {return;}
      const newCat = manageNewCategoryInput.value.trim();

      // Empty Warning
      if (!newCat) {
        showToast(t('please_enter_category_name'), 'warning');
        return;
      }

      const alreadyExists = savedHabitCategories.some(c => c.toLowerCase() === newCat.toLowerCase());
      if (!alreadyExists) {
        const capitalizedCat = newCat.charAt(0).toUpperCase() + newCat.slice(1);

        // Same pattern as Manage Tags (tasks.js): pick up whatever the
        // swatch currently holds — pre-filled with a suggestion that
        // avoids existing category colors, or overridden by the user —
        // and warn (without blocking) if it happens to exactly match one.
        const pickedColor = manageNewCategoryColor ? manageNewCategoryColor.value : null;
        const collision = pickedColor && savedHabitCategories.some(c =>
          getTagColor(c, categoryColors[c]).hex.toLowerCase() === pickedColor.toLowerCase()
        );

        setSavedHabitCategories([...savedHabitCategories, capitalizedCat]);
        if (pickedColor) {
          setCategoryColors({ ...categoryColors, [capitalizedCat]: pickedColor });
        }

        saveHabitCategories();
        manageNewCategoryInput.value = '';
        renderCategoriesManagement();
        animateNewListItem(document.getElementById('categories-management-list'), capitalizedCat, 'data-category');
        renderHabitCategories();
        refreshSuggestedCategoryColor();
        showToast(collision ? t('category_color_collision_warning') : t('category_added'), collision ? 'warning' : 'success');
      } else {
        showToast(t('category_already_exists'), 'warning');
      }
    });
  }

  // Allow 'Enter' key to add categories (FAIL-SAFE VERSION)
  if (manageNewCategoryInput && manageAddCategoryBtn) {
    manageNewCategoryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        manageAddCategoryBtn.click();
      }
    });
  }

  // FIX: renderCategoriesManagement() was exported (in anticipation of
  // this, it looks like) but never actually wired to languageChanged —
  // this modal's per-category aria-labels/titles (now localized above)
  // stayed in the old locale if a language switch happened while it was
  // open. Mirrors the same fix already in quotes.js's setupQuotesEvents:
  // only re-render while actually open, so this never runs pointlessly.
  document.addEventListener('languageChanged', () => {
    if (categoriesModal && categoriesModal.classList.contains('show')) {
      renderCategoriesManagement();
    }
  });
}
