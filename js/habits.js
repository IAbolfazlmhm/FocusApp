import { 
  habits, savedHabitCategories, currentHabitDate,
  setCurrentHabitDate 
} from './state.js';

import { playUI } from './audio.js';
import { showToast } from './ui-utils.js';

// ==========================================
// DOM ELEMENTS
// ==========================================
const habitListContainer = document.getElementById('habit-list-container');
const habitDateDisplay = document.getElementById('habit-date-display');
const prevDayBtn = document.getElementById('prev-day-btn');
const nextDayBtn = document.getElementById('next-day-btn');

const openAddHabitBtn = document.getElementById('open-add-habit-btn');
const habitModal = document.getElementById('habit-modal');
const closeHabitModalBtn = document.getElementById('close-habit-modal');
const saveHabitBtn = document.getElementById('save-habit-btn');

const colorOptions = document.querySelectorAll('.color-option');
const iconOptions = document.querySelectorAll('.icon-option');
const freqInput = document.getElementById('habit-frequency-input');
const customDaysPicker = document.getElementById('custom-days-picker');
const dayOptions = document.querySelectorAll('.day-option');

const habitCategoryInput = document.getElementById('habit-category-input');
const habitCategoryDropdown = document.getElementById('habit-category-dropdown');
const habitCategoryWrapper = document.getElementById('habit-category-wrapper');

let editingHabitId = null;

// ==========================================
// ICON DICTIONARY & HELPERS
// ==========================================
export const habitIconsDict = {
    'book': `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`,
    'activity': `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`,
    'droplet': `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>`,
    'heart': `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>`,
    'star': `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
    'coffee': `<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>`,
    'moon': `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
    'sun': `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
    'monitor': `<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`,
    'music': `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`
};

function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================
// DATE NAVIGATION LOGIC
// ==========================================
function formatHabitDate(dateObj) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = dateObj - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function updateHabitDateDisplay() {
    if (habitDateDisplay) {
        habitDateDisplay.textContent = formatHabitDate(currentHabitDate);
    }
    renderHabits();
}

export function updateDateDisplayUI() {
    const dateDisplayBtn = document.getElementById('habit-date-display');
    if (!dateDisplayBtn) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate difference in days between selected date and actual today
    const diffTime = currentHabitDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        dateDisplayBtn.textContent = 'Today';
    } else if (diffDays === -1) {
        dateDisplayBtn.textContent = 'Yesterday';
    } else if (diffDays === 1) {
        dateDisplayBtn.textContent = 'Tomorrow';
    } else {
        // If it's further away, format it nicely (e.g., "Jun 5")
        const options = { month: 'short', day: 'numeric' };
        dateDisplayBtn.textContent = currentHabitDate.toLocaleDateString('en-US', options);
    }
}

// ==========================================
// CATEGORY LOGIC
// ==========================================
function showHabitCategoryDropdown() {
    if (!habitCategoryInput || !habitCategoryDropdown) return;
    const val = habitCategoryInput.value.toLowerCase().trim();
    
    const filteredCats = savedHabitCategories.filter(c => c.toLowerCase().includes(val));
    if (filteredCats.length === 0) {
        habitCategoryDropdown.classList.remove('show');
        return;
    }
    
    habitCategoryDropdown.innerHTML = filteredCats.map(cat => 
        `<div class="dropdown-item">${cat}</div>`
    ).join('');
    
    habitCategoryDropdown.classList.add('show');
    
    habitCategoryDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            habitCategoryInput.value = item.textContent; 
            habitCategoryDropdown.classList.remove('show');
        });
    });
}

// ==========================================
// RENDER HABITS
// ==========================================
export function renderHabits() {
    if (!habitListContainer) return;
    habitListContainer.innerHTML = '';

    const activeHabits = habits.filter(habit => isHabitActiveOnDate(habit, currentHabitDate));

    if (!activeHabits || activeHabits.length === 0) {
        habitListContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; color: #94a3b8; opacity: 0.7; margin-top: 40px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 50px; height: 50px; margin-bottom: 10px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <p>No habits scheduled for this day.</p>
            </div>
        `;
        return;
    }

    habitListContainer.addEventListener('click', (e) => {
        const habitItem = e.target.closest('.habit-item');
        if (!habitItem) return;

        // If they clicked the actions (Done/Skip/Delete), let the existing logic run.
        if (e.target.closest('.task-actions')) return; 

        // Otherwise, they clicked the card to edit:
        const habitId = parseInt(habitItem.dataset.id);
        const habitToEdit = habits.find(h => h.id === habitId);
        
        if (habitToEdit) {
            // Pre-fill the modal
            document.getElementById('habit-name-input').value = habitToEdit.name;
            // ... (pre-fill your other custom dropdowns and color selectors here based on habitToEdit)
            
            // Show modal
            document.getElementById('habit-modal').classList.add('show');
        }
    });

    const dateStr = currentHabitDate.toISOString().split('T')[0];

    activeHabits.forEach(habit => {
        const currentStreak = calculateStreak(habit);
        const status = habit.logs && habit.logs[dateStr] ? habit.logs[dateStr] : null;

        const habitDiv = document.createElement('div');
        habitDiv.className = 'task-item habit-item';
        habitDiv.dataset.id = habit.id;
        
        if (status === 'done') {
            habitDiv.classList.add('completed');
        } else if (status === 'skipped') {
            habitDiv.style.opacity = '0.5';
        }

        const bgRgba = hexToRgba(habit.color || '#3b82f6', 0.15);
        const iconSvgContent = habitIconsDict[habit.icon] || `<circle cx="12" cy="12" r="10"/>`;

        habitDiv.innerHTML = `
            <div class="habit-icon-circle" style="background: ${bgRgba}; color: ${habit.color};">
                <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvgContent}</svg>
            </div>
            
            <div class="task-info" style="cursor: pointer; flex: 1;">
                <span>${habit.name}</span>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
                    <span class="task-time-badge">${habit.category}</span>
                    <div class="streak-flame ${currentStreak > 0 ? 'active' : ''}" title="Current Streak">
                        <svg class="ui-icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                        <span>${currentStreak}</span>
                    </div>
                </div>
            </div>
            
            <div class="task-actions">
                <button class="remove-btn" title="Delete Habit"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                <button class="focus-btn skip-habit-btn" title="Skip Today"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg></button>
                <button class="done-btn done-habit-btn" title="Done!"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
            </div>
        `;
        
        habitListContainer.appendChild(habitDiv);
    });

    updateHabitProgress();
}

