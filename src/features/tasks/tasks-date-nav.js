// ==========================================
// DATE NAVIGATION (Pomodoro tab)
// ==========================================
import { currentPomodoroDate, setCurrentPomodoroDate } from '../../core/state.js';
import { renderTasks } from './tasks-render.js';
import { openDatePickerPopover } from '../../shared/date-nav/date-picker-popover.js';
import { t, formatDate } from '../../core/i18n.js';

export function updatePomodoroDateUI() {
  const pomodoroDisplayBtn = document.getElementById('pomodoro-date-display');
  if (!pomodoroDisplayBtn) {return;}
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffTime = currentPomodoroDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {pomodoroDisplayBtn.textContent = t('today');}
  else if (diffDays === -1) {pomodoroDisplayBtn.textContent = t('yesterday');}
  else if (diffDays === 1) {pomodoroDisplayBtn.textContent = t('tomorrow');}
  else {pomodoroDisplayBtn.textContent = formatDate(currentPomodoroDate, { month: 'short', day: 'numeric' });}
}

export function setupPomodoroDateNav() {
  const pomodoroDisplayBtn = document.getElementById('pomodoro-date-display');
  const pomodoroDatePicker = document.getElementById('pomodoro-date-picker');
  const pomodoroPrevDate = document.getElementById('pomodoro-prev-date');
  const pomodoroNextDate = document.getElementById('pomodoro-next-date');

  updatePomodoroDateUI();

  // 1. Arrows
  if (pomodoroPrevDate) {
    pomodoroPrevDate.addEventListener('click', () => {
      currentPomodoroDate.setDate(currentPomodoroDate.getDate() - 1);
      updatePomodoroDateUI();
      renderTasks();
    });
  }
  if (pomodoroNextDate) {
    pomodoroNextDate.addEventListener('click', () => {
      currentPomodoroDate.setDate(currentPomodoroDate.getDate() + 1);
      updatePomodoroDateUI();
      renderTasks();
    });
  }

  // 2. Calendar Popup
  if (pomodoroDisplayBtn && pomodoroDatePicker) {
    pomodoroDisplayBtn.addEventListener('click', () => {
      openDatePickerPopover({
        trigger: pomodoroDisplayBtn,
        selectedDate: currentPomodoroDate,
        onSelect(date) {
          setCurrentPomodoroDate(date);
          currentPomodoroDate.setHours(0, 0, 0, 0);
          pomodoroDatePicker.value = date.toISOString().slice(0, 10);
          updatePomodoroDateUI();
          renderTasks();
        }
      });
    });

  pomodoroDatePicker.addEventListener('change', (e) => {
      if (!e.target.value) {return;}
      // value is formatted as "YYYY-MM-DD"
      const [year, month, day] = e.target.value.split('-').map(Number);
      setCurrentPomodoroDate(new Date(year, month - 1, day));
      currentPomodoroDate.setHours(0, 0, 0, 0);
      updatePomodoroDateUI();
      renderTasks();
    });
  }
}
