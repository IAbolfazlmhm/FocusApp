// ==========================================
// ADVANCED HABIT DELETION
// ==========================================
// The 3-option delete modal reached via a habit card's delete button:
// clear just today's log, archive (stop tracking but keep history), or
// delete the habit and all its history outright (soft-deleted to Trash
// — see trash.js).

import { habits, setHabits, currentHabitDate } from '../core/state.js';
import { getDateKey } from './habits-logic.js';
import { showToast } from '../ui/toast.js';
import { moveToTrash } from '../trash/trash.js';
import { saveHabits } from './habits-storage.js';
import { renderHabits, updateHabitProgress } from './habits-render.js';

export function setupHabitDeleteModal() {
  const habitListContainer = document.getElementById('habit-list-container');
  const deleteModal = document.getElementById('delete-habit-modal');
  let habitToDeleteId = null;

  // Helper function to safely save habits locally
  const saveHabitsLocal = () => {
    saveHabits();
    // Tell the rest of the app (like the Progress tab) that data changed
    document.dispatchEvent(new Event('dataUpdated'));
  };

  function closeDeleteModal() {
    if (deleteModal) {deleteModal.classList.remove('show');}
    habitToDeleteId = null;
  }

  // 1. Open the Modal (And Play Sound!)
  if (habitListContainer) {
    habitListContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.advanced-delete-btn');
      if (deleteBtn) {
        const habitItem = e.target.closest('.habit-item');
        if (habitItem) {
          habitToDeleteId = habitItem.dataset.id;
          if (deleteModal) {deleteModal.classList.add('show');}
        }
      }
    });
  }

  // 2. Remove Today's Habit Completely
  // FIX: removed e.stopPropagation() — these buttons now use data-sound="trash"
  // in HTML to suppress the global click sound (see js/main.js's global listener).
  document.getElementById('delete-habit-today-btn')?.addEventListener('click', () => {
    if (!habitToDeleteId) {return;}

    const habit = habits.find(h => h.id === habitToDeleteId);
    const dateStr = getDateKey(currentHabitDate);

    if (habit) {
      if (!habit.logs) {habit.logs = {};}
      habit.logs[dateStr] = 'hidden'; // BUG FIX: Mark as completely hidden for today

      saveHabitsLocal();
      renderHabits();
      updateHabitProgress();

      showToast("Habit removed from today.", "success", true);
    }
    closeDeleteModal();
  });

  // 3. Stop Tracking (Keep History)
  document.getElementById('delete-habit-future-btn')?.addEventListener('click', () => {
    if (!habitToDeleteId) {return;}

    const habit = habits.find(h => h.id === habitToDeleteId);

    if (habit) {
      const yesterday = new Date(currentHabitDate);
      yesterday.setHours(0, 0, 0, 0);
      yesterday.setMilliseconds(-1);

      habit.endDate = yesterday.getTime();
      saveHabitsLocal();
      renderHabits();
      updateHabitProgress();
      showToast("Habit archived. History preserved.", "success", true);
    }
    closeDeleteModal();
  });

  // 4. Delete All History (Nuke it)
  document.getElementById('delete-habit-all-btn')?.addEventListener('click', () => {
    if (!habitToDeleteId) {return;}

    const deletedHabit = habits.find(h => h.id === habitToDeleteId);
    const updatedHabits = habits.filter(h => h.id !== habitToDeleteId);
    setHabits(updatedHabits);
    // Soft-delete: the full habit (including its logs/streak history)
    // goes to Trash instead of being gone for good — see trash.js.
    if (deletedHabit) {moveToTrash('habit', deletedHabit.name, deletedHabit);}

    saveHabitsLocal();
    renderHabits();
    updateHabitProgress();
    showToast("Habit and all history moved to Trash.", "success", true);
    closeDeleteModal();
  });

  // 5. Close Handlers (Cancel)
  document.getElementById('close-delete-habit-modal')?.addEventListener('click', closeDeleteModal);

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {closeDeleteModal();}
    });
  }
}
