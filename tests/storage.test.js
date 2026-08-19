import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, writeJSON, readRaw, writeRaw, remove } from '../js/core/storage.js';

test('writeJSON then readJSON round-trips a value', () => {
  writeJSON('test:roundtrip', { a: 1, b: [1, 2, 3] });
  assert.deepEqual(readJSON('test:roundtrip', null), { a: 1, b: [1, 2, 3] });
});

test('readJSON returns the fallback when the key is missing', () => {
  remove('test:missing');
  assert.deepEqual(readJSON('test:missing', { default: true }), { default: true });
});

test('readJSON returns the fallback for corrupted (non-JSON) data instead of throwing', () => {
  localStorage.setItem('test:corrupted', '{not valid json');
  assert.deepEqual(readJSON('test:corrupted', 'fallback'), 'fallback');
});

test('readJSON with expectedType "array" rejects a non-array value and returns the fallback', () => {
  localStorage.setItem('test:wrongtype', JSON.stringify({ not: 'an array' }));
  assert.deepEqual(readJSON('test:wrongtype', [], 'array'), []);
});

test('readJSON with expectedType "array" accepts a real array', () => {
  localStorage.setItem('test:realarray', JSON.stringify([1, 2, 3]));
  assert.deepEqual(readJSON('test:realarray', [], 'array'), [1, 2, 3]);
});

test('readRaw/writeRaw round-trip a plain string without JSON encoding', () => {
  writeRaw('test:raw', 'hello');
  assert.equal(readRaw('test:raw', null), 'hello');
});

test('readRaw returns the fallback when the key is missing', () => {
  remove('test:rawmissing');
  assert.equal(readRaw('test:rawmissing', 'default'), 'default');
});

test('remove deletes a key so a subsequent read falls back', () => {
  writeJSON('test:toremove', 'value');
  remove('test:toremove');
  assert.deepEqual(readJSON('test:toremove', 'gone'), 'gone');
});

test('writeJSON does not throw when localStorage.setItem throws (e.g. quota exceeded)', () => {
  // jsdom's Storage doesn't allow overriding one method on the existing
  // instance (its internals ignore a direct `localStorage.setItem = ...`
  // reassignment), so this swaps the whole global out for a minimal
  // mock that throws, instead.
  const original = global.localStorage;
  global.localStorage = {
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  try {
    assert.equal(writeJSON('test:quota', { big: 'data' }), false);
  } finally {
    global.localStorage = original;
  }
});
