import { setupTabs } from './js/ui-utils.js';
import { loadSettings, setupSettingsEvents, applySettingsToTimer } from './js/settings.js';
import { loadTimerState, updatePhaseColors, toggleTimer, setupTimerEvents } from './js/timer.js';
import { renderFilters, renderTasks, initConfirmModal, setupTaskEvents } from './js/tasks.js';
import { renderHabits, setupHabitsEvents, initHabitQuotes } from './js/habits.js';

window.addEventListener('DOMContentLoaded', () => {
    // 1. Settings Initialization
    loadSettings();
    setupSettingsEvents();
    
    // 2. Timer Initialization
    const hasSavedTimer = loadTimerState();
    if (!hasSavedTimer) applySettingsToTimer();
    setupTimerEvents();

    // 3. Tasks Initialization
    initConfirmModal();
    setupTaskEvents();
    renderFilters();
    renderTasks();
    
    // 4. Habits Initialization
    setupHabitsEvents();
    renderHabits();
    if (typeof initHabitQuotes === 'function') initHabitQuotes();

    // 5. UI & Navigation
    setupTabs();
    setupGlobalShortcuts();
});

// Inter-module event listener for updating background themes
document.addEventListener('updateColors', () => {
    updatePhaseColors();
});

// Global Keyboard Shortcuts
function setupGlobalShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Prevent triggering shortcuts when typing in inputs
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        // Spacebar to toggle timer
        if (event.code === 'Space') { 
            event.preventDefault(); 
            toggleTimer(); 
        }
        
        // Escape to close any open modals
        if (event.code === 'Escape') {
            const modalIds = ['settings-modal', 'tags-modal', 'habit-modal', 'edit-tag-modal'];
            modalIds.forEach(id => {
                const modal = document.getElementById(id);
                if (modal && modal.classList.contains('show')) {
                    modal.classList.remove('show');
                }
            });
        }
    });
}