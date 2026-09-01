// ==========================================
// HABIT ICON DICTIONARY & PICKER GENERATOR
// ==========================================
import { t } from '../../core/i18n.js';

export const habitIconsDict = {
  'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
  'activity': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
  'droplet': '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>',
  'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>',
  'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  'coffee': '<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>',
  'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  'sun': '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
  'monitor': '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>',
  'music': '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  'target': '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
  'trending-up': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
  'calendar': '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  'edit-3': '<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>',
  'dollar-sign': '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
  'smile': '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>',
  'briefcase': '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
  'code': '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
  'home': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
  'award': '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>',
  'bell': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
  'compass': '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
  'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>',
  'globe': '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
  'headphones': '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
  'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  'repeat': '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>',
  'watch': '<circle cx="12" cy="12" r="7"></circle><polyline points="12 9 12 12 13.5 13.5"></polyline><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"></path>',
  'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>',
  'shopping-bag': '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>',
  // FIX: dropped during the i18n reformatting pass (39 icons -> 38) — any
  // habit saved with icon:'shopping-cart' before that would have silently
  // fallen back to a generic icon. Restored from git history (HEAD).
  'shopping-cart': '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>',
  'pencil': '<line x1="18" y1="2" x2="22" y2="6"></line><line x1="14" y1="6" x2="18" y2="10"></line><line x1="2" y1="22" x2="8" y2="16"></line><polygon points="14 2 2 14 2 22 10 22 22 10 14 2"></polygon>',
  'cloud': '<path d="M17.5 19a4.5 4.5 0 0 0 0-9h-1.26A8 8 0 1 0 3 16.29"></path><polyline points="16 16 12 20 8 16"></polyline>',
  'cpu': '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>',
  'umbrella': '<path d="M23 12a11.05 11.05 0 0 0-22 0z"></path><line x1="12" y1="2" x2="12" y2="22"></line><path d="M16 22a4 4 0 0 1-8 0"></path>'
};

export const habitIconLabels = {
  'book': 'Book',
  'activity': 'Activity',
  'droplet': 'Water',
  'heart': 'Health',
  'star': 'Star',
  'coffee': 'Coffee',
  'moon': 'Sleep',
  'sun': 'Morning',
  'monitor': 'Screen',
  'music': 'Music',
  'zap': 'Energy',
  'target': 'Target',
  'trending-up': 'Progress',
  'check-circle': 'Checklist',
  'calendar': 'Calendar',
  'edit-3': 'Journal',
  'dollar-sign': 'Finance',
  'smile': 'Mood',
  'briefcase': 'Work',
  'code': 'Coding',
  'home': 'Home',
  'award': 'Achievement',
  'bell': 'Reminder',
  'book-open': 'Reading',
  'compass': 'Mindfulness',
  'flag': 'Goal',
  'globe': 'Language',
  'headphones': 'Podcast',
  'map-pin': 'Walk',
  'repeat': 'Routine',
  'watch': 'Time',
  'users': 'Social',
  'camera': 'Photography',
  'shopping-bag': 'Shopping',
  'shopping-cart': 'Groceries',
  'pencil': 'Writing',
  'cloud': 'Outdoor',
  'cpu': 'Tech',
  'umbrella': 'Weather'
};

// FIX: these aria-labels used to come straight from habitIconLabels above
// — plain English, with no localization possible, since these buttons are
// generated dynamically here rather than living in index.html (the static
// aria-label sweep for missing data-i18n-aria-label attributes couldn't
// have caught this file). t() falls back to returning the key itself if a
// translation is missing, so habitIconLabels[key] is the fallback for
// that fallback, purely defensive.
function iconLabel(key) {
  const i18nKey = `habit_icon_${key.replace(/-/g, '_')}`;
  const translated = t(i18nKey);
  return translated !== i18nKey ? translated : (habitIconLabels[key] || key);
}

/**
 * Renders all habit icon option buttons into the icon picker grid container.
 */
export function renderHabitIconPicker(containerId = 'habit-icon-picker') {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  const entries = Object.entries(habitIconsDict);
  container.innerHTML = entries.map(([key, svgInner], index) => {
    const isSelected = index === 0;
    return `<button type="button" class="icon-option${isSelected ? ' selected' : ''}" data-icon="${key}" aria-pressed="${isSelected}" aria-label="${iconLabel(key)}" data-sound="click"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svgInner}</svg></button>`;
  }).join('');
}

// FIX: renderHabitIconPicker() only runs once, at app startup — the icon
// grid is built once and just shown/hidden with the modal after that (see
// setupHabitModalPickers in habits-modal-pickers.js), so its aria-labels
// were stuck in whatever language was active on page load. Re-running the
// full renderHabitIconPicker() on languageChanged would fix that, but it
// rebuilds every button from scratch via innerHTML — which would silently
// reset the current selection back to the first icon if the create/edit
// habit modal happened to be open at the moment the language changed
// (habits-modal-open.js only re-applies the correct .selected class when
// the modal is *opened*, not on a language change while it's already
// open). This instead just updates each existing button's aria-label in
// place, leaving .selected/aria-pressed and the DOM nodes themselves
// untouched — safe to call any time, including with the modal open.
export function updateHabitIconPickerLabels(containerId = 'habit-icon-picker') {
  const container = document.getElementById(containerId);
  if (!container) {return;}
  container.querySelectorAll('.icon-option[data-icon]').forEach(btn => {
    btn.setAttribute('aria-label', iconLabel(btn.dataset.icon));
  });
}
