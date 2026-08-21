import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveTimerState, loadTimerState } from '../src/features/timer/timer.js';
import {
  setTimeLeft, setTotalTime, setCurrentPhase, setCompletedSessions,
} from '../src/core/state.js';
import * as state from '../src/core/state.js';

test('saveTimerState then loadTimerState restores the saved values', () => {
  setTimeLeft(742);
  setTotalTime(1500);
  setCurrentPhase('short');
  setCompletedSessions(2);
  saveTimerState();

  // Change everything to different values first, so a passing test can
  // only mean loadTimerState actually restored them — not that they
  // happened to already be right.
  setTimeLeft(0);
  setTotalTime(0);
  setCurrentPhase('work');
  setCompletedSessions(0);

  const restored = loadTimerState();

  assert.equal(restored, true);
  assert.equal(state.timeLeft, 742);
  assert.equal(state.totalTime, 1500);
  assert.equal(state.currentPhase, 'short');
  assert.equal(state.completedSessions, 2);
});

test('loadTimerState returns false and leaves state untouched when nothing was ever saved', () => {
  localStorage.removeItem('focusTimerState');
  setTimeLeft(999);

  const restored = loadTimerState();

  assert.equal(restored, false);
  assert.equal(state.timeLeft, 999); // unchanged
});

test('loadTimerState discards and rejects state older than 4 hours', () => {
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  localStorage.setItem('focusTimerState', JSON.stringify({
    timeLeft: 123,
    totalTime: 1500,
    currentPhase: 'long',
    completedSessions: 1,
    lastSaved: Date.now() - FOUR_HOURS - 60_000, // just over 4 hours ago
  }));

  setTimeLeft(555); // sentinel value — should survive since the load is rejected

  const restored = loadTimerState();

  assert.equal(restored, false);
  assert.equal(state.timeLeft, 555);
  // The stale entry should also be cleared, not just ignored.
  assert.equal(localStorage.getItem('focusTimerState'), null);
});

test('loadTimerState accepts state saved just under the 4-hour cutoff', () => {
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  localStorage.setItem('focusTimerState', JSON.stringify({
    timeLeft: 321,
    totalTime: 1500,
    currentPhase: 'work',
    completedSessions: 0,
    lastSaved: Date.now() - FOUR_HOURS + 60_000, // just under 4 hours ago
  }));

  const restored = loadTimerState();

  assert.equal(restored, true);
  assert.equal(state.timeLeft, 321);
});
