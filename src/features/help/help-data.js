export const helpTopics = [
  {
    id: 'help-getting-started',
    titleKey: 'help_topic_getting_started_title',
    defaultTitle: 'Getting Started',
    icon: 'icon-check-circle',
    open: true,
    points: [
      {
        strongKey: 'help_gs_tabs_strong',
        strongDefault: 'Three Core Views:',
        textKey: 'help_gs_tabs_text',
        textDefault: ' Switch between Pomodoro (timer & daily tasks), Habits (cadence & streaks), and Progress (analytics & heatmaps).'
      },
      {
        strongKey: 'help_gs_privacy_strong',
        strongDefault: '100% Private & Local:',
        textKey: 'help_gs_privacy_text',
        textDefault: ' Everything is saved only inside your browser. No account, no tracking, and no external servers.'
      },
      {
        strongKey: 'help_gs_access_strong',
        strongDefault: 'Quick Assistance:',
        textKey: 'help_gs_access_text',
        textDefault: ' Reopen this guide anytime from Settings → Help & Guide.'
      }
    ]
  },
  {
    id: 'help-pomodoro',
    titleKey: 'help_topic_pomodoro_title',
    defaultTitle: 'Pomodoro Timer',
    icon: 'icon-target',
    open: false,
    points: [
      {
        strongKey: 'help_pomo_workflow_strong',
        strongDefault: 'Interval Flow:',
        textKey: 'help_pomo_workflow_text',
        textDefault: ' Cycles smoothly through Work → Short Break → Long Break with drift-corrected precision.'
      },
      {
        strongKey: 'help_pomo_controls_strong',
        strongDefault: 'Quick Controls:',
        textKey: 'help_pomo_controls_text',
        textDefault: ' Tap Start/Pause or hit Space. Skip advances to the next phase; press and hold Reset for a full session reset.'
      },
      {
        strongKey: 'help_pomo_focus_mode_strong',
        strongDefault: 'Focus Mode:',
        textKey: 'help_pomo_focus_mode_text',
        textDefault: ' Tap the glasses icon for an immersive, distraction-free timer with rotating motivation quotes.'
      },
      {
        strongKey: 'help_pomo_stopwatch_strong',
        strongDefault: 'Stopwatch Mode:',
        textKey: 'help_pomo_stopwatch_text',
        textDefault: ' Switch from Pomodoro to count-up Stopwatch anytime in Settings.'
      }
    ]
  },
  {
    id: 'help-tasks',
    titleKey: 'help_topic_tasks_title',
    defaultTitle: 'Tasks',
    icon: 'icon-tag',
    open: false,
    points: [
      {
        strongKey: 'help_tasks_focus_lock_strong',
        strongDefault: 'Focus Tracking:',
        textKey: 'help_tasks_focus_lock_text',
        textDefault: ' Tap any task to lock it as your active focus; completed session time will be attributed to it.'
      },
      {
        strongKey: 'help_tasks_tags_strong',
        strongDefault: 'Color Tags:',
        textKey: 'help_tasks_tags_text',
        textDefault: ' Assign tags with custom or auto-hashed colors to organize and filter your tasks.'
      },
      {
        strongKey: 'help_tasks_sorting_strong',
        strongDefault: 'Sort & Navigate:',
        textKey: 'help_tasks_sorting_text',
        textDefault: ' Order by Newest, Time Spent, A-Z, or Tag. Use the date arrows to review past days or plan ahead.'
      }
    ]
  },
  {
    id: 'help-habits',
    titleKey: 'help_topic_habits_title',
    defaultTitle: 'Habits',
    icon: 'icon-calendar',
    open: false,
    points: [
      {
        strongKey: 'help_habits_cadence_strong',
        strongDefault: 'Flexible Cadence:',
        textKey: 'help_habits_cadence_text',
        textDefault: ' Schedule habits Daily, Weekly, Bi-weekly, or on Custom Day combinations (e.g. Sat + Mon every 2 weeks).'
      },
      {
        strongKey: 'help_habits_streaks_strong',
        strongDefault: 'Streak Tracking:',
        textKey: 'help_habits_streaks_text',
        textDefault: ' Mark habits done to build streaks. Skipping a day preserves your momentum without breaking your streak.'
      },
      {
        strongKey: 'help_habits_customization_strong',
        strongDefault: 'Icons & Categories:',
        textKey: 'help_habits_customization_text',
        textDefault: ' Choose from 38 custom icons and color-coded categories to group your habits.'
      }
    ]
  },
  {
    id: 'help-progress',
    titleKey: 'help_topic_progress_title',
    defaultTitle: 'Progress Dashboard',
    icon: 'icon-trending-up',
    open: false,
    points: [
      {
        strongKey: 'help_prog_heatmaps_strong',
        strongDefault: 'Activity Heatmaps:',
        textKey: 'help_prog_heatmaps_text',
        textDefault: ' View calendar heatmaps for both Pomodoro focus sessions and habit consistency over Daily, Weekly, Monthly, or Custom ranges.'
      },
      {
        strongKey: 'help_prog_reports_strong',
        strongDefault: 'Daily Breakdown:',
        textKey: 'help_prog_reports_text',
        textDefault: ' Tap any heatmap tile to open the full Daily Report for that day and convert untracked focus time into tasks.'
      },
      {
        strongKey: 'help_prog_stats_strong',
        strongDefault: 'Consistency Metrics:',
        textKey: 'help_prog_stats_text',
        textDefault: ' Monitor Total Focus Time, Items Completed, Perfect Days, and week-over-week deltas.'
      }
    ]
  },
  {
    id: 'help-data',
    titleKey: 'help_topic_data_title',
    defaultTitle: 'Data, Backup & Trash',
    icon: 'icon-trash',
    open: false,
    points: [
      {
        strongKey: 'help_data_backup_strong',
        strongDefault: 'Backup & Restore:',
        textKey: 'help_data_backup_text',
        textDefault: ' Export a complete JSON backup in Settings to save your data or transfer it to another browser.'
      },
      {
        strongKey: 'help_data_trash_strong',
        strongDefault: 'Trash & Recovery:',
        textKey: 'help_data_trash_text',
        textDefault: ' Deleted tasks, habits, tags, categories, and quotes go to Trash first, where they can be restored or permanently emptied.'
      }
    ]
  },
  {
    id: 'help-tips',
    titleKey: 'help_topic_tips_title',
    defaultTitle: 'Shortcuts & Tips',
    icon: 'icon-info-circle',
    open: false,
    points: [
      {
        strongKey: 'help_tips_space_strong',
        strongDefault: 'Spacebar:',
        textKey: 'help_tips_space_text',
        textDefault: ' Toggle the timer Start / Pause from anywhere when not typing in a text field.'
      },
      {
        strongKey: 'help_tips_esc_strong',
        strongDefault: 'Escape:',
        textKey: 'help_tips_esc_text',
        textDefault: ' Close the topmost open modal, or exit Focus Mode if no dialog is active.'
      },
      {
        strongKey: 'help_tips_reset_strong',
        strongDefault: 'Long Press Reset:',
        textKey: 'help_tips_reset_text',
        textDefault: ' Press and hold or double-click the Reset button for a full session reset.'
      }
    ]
  }
];
