import test from 'node:test';
import assert from 'node:assert/strict';
import './env.js';
import { readJSON, writeJSON, STORAGE_KEYS } from '../src/core/storage.js';
import { saveProgressViewPrefs } from '../src/features/progress/progress.js';
import { saveTaskViewPrefs } from '../src/features/tasks/tasks-storage.js';
import { saveHabitViewPrefs } from '../src/features/habits/habits-storage.js';

test('view-persistence: saveTaskViewPrefs stores task filter and sort settings', () => {
  saveTaskViewPrefs();
  const saved = readJSON(STORAGE_KEYS.TASK_VIEW_PREFS, null);
  assert.ok(saved);
  assert.ok('filter' in saved);
  assert.ok('sort' in saved);
  assert.ok('sortOrder' in saved);
});

test('view-persistence: saveHabitViewPrefs stores habit filter and sort settings', () => {
  saveHabitViewPrefs();
  const saved = readJSON(STORAGE_KEYS.HABIT_VIEW_PREFS, null);
  assert.ok(saved);
  assert.ok('filter' in saved);
  assert.ok('sort' in saved);
  assert.ok('sortOrder' in saved);
});

test('view-persistence: saveProgressViewPrefs stores progress range and toggles', () => {
  saveProgressViewPrefs();
  const saved = readJSON(STORAGE_KEYS.PROGRESS_VIEW_PREFS, null);
  assert.ok(saved);
  assert.ok('timeRange' in saved);
  assert.ok('showPomodoro' in saved);
  assert.ok('showHabits' in saved);
  assert.ok('compareMode' in saved);
});