// ==========================================
// EVENTS SETUP
// ==========================================
export function setupHabitsEvents() {
    updateDateDisplayUI();
    // --- DATE NAVIGATION LOGIC ---
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');

    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => {
            const newDate = new Date(currentHabitDate);
            newDate.setDate(newDate.getDate() - 1);
            setCurrentHabitDate(newDate); // Updates the global state
            
            updateDateDisplayUI(); // Updates the text (Yesterday, Jun 4, etc.)
            renderHabits();        // Renders the habits for that specific day
        });
    }

    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => {
            const newDate = new Date(currentHabitDate);
            newDate.setDate(newDate.getDate() + 1);
            setCurrentHabitDate(newDate);
            
            updateDateDisplayUI();
            renderHabits();
        });
    }

    // --- NATIVE DATE PICKER LOGIC ---
    const dateDisplayBtn = document.getElementById('habit-date-display');
    const nativeDatePicker = document.getElementById('native-date-picker');

    // 1. Open Native Picker on Click
    if (dateDisplayBtn && nativeDatePicker) {
        dateDisplayBtn.addEventListener('click', () => {
            try {
                nativeDatePicker.showPicker(); // Works in modern browsers
            } catch (error) {
                nativeDatePicker.click(); // Fallback
            }
        });

        // 2. Handle Date Selection from the Popup
        nativeDatePicker.addEventListener('change', (e) => {
            if (!e.target.value) return;
            
            // value is formatted as "YYYY-MM-DD"
            const [year, month, day] = e.target.value.split('-').map(Number);
            
            // Set global state
            const newDate = new Date(year, month - 1, day);
            newDate.setHours(0, 0, 0, 0);
            setCurrentHabitDate(newDate); // Assuming you imported this from state.js
            
            updateDateDisplayUI();
            renderHabits();
        });
    }

    // Modal Triggers
    if (openAddHabitBtn) {
        openAddHabitBtn.addEventListener('click', () => {
            playUI('click');
            if (habitModal) habitModal.classList.add('show');
            const nameInput = document.getElementById('habit-name-input');
            if (nameInput) nameInput.focus();
        });
    }

    if (closeHabitModalBtn) {
        closeHabitModalBtn.addEventListener('click', () => {
            if (habitModal) habitModal.classList.remove('show');
        });
    }

    if (habitModal) {
        habitModal.addEventListener('click', (e) => {
            if (e.target === habitModal) habitModal.classList.remove('show');
        });
    }

    // Modal Pickers
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            playUI('click');
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });

    iconOptions.forEach(option => {
        option.addEventListener('click', () => {
            playUI('click');
            iconOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });

    // Categories
    if (habitCategoryInput) {
        habitCategoryInput.addEventListener('input', showHabitCategoryDropdown);
        habitCategoryInput.addEventListener('focus', showHabitCategoryDropdown);
    }

    document.addEventListener('click', (e) => {
        if (habitCategoryDropdown && habitCategoryWrapper && !habitCategoryWrapper.contains(e.target)) {
            habitCategoryDropdown.classList.remove('show');
        }
    });

    // --- CUSTOM FREQUENCY DROPDOWN LOGIC ---
    const freqWrapper = document.getElementById('habit-frequency-wrapper');
    const freqInputDisplay = document.getElementById('habit-frequency-input-display');
    const freqValue = document.getElementById('habit-frequency-value');
    const freqDropdown = document.getElementById('habit-frequency-dropdown');
    const customDaysPicker = document.getElementById('custom-days-picker');

    if (freqInputDisplay && freqDropdown) {
        freqInputDisplay.addEventListener('click', () => {
            freqDropdown.classList.toggle('show');
        });

        freqDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const val = item.getAttribute('data-val');
                const text = item.textContent;

                freqInputDisplay.value = text;
                if (freqValue) freqValue.value = val;

                freqDropdown.classList.remove('show');

                if (customDaysPicker) {
                    customDaysPicker.style.display = (val === 'custom') ? 'flex' : 'none';
                }
            });
        });
    }

    document.addEventListener('click', (e) => {
        if (freqWrapper && freqDropdown && !freqWrapper.contains(e.target)) {
            freqDropdown.classList.remove('show');
        }
    });

    // Custom Days Interaction
    dayOptions.forEach(day => {
        day.addEventListener('click', () => {
            playUI('click');
            day.classList.toggle('selected');
        });
    });

    // Save Logic
    if (saveHabitBtn) {
        saveHabitBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('habit-name-input');
            const name = nameInput ? nameInput.value.trim() : '';
            const category = habitCategoryInput ? habitCategoryInput.value.trim() : '';
            const freqValueInput = document.getElementById('habit-frequency-value');
            const frequency = freqValueInput ? freqValueInput.value : 'everyday';
            
            const selectedColor = document.querySelector('.color-option.selected');
            const color = selectedColor ? selectedColor.dataset.color : '#3b82f6';
            
            const selectedIcon = document.querySelector('.icon-option.selected');
            const icon = selectedIcon ? selectedIcon.dataset.icon : 'book';
            
            if (editingHabitId) {
                // Update existing habit
                const habitIndex = habits.findIndex(h => h.id === editingHabitId);
                if (habitIndex > -1) {
                    habits[habitIndex].name = habitName;
                    habits[habitIndex].category = habitCategory;
                    // update other fields...
                }
            } else {
                // Create brand new habit
                const newHabit = {
                    id: Date.now(),
                    name: habitName,
                    category: habitCategory,
                    // populate other fields...
                    createdAt: new Date().toISOString()
                };
                habits.push(newHabit);
            }
        
            localStorage.setItem('focusHabits', JSON.stringify(habits));
            document.getElementById('habit-modal').classList.remove('show');
            renderHabits();
            renderHabitCategories(); // Refresh dynamic category bar

            let customDays = [];
            if (frequency === 'custom') {
                document.querySelectorAll('.day-option.selected').forEach(d => {
                    customDays.push(parseInt(d.dataset.day));
                });
                if (customDays.length === 0) {
                    showToast('Please select at least one day.', 'warning');
                    return;
                }
            }

            if (!name) { 
                showToast('Please enter a habit name', 'warning'); 
                return; 
            }

            const newHabit = {
                id: Date.now(),
                name: habitName,
                category: habitCategory,
                frequency: habitFrequency,
                customDays: customDaysArray,
                color: selectedColor,
                icon: selectedIcon,
                logs: {},
                createdAt: new Date().toISOString()
            };

            habits.push(newHabit);
            
            if (category && !savedHabitCategories.includes(category)) {
                savedHabitCategories.push(category);
                localStorage.setItem('focusHabitCategories', JSON.stringify(savedHabitCategories));
            }

            localStorage.setItem('focusHabits', JSON.stringify(habits));
            
            if (habitModal) habitModal.classList.remove('show');
            if (nameInput) nameInput.value = '';
            if (freqInput) freqInput.value = 'everyday';
            if (customDaysPicker) customDaysPicker.style.display = 'none';
            
            dayOptions.forEach(d => d.classList.remove('selected'));
            
            playUI('success');
            showToast('Habit Created Successfully!', 'success');
            
            renderHabits(); 
        });
    }

    // --- HABIT ACTION BUTTONS (Done, Skip, Delete) ---
    if (habitListContainer) {
        habitListContainer.addEventListener('click', (e) => {
            const habitItem = e.target.closest('.habit-item');
            if (!habitItem) return;

            const habitId = parseInt(habitItem.dataset.id);
            const dateStr = currentHabitDate.toISOString().split('T')[0];
            
            // Done
            if (e.target.closest('.done-habit-btn')) {
                toggleHabitLog(habitId, dateStr, 'done');
                playUI('success');
            } 
            // Skip
            else if (e.target.closest('.skip-habit-btn')) {
                toggleHabitLog(habitId, dateStr, 'skipped');
                playUI('click');
            }
            // Delete
            else if (e.target.closest('.remove-btn')) {
                if(confirm("Are you sure you want to delete this habit permanently?")) {
                    const index = habits.findIndex(h => h.id === habitId);
                    if(index > -1) {
                        habits.splice(index, 1);
                        localStorage.setItem('focusHabits', JSON.stringify(habits));
                        renderHabits();
                    }
                }
            }
        });
    }

    // Initial Display
    updateHabitDateDisplay();
}

