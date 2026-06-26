import { setupTabs } from './js/ui-utils.js';
import { loadSettings, setupSettingsEvents, applySettingsToTimer } from './js/settings.js';
import { loadTimerState, updatePhaseColors, toggleTimer, setupTimerEvents } from './js/timer.js';
import { renderFilters, renderTasks, initConfirmModal, setupTaskEvents } from './js/tasks.js';
import { renderHabits, setupHabitsEvents, initHabitQuotes } from './js/habits.js';
import { renderProgressDashboard, setupProgressEvents } from './js/progress.js';

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
    setupProgressEvents();
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
        
        // Space key to toggle timer
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

// Global Input Sanitizer (No symbols allowed)
document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        // Save cursor position so typing in the middle of a word doesn't jump to the end
        const cursorPosition = e.target.selectionStart;
        // Old: e.target.value = e.target.value.replace(/[^\p{L}\p{N}\s]/gu, '');
        // New: Allow letters, numbers, spaces, and basic punctuation
        e.target.value = e.target.value.replace(/[^\p{L}\p{N}\s.,!#()\-]/gu, '');
        e.target.setSelectionRange(cursorPosition, cursorPosition);
    }
});

// --- GLOBAL EVENT DISPATCHER ---
// Captures clicks on any interactive button and triggers a global sync
document.addEventListener('click', (e) => {
    // If the user completes a habit or task, tell the Progress tab to update
    if (e.target.closest('.done-btn') || e.target.closest('.habit-item') || e.target.closest('.task-item')) {
        setTimeout(() => {
            document.dispatchEvent(new Event('dataUpdated'));
        }, 100); // 100ms delay ensures localStorage saves first
    }
});