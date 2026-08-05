# FocusApp

A Pomodoro timer, task manager, and habit tracker with focus sessions, streaks, heatmaps, and data export. All data stored locally in your browser — no account required, no server, no tracking.

## Features

### Pomodoro Timer
- Work / Short Break / Long Break / Stopwatch modes
- Drift-corrected timer (uses `Date.now()` anchors, not naive `setInterval` subtraction)
- Auto-focus: assigns the timer to your lone active task automatically
- Per-phase theming (colors, backgrounds adapt to Work/Break/Long Break)
- Deep reset via press-and-hold on the reset button

### Task Manager
- Add, complete, delete, edit tasks
- Tag tasks with auto-colored chips (deterministic hash → same tag = same color)
- Filter by status (All / Active / Completed) and by tag
- Sort by newest, oldest, time spent, alphabetical
- Per-task time tracking with live badge updates during Pomodoro

### Habit Tracker
- Create habits with flexible recurrence (daily, custom weekdays, weekly, biweekly)
- Streak calculation that respects skip days and "today not logged yet"
- Calendar heatmap with multi-year history
- Color-coded categories per habit

### Progress Dashboard
- Side-by-side heatmaps for Pomodoro focus time and habit consistency
- Custom date ranges (7d / 30d / 90d / custom)
- Statistics cards (total focus time, completed tasks, active streaks)
- Delta badges showing week-over-week change

### Data Portability
- Full JSON export/import with versioned schema (`_focusAppExport` marker, `exportedAt` timestamp)
- Validates payload shape on import — rejects corrupted/wrong-shaped files gracefully
- Single-file backup works across browsers and devices

### Theming & Accessibility
- Light/dark mode (persisted)
- Respects `prefers-reduced-motion`
- Full keyboard navigation: all dropdowns, modals, and cards are keyboard-operable
- ARIA labels, roles, and live regions for screen readers
- Focus trapping in modals with focus restoration on close

## Quick Start

```bash
# Install dev dependencies (for linting)
npm install

# Run locally (serves index.html on http://localhost:5173)
npm start

# Lint JavaScript
npm run lint
```

Or simply open `index.html` directly in a browser — no build step required.

## Project Structure

```
FocusApp/
├── index.html          # Single-page app markup (752 lines)
├── manifest.json       # PWA manifest
├── package.json        # Dev tooling config
├── .eslintrc.json      # ESLint config
├── .gitignore
├── css/
│   ├── variables.css   # CSS custom properties (themes, phases)
│   ├── reset.css       # Base reset + prefers-reduced-motion
│   ├── components.css  # Buttons, inputs, modals, dropdowns, toasts
│   ├── layout.css      # Grid, tabs, bubbles, containers
│   ├── pomodoro.css    # Timer ring, session tracker, task items
│   ├── habits.css      # Habit cards, streaks, dashboard, date pickers
│   └── progress.css    # Heatmaps, legends, delta badges
├── js/
│   ├── script.js       # App bootstrap, global listeners
│   ├── state.js        # Global mutable state + setters (ESM live bindings)
│   ├── storage.js      # localStorage wrapper with try/catch + JSON safety
│   ├── date-utils.js   # Shared YYYY-MM-DD local date key
│   ├── audio.js        # Procedural Web Audio synthesis (click, success, alarm)
│   ├── ui-utils.js     # escapeHTML, icons, toasts, tabs, modals, dropdowns, confirm
│   ├── settings.js     # Settings modal, export/import, apply to timer
│   ├── timer.js        # Drift-corrected Pomodoro engine
│   ├── tasks.js        # Task CRUD, filtering, sorting, tagging
│   ├── habits.js       # Habit CRUD, recurrence, streaks, heatmaps
│   └── progress.js     # Dashboard rendering, stats, custom ranges
└── Stopwatch.png       # App icon
```

## Architecture Notes

- **ES Modules** throughout (`<script type="module" src="script.js">`)
- **Feature-based modules** — no circular imports, clean DAG
- **Centralized storage** — all `localStorage` access via `storage.js` with defensive parsing
- **Shared utilities** — `ui-utils.js` owns modals, dropdowns, toasts, tabs, icons
- **No runtime dependencies** — zero CDN scripts, no external fonts, fully self-contained
- **Sprite-based icons** — gear and close icons defined once as `<symbol>`, referenced via `<use>`

## Development

```bash
# Install linting tools
npm install

# Run linter
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

### ESLint Config
- Targets ES2022 modules
- Browser globals declared
- Rules: `eqeqeq`, `curly`, `no-var`, `prefer-const`, `no-duplicate-imports`

## Browser Support

Modern evergreen browsers (Chrome 111+, Firefox 113+, Safari 16.4+, Edge 111+). Uses:
- ES Modules
- CSS Custom Properties
- `color-mix()` (with fallback)
- `crypto.randomUUID()` (with fallback)
- `AudioContext` / `webkitAudioContext`
- `requestAnimationFrame`
- `MutationObserver`
- `Blob` / `URL.createObjectURL`

## Data Storage

All data lives in `localStorage` under keys prefixed with `focus`:
- `focusTasks`, `focusedTaskId`, `focusTagsList`, `focusTagColors`
- `focusHabits`, `focusHabitCategories`
- `focusSettings`, `focusTimerState`

No data ever leaves your browser.

## License

MIT