export function initHabitQuotes() {
  const habitQuotes = [
      "Small steps every day.",
      "Consistency over intensity.",
      "Your habits define your future.",
      "Focus on the system, not the goal.",
      "Every action is a vote for who you want to be."
  ];

  let currentQuoteIndex = 0;
  const quoteElement = document.getElementById('motivational-quote');

  if (quoteElement) {
      setInterval(() => {
          quoteElement.classList.add('fade-out');
          setTimeout(() => {
              currentQuoteIndex = (currentQuoteIndex + 1) % habitQuotes.length;
              quoteElement.textContent = `"${habitQuotes[currentQuoteIndex]}"`;
              quoteElement.classList.remove('fade-out');
          }, 800); 
      }, 8000); 
  }
}

/**
 * Toggles a habit log for a specific date
 * @param {number} habitId 
 * @param {string} dateKey - Format: 'YYYY-MM-DD'
 * @param {string} status - 'done' or 'skipped'
 */
export function toggleHabitLog(habitId, dateKey, status) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;

  if (habit.logs[dateKey] === status) {
    delete habit.logs[dateKey];
  } else {
    habit.logs[dateKey] = status;
  }

  localStorage.setItem('focusHabits', JSON.stringify(habits));
  renderHabits();
}

export function isHabitActiveOnDate(habit, targetDate) {
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    // Fallback to habit.id if createdAt is missing for older habits
    const creationDate = new Date(habit.createdAt || habit.id);
    creationDate.setHours(0, 0, 0, 0);
    
    // Prevent rendering before the habit was actually created
    if (target < creationDate) return false;

    const dayOfWeek = target.getDay(); 
    const freq = habit.frequency || 'everyday';

    if (freq === 'everyday') return true;
    
    if (freq === 'custom') {
        if (!habit.customDays || habit.customDays.length === 0) return false;
        return habit.customDays.map(Number).includes(dayOfWeek);
    }

    const daysMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
        'thursday': 4, 'friday': 5, 'saturday': 6
    };

    if (daysMap[freq] !== undefined) return daysMap[freq] === dayOfWeek;

    if (freq === 'weekly' || freq === 'biweekly') {
        const createdDay = creationDate.getDay();
        return createdDay === dayOfWeek;
    }

    return true; 
}

