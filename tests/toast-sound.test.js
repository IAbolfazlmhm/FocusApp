import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundForToastType } from '../src/shared/toast/toast.js';

// FIX regression coverage: 'warning' toasts (blocked/failed validation —
// empty name, out-of-range value, duplicate entry, etc.) used to play the
// exact same 'click' sound as an ordinary successful interaction, so a
// failed action was audibly indistinguishable from one that worked.

test('soundForToastType: success toasts get the success sound', () => {
  assert.equal(soundForToastType('success'), 'success');
});

test('soundForToastType: warning toasts get a distinct error sound, not the generic click', () => {
  const sound = soundForToastType('warning');
  assert.equal(sound, 'error');
  assert.notEqual(sound, 'click', 'a failed action must not sound identical to an ordinary click');
  assert.notEqual(sound, 'success', 'a failed action must not sound identical to a successful one');
});

test('soundForToastType: info toasts play no sound', () => {
  assert.equal(soundForToastType('info'), null);
});

test('soundForToastType: unrecognized types play no sound rather than falling back to click', () => {
  assert.equal(soundForToastType('something-unexpected'), null);
});
