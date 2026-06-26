import { 
  habits, savedHabitCategories, currentHabitDate,
  setCurrentHabitDate 
} from './state.js';

import { playUI } from './audio.js';
import { showToast } from './ui-utils.js';
import { customConfirm } from './tasks.js';

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
let currentHabitSort = 'newest';
let habitSortOrder = 'desc';
export let currentHabitFilter = 'all';

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
    
    // Ignore empty and Uncategorized
    const validCats = savedHabitCategories.filter(c => c && c.trim() !== '' && c !== 'Uncategorized');
    const filteredCats = validCats.filter(c => c.toLowerCase().includes(val));
    
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
    const dateStr = currentHabitDate.toISOString().split('T')[0];

    // Safely Apply Filtering
    let filteredHabits = activeHabits.filter(h => {
        const status = (h.logs && h.logs[dateStr]) ? h.logs[dateStr] : null;
        if (currentHabitFilter === 'active') return status !== 'done' && status !== 'skipped';
        if (currentHabitFilter === 'done') return status === 'done';
        if (currentHabitFilter !== 'all') return h.category === currentHabitFilter;
        return true; 
    });

    // Safely Apply Sorting (Done/Skipped automatically sink to the bottom)
    filteredHabits.sort((a, b) => {
        const statusA = (a.logs && a.logs[dateStr]) ? a.logs[dateStr] : null;
        const statusB = (b.logs && b.logs[dateStr]) ? b.logs[dateStr] : null;
        const isCompletedA = (statusA === 'done' || statusA === 'skipped');
        const isCompletedB = (statusB === 'done' || statusB === 'skipped');

        // 1. Primary Sort: Sink completed to bottom
        if (isCompletedA !== isCompletedB) return isCompletedA ? 1 : -1;

        // 2. Secondary Sort: User's chosen order
        let val = 0;
        if (currentHabitSort === 'newest') val = new Date(a.createdAt || a.id).getTime() - new Date(b.createdAt || b.id).getTime();
        else if (currentHabitSort === 'az') val = a.name.localeCompare(b.name);
        else if (currentHabitSort === 'category') val = (a.category || '').localeCompare(b.category || '');
        else if (currentHabitSort === 'streak') val = calculateStreak(a) - calculateStreak(b);

        return habitSortOrder === 'asc' ? val : -val;
    });

    if (!filteredHabits || filteredHabits.length === 0) {
        habitListContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; color: #94a3b8; opacity: 0.7; margin-top: 40px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 50px; height: 50px; margin-bottom: 10px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <p>No habits scheduled for this day.</p>
            </div>
        `;
        return;
    }

    // Habit Item Click (to Edit)
    habitListContainer.addEventListener('click', (e) => {
        const habitItem = e.target.closest('.habit-item');
        if (!habitItem) return;

        // If they clicked the actions (Done/Skip/Delete), let the existing logic run.
        if (e.target.closest('.task-actions')) return; 

        // Otherwise, they clicked the card to edit:
        const habitId = parseInt(habitItem.dataset.id);
        const habitToEdit = habits.find(h => h.id === habitId);
        
        if (habitToEdit) {
            editingHabitId = habitId;
            document.getElementById('habit-modal-title').innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Edit Habit';
            
            document.getElementById('habit-name-input').value = habitToEdit.name || '';
            document.getElementById('habit-category-input').value = habitToEdit.category || '';
            
            const fVal = habitToEdit.frequency || 'everyday';
            document.getElementById('habit-frequency-value').value = fVal;
            const displayMap = { 'everyday':'Every Day', 'weekly':'Once a Week', 'custom':'Custom Days...' };
            document.getElementById('habit-frequency-input-display').value = displayMap[fVal] || fVal;
            
            colorOptions.forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.color === habitToEdit.color) opt.classList.add('selected');
            });
            iconOptions.forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.icon === habitToEdit.icon) opt.classList.add('selected');
            });

            if (fVal === 'custom') {
                document.getElementById('custom-days-picker').style.display = 'flex';
                dayOptions.forEach(d => {
                    d.classList.remove('selected');
                    if (habitToEdit.customDays && habitToEdit.customDays.includes(parseInt(d.dataset.day))) d.classList.add('selected');
                });
            } else {
                document.getElementById('custom-days-picker').style.display = 'none';
            }

            document.getElementById('habit-modal').classList.add('show');
        }
    });

    filteredHabits.forEach(habit => {
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
            editingHabitId = null; // CRITICAL: Tells the form we are creating, not editing
            document.getElementById('habit-modal-title').innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Create Habit';
            
            // Sync Quick Input to Modal
            const quickInput = document.getElementById('quick-habit-input');
            const nameInput = document.getElementById('habit-name-input');
            if (nameInput) {
                nameInput.value = quickInput ? quickInput.value.trim() : '';
            }
            if (habitCategoryInput) habitCategoryInput.value = '';
            
            // Reset frequency to default (Every Day)
            const freqInputDisplay = document.getElementById('habit-frequency-input-display');
            if (freqInputDisplay) freqInputDisplay.value = 'Every Day';
            
            // Set hidden frequency value to "everyday" for form submission
            const freqValue = document.getElementById('habit-frequency-value');
            if (freqValue) freqValue.value = 'everyday';
            
            // Reset color and icon selections
            if (customDaysPicker) customDaysPicker.style.display = 'none';
            dayOptions.forEach(d => d.classList.remove('selected'));

            // Default color is the first option
            if (habitModal) habitModal.classList.add('show');
            if (nameInput) setTimeout(() => nameInput.focus(), 100);
        });
    }

    if (closeHabitModalBtn) {
        closeHabitModalBtn.addEventListener('click', () => {
            if (habitModal) habitModal.classList.remove('show');

            // If we were creating a new habit (not editing), sync the name back to the quick input
            if (!editingHabitId) {
                const nameInput = document.getElementById('habit-name-input');
                const quickInput = document.getElementById('quick-habit-input');
                if (nameInput && quickInput) {
                    quickInput.value = nameInput.value.trim();
                }
            }
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

    // Categories Auto-Clear & Dropdown
    if (habitCategoryInput) {
        habitCategoryInput.addEventListener('input', showHabitCategoryDropdown);
        habitCategoryInput.addEventListener('focus', function() {
            if (this.value === 'Uncategorized') this.value = ''; // Clear default easily
            showHabitCategoryDropdown();
        });
    }

    // Close category dropdown if clicking outside
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
            let categoryRaw = habitCategoryInput ? habitCategoryInput.value.trim() : '';
            const category = categoryRaw === '' ? 'Uncategorized' : categoryRaw;
            const freqValueInput = document.getElementById('habit-frequency-value');
            const frequency = freqValueInput ? freqValueInput.value : 'everyday';
            
            const selectedColor = document.querySelector('.color-option.selected');
            const color = selectedColor ? selectedColor.dataset.color : '#3b82f6';
            
            const selectedIcon = document.querySelector('.icon-option.selected');
            const icon = selectedIcon ? selectedIcon.dataset.icon : 'book';

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
            
            if (editingHabitId) {
                // Update existing habit
                const habitIndex = habits.findIndex(h => h.id === editingHabitId);
                if (habitIndex > -1) {
                    habits[habitIndex].name = name;
                    habits[habitIndex].category = category;
                    habits[habitIndex].frequency = frequency;
                    habits[habitIndex].color = color;
                    habits[habitIndex].icon = icon;
                    if (frequency === 'custom') habits[habitIndex].customDays = customDays;
                }
            } else {
                // Create brand new habit
                const newHabit = {
                    id: Date.now(),
                    name: name,
                    category: category,
                    frequency: frequency,
                    customDays: frequency === 'custom' ? customDays : [],
                    color: color,
                    icon: icon,
                    logs: {},
                    // Setting createdAt slightly in the past allows immediate scheduling
                    createdAt: new Date(new Date().setHours(0,0,0,0)).toISOString()
                };
                habits.push(newHabit);
                
                if (category && category.trim() !== '' && category !== 'Uncategorized' && !savedHabitCategories.includes(category)) {
                    savedHabitCategories.push(category);
                    localStorage.setItem('focusHabitCategories', JSON.stringify(savedHabitCategories));
                }
            }
        
            localStorage.setItem('focusHabits', JSON.stringify(habits));
            
            if (habitModal) habitModal.classList.remove('show');
            playUI('success');
            showToast(editingHabitId ? 'Habit Updated!' : 'Habit Created!', 'success');
            
            renderHabits();
            if (typeof renderHabitCategories === 'function') renderHabitCategories(); 
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
                customConfirm("Are you sure you want to delete this habit permanently?", () => {
                    const index = habits.findIndex(h => h.id === habitId);
                    if(index > -1) {
                        habits.splice(index, 1);
                        localStorage.setItem('focusHabits', JSON.stringify(habits));
                        renderHabits();
                        if (typeof renderHabitCategories === 'function') renderHabitCategories();
                    }
                });
            }
        });
    }

    // Wire top-left gear to the main Settings Modal
    const habitSettingsBtn = document.querySelector('.habit-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    if (habitSettingsBtn && settingsModal) {
        habitSettingsBtn.addEventListener('click', () => {
            playUI('click');
            // BUG FIX: Revert unsaved changes when opening from Habits!
            document.dispatchEvent(new Event('reloadSettingsUI')); 
            settingsModal.classList.add('show');
        });
    }

    // --- HABIT SORT BUTTON LOGIC ---
    const habitSortBtn = document.getElementById('habit-sort-btn');
    const habitSortDropdown = document.getElementById('habit-sort-dropdown');
    
    if (habitSortBtn && habitSortDropdown) {
        habitSortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            habitSortDropdown.style.display = habitSortDropdown.style.display === 'block' ? 'none' : 'block';
        });

        habitSortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const clickedSort = item.getAttribute('data-sort');
                if (currentHabitSort === clickedSort) {
                    habitSortOrder = habitSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    currentHabitSort = clickedSort;
                    habitSortOrder = (clickedSort === 'az' || clickedSort === 'category') ? 'asc' : 'desc';
                }
                
                habitSortDropdown.querySelectorAll('.dropdown-item').forEach(i => {
                    i.classList.remove('active-sort');
                    i.querySelector('.sort-dir').textContent = ''; 
                });
                
                item.classList.add('active-sort');
                item.querySelector('.sort-dir').textContent = habitSortOrder === 'asc' ? '↑' : '↓';
                
                playUI('click');
                habitSortDropdown.style.display = 'none';
                renderHabits();
            });
        });

        document.addEventListener('click', (e) => {
            if (!habitSortBtn.contains(e.target) && !habitSortDropdown.contains(e.target)) {
                habitSortDropdown.style.display = 'none';
            }
        });
    }

    // --- CATEGORY MANAGEMENT LOGIC ---
    const manageCategoriesBtn = document.getElementById('manage-categories-btn');
    const categoriesModal = document.getElementById('categories-modal');
    const closeCategoriesModal = document.getElementById('close-categories-modal');
    const manageAddCategoryBtn = document.getElementById('manage-add-category-btn');
    const manageNewCategoryInput = document.getElementById('manage-new-category-input');
    const categoriesManagementList = document.getElementById('categories-management-list');

    function renderCategoriesManagement() {
        if (!categoriesManagementList) return;
        categoriesManagementList.innerHTML = '';
        
        // Filter out empty strings and the default category
        const validCategories = savedHabitCategories.filter(cat => cat && cat.trim() !== '' && cat !== 'Uncategorized');
        
        validCategories.forEach(cat => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip deletable'; 
            chip.textContent = cat;
            
            chip.addEventListener('click', () => {
                // Call the statically imported modal
                customConfirm(`Delete category "${cat}"?`, () => {
                    // SECURE FIX: Mutate array using splice, do NOT reassign
                    const targetIndex = savedHabitCategories.indexOf(cat);
                    if (targetIndex > -1) {
                        savedHabitCategories.splice(targetIndex, 1);
                    }
                    
                    // Move habits to Uncategorized if their category is deleted
                    habits.forEach(h => { if (h.category === cat) h.category = 'Uncategorized'; });
                    
                    localStorage.setItem('focusHabitCategories', JSON.stringify(savedHabitCategories));
                    localStorage.setItem('focusHabits', JSON.stringify(habits));
                    
                    if (currentHabitFilter === cat) currentHabitFilter = 'all';
                    
                    renderCategoriesManagement();
                    renderHabitCategories();
                    renderHabits();
                });
            });
            categoriesManagementList.appendChild(chip);
        });
    }

    if (manageCategoriesBtn && categoriesModal) {
        manageCategoriesBtn.addEventListener('click', () => {
            playUI('click');
            renderCategoriesManagement();
            categoriesModal.classList.add('show');
        });
    }

    if (closeCategoriesModal) closeCategoriesModal.addEventListener('click', () => categoriesModal.classList.remove('show'));

    if (manageAddCategoryBtn) {
        manageAddCategoryBtn.addEventListener('click', () => {
            if (!manageNewCategoryInput) return;
            const newCat = manageNewCategoryInput.value.trim();
            
            // Empty Warning
            if (!newCat) {
                showToast('Please enter a valid category name.', 'warning');
                return;
            }

            if (newCat && !savedHabitCategories.includes(newCat)) {
                savedHabitCategories.push(newCat);
                localStorage.setItem('focusHabitCategories', JSON.stringify(savedHabitCategories));
                manageNewCategoryInput.value = '';
                renderCategoriesManagement();
                renderHabitCategories(); 
                showToast(`Category added`, 'success');
            }
        });
    }

    // Allow 'Enter' key to add categories (FAIL-SAFE VERSION)
    const catInput = document.getElementById('manage-new-category-input');
    const catBtn = document.getElementById('manage-add-category-btn');
    if (catInput && catBtn) {
        catInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                catBtn.click();
            }
        });
    }

    // Allow 'Enter' key to save the main habit modal (FAIL-SAFE VERSION)
    const hInput = document.getElementById('habit-name-input');
    const hSaveBtn = document.getElementById('save-habit-btn');
    if (hInput && hSaveBtn) {
        hInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                hSaveBtn.click();
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

// ==========================================
// HABIT SCHEDULING LOGIC
// ==========================================
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

// ==========================================
// STREAK CALCULATION FUNCTION
// ==========================================
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

// ==========================================
// PROGRESS UPDATE FUNCTION
// ==========================================
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

    // 2. Animate the Percentage Number (Bulletproof Version)
    const percentageText = document.querySelector('#habit-detail-panel .time-display');
    if (percentageText) {
        const prevVal = parseInt(percentageText.dataset.currentVal || 0);
        // CRITICAL: Update the target immediately so rapid clicks don't break the tracking
        percentageText.dataset.currentVal = percentage; 
        
        if (prevVal !== percentage) {
            animatePercentage(percentageText, prevVal, percentage, 800); // Faster, smoother duration
        } else if (percentageText.textContent === '') {
            percentageText.textContent = `${percentage}%`;
        }
    }

    // 3. Update the text counters (e.g., "2/4 Completed")
    const statsText = document.querySelector('.dashboard-stats-text strong');
    if (statsText) {
        statsText.textContent = `${completed}/${total} Completed`;
    }

    // Update streaks UI
    if (typeof renderTopStreaks === 'function') renderTopStreaks();
}

// ==========================================
// ANIMATION FUNCTION
// ==========================================
export function animatePercentage(element, start, end, duration) {
    // BUG FIX: Cancel previous animation loop if user clicks quickly
    if (element.animationId) {
        window.cancelAnimationFrame(element.animationId);
    }
    
    // Snap immediately if there's no change needed
    if (start === end) {
        element.textContent = `${end}%`;
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Smooth easing curve
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const currentVal = Math.floor(easeProgress * (end - start) + start);
        
        element.textContent = `${currentVal}%`;
        
        if (progress < 1) {
            element.animationId = window.requestAnimationFrame(step);
        } else {
            element.textContent = `${end}%`; 
            if (end === 100) {
                element.classList.add('pop-success-anim');
                setTimeout(() => element.classList.remove('pop-success-anim'), 600);
            }
        }
    };
    element.animationId = window.requestAnimationFrame(step);
}

// ==========================================
// Quick Add Logic
// ==========================================
function processQuickAddHabit() {
    const input = document.getElementById('quick-habit-input');
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
        id: Date.now(),
        name: name,
        category: 'Uncategorized',
        frequency: 'everyday',
        color: randomColor, 
        icon: randomIcon, 
        logs: {},
        createdAt: new Date(new Date().setHours(0,0,0,0)).toISOString()
    };

    habits.push(newHabit);
    localStorage.setItem('focusHabits', JSON.stringify(habits));
    
    input.value = ''; 
    renderHabits();
    if (typeof renderHabitCategories === 'function') renderHabitCategories(); 
}

const quickAddBtn = document.getElementById('quick-add-habit-btn');
const quickHabitInput = document.getElementById('quick-habit-input');

if (quickAddBtn) quickAddBtn.addEventListener('click', processQuickAddHabit);

if (quickHabitInput) {
    quickHabitInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            processQuickAddHabit();
        }
    });
}

// ==========================================
// Habit Filter Bubble Logic
// ==========================================
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

    // Maintain current active filter state, default to 'all'
    const currentFilter = filterContainer.querySelector('.filter-btn.active')?.dataset.filter || 'all';

    const bubbleHTML = '<div class="filter-bubble" id="habit-filter-bubble"></div>';
    const usedCats = habits.map(h => h.category || 'Uncategorized');
    const uniqueCategories = [...new Set([...savedHabitCategories, ...usedCats])].filter(cat => cat && cat.trim() !== '');
    
    let buttonsHTML = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>`;
    buttonsHTML += `<button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>`;
    buttonsHTML += `<button class="filter-btn ${currentFilter === 'done' ? 'active' : ''}" data-filter="done">Done</button>`;
    
    uniqueCategories.forEach(cat => {
        buttonsHTML += `<button class="filter-btn ${currentFilter === cat ? 'active' : ''}" data-filter="${cat}">${cat}</button>`;
    });

    filterContainer.innerHTML = bubbleHTML + buttonsHTML;

    // Attach click listeners and auto-scroll
    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const bubble = document.getElementById('habit-filter-bubble');
            if (bubble) {
                bubble.style.width = `${this.offsetWidth}px`;
                bubble.style.left = `${this.offsetLeft}px`;
            }
            
            // Auto-scroll the container to keep the active item in view
            this.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            
            // NOTE: Add your habit filtering logic here based on this.dataset.filter later!
            currentHabitFilter = this.dataset.filter;
            renderHabits();
        });
    });

    // Initialize Bubble position seamlessly
    setTimeout(() => {
        const activeBtn = filterContainer.querySelector('.filter-btn.active');
        const bubble = document.getElementById('habit-filter-bubble');
        if (activeBtn && bubble) {
            bubble.style.transition = 'none'; // Turn off animation
            bubble.style.width = `${activeBtn.offsetWidth}px`;
            bubble.style.left = `${activeBtn.offsetLeft}px`;
            void bubble.offsetWidth; // Force CSS refresh
            bubble.style.transition = ''; // Turn animation back on
            activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        }
    }, 50);
}

