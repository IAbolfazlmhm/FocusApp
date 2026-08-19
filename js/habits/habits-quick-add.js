// ==========================================
// QUICK ADD HABIT
// ==========================================
import { habits, setHabits } from '../core/state.js';
import { generateId } from '../core/dom-utils.js';
import { showToast } from '../ui/toast.js';
import { keepInputVisibleOnMobileKeyboard } from '../ui/scroll-utils.js';
import { habitIconsDict } from './habit-icons.js';
import { saveHabits } from './habits-storage.js';
import { renderHabits, renderHabitCategories } from './habits-render.js';

function processQuickAddHabit(input) {
  const name = input.value.trim();

  if (!name) {
    showToast('Please enter a valid habit name.', 'warning');
    return;
  }

  // Pick Random Color & Icon
  const colors = ['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];
  const iconKeys = Object.keys(habitIconsDict);
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomIcon = iconKeys[Math.floor(Math.random() * iconKeys.length)];

  const newHabit = {
    id: generateId(),
    name: name,
    category: 'Uncategorized',
    frequency: 'everyday',
    color: randomColor,
    icon: randomIcon,
    logs: {},
    createdAt: new Date(new Date().setHours(0,0,0,0)).toISOString()
  };

  setHabits([...habits, newHabit]);
  saveHabits();

  input.value = '';
  renderHabits();
  renderHabitCategories();
}

// FIX: this used to run at module top level (i.e. the instant habits.js
// was first imported) rather than from an explicit setup call like
// every other piece of this tab's wiring — it happened to still work,
// since ES module scripts don't execute until the DOM is already
// parsed, but wrapping it here makes execution order explicit instead
// of an accident of import timing.
export function setupQuickAddHabit() {
  const quickAddBtn = document.getElementById('quick-add-habit-btn');
  const quickHabitInput = document.getElementById('quick-habit-input');

  if (quickAddBtn && quickHabitInput) {
    quickAddBtn.addEventListener('click', () => processQuickAddHabit(quickHabitInput));
  }

  if (quickHabitInput) {
    quickHabitInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        processQuickAddHabit(quickHabitInput);
      }
    });
    keepInputVisibleOnMobileKeyboard(quickHabitInput);
  }
}
