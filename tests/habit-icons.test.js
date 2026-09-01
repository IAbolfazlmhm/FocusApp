import test from 'node:test';
import assert from 'node:assert/strict';
import './env.js';
import { habitIconsDict, habitIconLabels, renderHabitIconPicker } from '../src/features/habits/habit-icons.js';

test('habit-icons: all icons in dictionary have corresponding labels', () => {
  const iconKeys = Object.keys(habitIconsDict);
  assert.ok(iconKeys.length >= 38);
  for (const key of iconKeys) {
    assert.ok(habitIconLabels[key], `Missing label for icon: ${key}`);
    assert.ok(habitIconsDict[key].length > 0, `Empty SVG for icon: ${key}`);
  }
});

test('habit-icons: renderHabitIconPicker dynamically generates option buttons', () => {
  const container = document.createElement('div');
  container.id = 'test-habit-icon-picker';
  document.body.appendChild(container);

  renderHabitIconPicker('test-habit-icon-picker');
  const buttons = container.querySelectorAll('.icon-option');
  assert.equal(buttons.length, Object.keys(habitIconsDict).length);
  assert.ok(buttons[0].classList.contains('selected'));

  container.remove();
});