renderHabitCategories();

// Recalculate bubble position when switching to the Habits tab
document.addEventListener('habitsTabOpened', () => {
    const filterContainer = document.getElementById('habit-filter-container');
    if (!filterContainer) return;
    const activeBtn = filterContainer.querySelector('.filter-btn.active');
    const bubble = document.getElementById('habit-filter-bubble');
    
    if (activeBtn && bubble) {
        bubble.style.transition = 'none';
        bubble.style.width = `${activeBtn.offsetWidth}px`;
        bubble.style.left = `${activeBtn.offsetLeft}px`;
        void bubble.offsetWidth; // force css refresh
        bubble.style.transition = '';
    }
});

// --- TOP STREAKS & DEEP LINKING EXPORT ---
export function setHabitDate(dateObj) {
    const newDate = new Date(dateObj);
    newDate.setHours(0,0,0,0);
    
    // BUG FIX: We MUST use the setter function from state.js!
    setCurrentHabitDate(newDate); 
    
    const display = document.getElementById('habit-date-display');
    if (display) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((newDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) display.textContent = 'Today';
        else if (diffDays === -1) display.textContent = 'Yesterday';
        else if (diffDays === 1) display.textContent = 'Tomorrow';
        else display.textContent = newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    renderHabits();
    if (typeof updateDailyOverview === 'function') updateDailyOverview();
}

export function renderTopStreaks() {
    const list = document.getElementById('top-streaks-list');
    if (!list) return;

    const habitsWithStreaks = habits.map(h => ({ ...h, currentStreak: typeof calculateStreak === 'function' ? calculateStreak(h) : 0 }));
    habitsWithStreaks.sort((a, b) => b.currentStreak - a.currentStreak);
    
    // Grab top 3
    const top3 = habitsWithStreaks.filter(h => h.currentStreak > 0).slice(0, 3);

    list.innerHTML = '';
    
    // ALWAYS render 3 slots to permanently lock the layout height
    for (let i = 0; i < 3; i++) {
        const pill = document.createElement('div');
        pill.className = 'stat-row'; 
        pill.style.padding = '8px 15px';
        pill.style.height = '48px'; // Lock the height of the pill
        
        if (top3[i]) {
            const h = top3[i];
            pill.innerHTML = `
                <div class="stat-icon" style="color: ${h.color || '#10b981'}; background: ${h.color ? h.color+'20' : 'rgba(16,185,129,0.15)'}; width: 32px; height: 32px;">
                    <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${habitIconsDict[h.icon] || habitIconsDict['activity']}</svg>
                </div>
                <div class="stat-details" style="flex: 1; min-width: 0;">
                    <span class="stat-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; color: var(--text-main);">${h.name}</span>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="stat-value" style="font-size: 0.95rem; color: #f97316;">${h.currentStreak} 🔥</span>
                    </div>
                </div>
            `;
        } else {
            // Empty transparent placeholder
            pill.style.background = 'transparent';
            pill.style.border = '1px dashed var(--glass-border)';
            pill.style.opacity = '0.5';
            pill.innerHTML = `
                <div class="stat-icon" style="background: transparent; width: 32px; height: 32px;"></div>
                <div class="stat-details" style="flex: 1;">
                    <span class="stat-label" style="color: var(--text-muted);">Empty</span>
                </div>
            `;
        }
        list.appendChild(pill);
    }
}