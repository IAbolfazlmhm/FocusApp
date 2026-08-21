import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidHexColor, hexToRgba, getTagColor } from '../src/shared/color-utils.js';

test('isValidHexColor accepts well-formed 3- and 6-digit hex colors', () => {
  assert.equal(isValidHexColor('#3b82f6'), true);
  assert.equal(isValidHexColor('#FFF'), true);
  assert.equal(isValidHexColor('#000000'), true);
});

test('isValidHexColor rejects non-color strings, including an attribute-breakout attempt', () => {
  // This is the exact shape of payload the fix in color-utils.js/habits.js
  // exists to stop: a value that, if interpolated unescaped into a
  // style="..." attribute, would close the attribute early and inject
  // markup. See the "Security" commit for the full render-path exploit
  // this is a regression test for.
  assert.equal(isValidHexColor('"><img src=x onerror=alert(1)>'), false);
  assert.equal(isValidHexColor('red'), false);
  assert.equal(isValidHexColor(''), false);
  assert.equal(isValidHexColor('#12345'), false); // 5 digits — not a valid length
  assert.equal(isValidHexColor('#gggggg'), false); // not hex digits
});

test('isValidHexColor rejects non-string values without throwing', () => {
  assert.equal(isValidHexColor(undefined), false);
  assert.equal(isValidHexColor(null), false);
  assert.equal(isValidHexColor(42), false);
  assert.equal(isValidHexColor({}), false);
});

test('hexToRgba converts a 6-digit hex color to an rgba() string', () => {
  assert.equal(hexToRgba('#3b82f6', 0.5), 'rgba(59, 130, 246, 0.5)');
});

test('hexToRgba expands a 3-digit hex color', () => {
  assert.equal(hexToRgba('#fff', 1), 'rgba(255, 255, 255, 1)');
});

test('getTagColor returns the custom color when one is stored and valid', () => {
  const result = getTagColor('Work', '#ff0000');
  assert.equal(result.solid, '#ff0000');
  assert.equal(result.hex, '#ff0000');
});

test('getTagColor falls back to the deterministic hash color when no custom color is stored', () => {
  const result = getTagColor('Work', undefined);
  assert.match(result.solid, /^hsl\(/);
});

test('getTagColor falls back to the hash color when the stored custom color is invalid (defense in depth)', () => {
  // Exercises the same validation as isValidHexColor, but through the
  // actual call path renderTasks() uses — proves an invalid/malicious
  // stored value can never reach the "solid" color that gets
  // interpolated into a style attribute in tasks.js.
  const malicious = getTagColor('Work', '"><script>alert(1)</script>');
  assert.match(malicious.solid, /^hsl\(/);
});

test('getTagColor is deterministic: the same tag name always hashes to the same color', () => {
  const first = getTagColor('Study', undefined);
  const second = getTagColor('Study', undefined);
  assert.equal(first.solid, second.solid);
});

test('getTagColor gives different tag names different hash colors (in general)', () => {
  const a = getTagColor('Study', undefined);
  const b = getTagColor('Personal', undefined);
  assert.notEqual(a.solid, b.solid);
});
