// ==========================================
// ANCHORED DATE PICKER
// ==========================================
// Native date pickers are browser/OS surfaces, so their position cannot be
// controlled by the page (especially in device emulation). This small shared
// calendar stays inside the date navigation control for both Pomodoro and
// Habits.

let activePicker = null;

function sameDate(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function closeActivePicker() {
  if (!activePicker) {return;}
  activePicker.trigger.setAttribute('aria-expanded', 'false');
  activePicker.element.remove();
  document.removeEventListener('pointerdown', activePicker.onPointerDown);
  document.removeEventListener('keydown', activePicker.onKeyDown);
  activePicker = null;
}

function renderCalendar(picker) {
  const { element, selectedDate } = picker;
  const monthStart = new Date(picker.viewDate.getFullYear(), picker.viewDate.getMonth(), 1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const leadingDays = monthStart.getDay();

  element.innerHTML = `
    <div class="date-picker-popover-header">
      <button type="button" class="date-picker-nav-btn" aria-label="Previous month">‹</button>
      <span class="date-picker-popover-title">${monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
      <button type="button" class="date-picker-nav-btn" aria-label="Next month">›</button>
    </div>
    <div class="date-picker-weekdays" aria-hidden="true">
      <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
    </div>
    <div class="date-picker-days" role="grid" aria-label="Choose a date"></div>
  `;

  const days = element.querySelector('.date-picker-days');
  for (let index = 0; index < leadingDays; index += 1) {
    days.append(document.createElement('span'));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `date-picker-day${sameDate(date, selectedDate) ? ' is-selected' : ''}`;
    button.textContent = String(day);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    button.setAttribute('aria-selected', String(sameDate(date, selectedDate)));
    button.addEventListener('click', () => {
      picker.onSelect(date);
      closeActivePicker();
    });
    days.append(button);
  }

  const [previous, next] = element.querySelectorAll('.date-picker-nav-btn');
  previous.addEventListener('click', () => {
    picker.viewDate.setMonth(picker.viewDate.getMonth() - 1);
    renderCalendar(picker);
  });
  next.addEventListener('click', () => {
    picker.viewDate.setMonth(picker.viewDate.getMonth() + 1);
    renderCalendar(picker);
  });
}

export function openDatePickerPopover({ trigger, selectedDate, onSelect }) {
  if (activePicker?.trigger === trigger) {
    closeActivePicker();
    return;
  }

  closeActivePicker();
  const element = document.createElement('div');
  element.className = 'date-picker-popover glass-effect';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', 'Choose a date');
  trigger.parentElement.append(element);

  const picker = {
    element,
    trigger,
    selectedDate: new Date(selectedDate),
    viewDate: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    onSelect,
    onPointerDown(event) {
      if (!element.contains(event.target) && event.target !== trigger) {closeActivePicker();}
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeActivePicker();
        trigger.focus();
      }
    }
  };

  activePicker = picker;
  trigger.setAttribute('aria-expanded', 'true');
  renderCalendar(picker);
  setTimeout(() => {
    document.addEventListener('pointerdown', picker.onPointerDown);
    document.addEventListener('keydown', picker.onKeyDown);
  }, 0);
}