export function calculateStreak(habit) {
    let streak = 0;
    let d = new Date();
    d.setHours(0, 0, 0, 0);

    const creationDate = new Date(habit.createdAt || habit.id);
    creationDate.setHours(0, 0, 0, 0);

    while (d >= creationDate) {
        if (isHabitActiveOnDate(habit, d)) {
            const dateKey = d.toISOString().split('T')[0];
            const status = habit.logs && habit.logs[dateKey];
            
            if (status === 'done') {
                streak++;
            } else if (status === 'skipped') {
                // Skip does not break the streak, but adds nothing
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // Break streak if it's past days and not done. Give today a pass.
                if (d.getTime() !== today.getTime()) break;
            }
        }
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

export function updateHabitProgress() {
    const activeHabits = habits.filter(habit => isHabitActiveOnDate(habit, currentHabitDate));
    const total = activeHabits.length;
    let completed = 0;

    const dateStr = currentHabitDate.toISOString().split('T')[0];

    activeHabits.forEach(habit => {
        if (habit.logs && habit.logs[dateStr] === 'done') {
            completed++;
        }
    });

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    // 1. Update the SVG Ring
    const ring = document.querySelector('.overview-ring');
    if (ring) {
        const radius = ring.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (percentage / 100) * circumference;
        
        ring.style.strokeDasharray = `${circumference} ${circumference}`;
        ring.style.strokeDashoffset = offset;
        
        if (percentage === 100 && total > 0) {
            ring.style.stroke = 'var(--success-color)';
        } else {
            ring.style.stroke = ''; 
        }
    }

    // 2. Animate the Percentage Number
    const percentageText = document.querySelector('#habit-overview-dashboard .time-display');
    if (percentageText) {
        const prevVal = parseInt(percentageText.dataset.currentVal || 0);
        
        // Only trigger animation if the value actually changed
        if (prevVal !== percentage) {
            animatePercentage(percentageText, prevVal, percentage, 1200); // 1.2 seconds
            percentageText.dataset.currentVal = percentage; // Save current state for next time
        } else if (percentageText.textContent === '') {
             percentageText.textContent = `${percentage}%`; // Initial load fallback
        }
    }

    // 3. Update the text counters (e.g., "2/4 Completed")
    const statsText = document.querySelector('.dashboard-stats-text strong');
    if (statsText) {
        statsText.textContent = `${completed}/${total} Completed`;
    }
}

export function animatePercentage(element, start, end, duration) {
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        // Calculate progress (0 to 1)
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Ease-Out Quart formula for a smooth slowdown at the end
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const currentVal = Math.floor(easeProgress * (end - start) + start);
        
        element.textContent = `${currentVal}%`;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = `${end}%`; // Lock exactly to the target
            
            // Trigger a success "pop" if they hit 100%
            if (end === 100) {
                element.classList.add('pop-success-anim');
                setTimeout(() => element.classList.remove('pop-success-anim'), 600);
            }
        }
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// Quick Add Logic
// ==========================================
document.getElementById('quick-add-habit-btn').addEventListener('click', () => {
    const input = document.getElementById('quick-habit-input');
    const name = input.value.trim();
    if (!name) return;

    // Random styling generator
    const colors = ['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];
    const icons = ['book', 'activity', 'droplet', 'heart', 'star', 'coffee', 'moon', 'sun', 'monitor', 'music'];
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    const newHabit = {
        id: Date.now(),
        name: name,
        category: 'Uncategorized',
        frequency: 'everyday',
        color: randomColor,
        icon: randomIcon,
        logs: {},
        createdAt: new Date().toISOString()
    };

    habits.push(newHabit);
    localStorage.setItem('focusHabits', JSON.stringify(habits));
    
    input.value = ''; // Clear input
    renderHabits();
    updateHabitProgress();
});

function updateHabitFilterBubble(activeButton) {
    const bubble = document.getElementById('habit-filter-bubble');
    if (!activeButton || !bubble) return;
    
    bubble.style.width = `${activeButton.offsetWidth}px`;
    bubble.style.left = `${activeButton.offsetLeft}px`;
}
// Attach to filter buttons:
document.querySelectorAll('#habit-filter-container .filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('#habit-filter-container .filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        updateHabitFilterBubble(this);
        // Add your filtering logic here
    });
});

export function renderHabitCategories() {
    const filterContainer = document.getElementById('habit-filter-container');
    if (!filterContainer) return;

    // Keep the bubble element, clear the rest
    const bubbleHTML = '<div class="filter-bubble" id="habit-filter-bubble"></div>';
    
    // Extract unique categories
    const uniqueCategories = [...new Set(habits.map(h => h.category || 'Uncategorized'))];
    
    let buttonsHTML = `<button class="filter-btn active" data-filter="all">All</button>`;
    buttonsHTML += `<button class="filter-btn" data-filter="active">Active</button>`;
    buttonsHTML += `<button class="filter-btn" data-filter="done">Done</button>`;
    
    uniqueCategories.forEach(cat => {
        buttonsHTML += `<button class="filter-btn" data-filter="${cat}">${cat}</button>`;
    });

    filterContainer.innerHTML = bubbleHTML + buttonsHTML;

    // Re-attach bubble animation listener
    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const bubble = document.getElementById('habit-filter-bubble');
            if (bubble) {
                bubble.style.width = `${this.offsetWidth}px`;
                bubble.style.left = `${this.offsetLeft}px`;
            }
            
            // Execute filter logic here based on this.dataset.filter
        });
    });
}

renderHabitCategories();