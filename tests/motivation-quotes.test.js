import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserQuotes, addUserQuote, updateUserQuote, deleteUserQuote, getRandomQuote,
} from '../src/features/quotes/motivation.js';
import { readJSON, remove } from '../src/core/storage.js';

// motivation.js's built-in quote fetch (assets/motivation.json) has no
// real server to hit in this Node test environment, so it always falls
// through to the module's own small FALLBACK_QUOTES list — 4 quotes:
// 2 'habits', 1 'focus', 1 'general'. That fallback set is exactly what
// the "combined pool" tests below check against; it isn't asserted
// directly here since it's private to motivation.js, but its shape
// (one 'focus' quote, one 'general' quote) is what makes those tests
// deterministic.

function clearUserQuotes() {
  getUserQuotes().slice().forEach(q => deleteUserQuote(q.id));
  remove('focusUserQuotes');
}

test('addUserQuote adds an entry with an id, and getUserQuotes reflects it', () => {
  clearUserQuotes();
  const entry = addUserQuote('Test quote A', 'focus');

  assert.ok(entry.id, 'returned entry has an id');
  assert.equal(entry.quote, 'Test quote A');
  assert.equal(entry.category, 'focus');
  assert.deepEqual(getUserQuotes(), [entry]);
});

test('addUserQuote persists to localStorage under focusUserQuotes, separate from the built-in JSON', () => {
  clearUserQuotes();
  addUserQuote('Persisted quote', 'habits');

  const stored = readJSON('focusUserQuotes', null, 'array');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].quote, 'Persisted quote');
});

test('multiple addUserQuote calls accumulate rather than overwrite', () => {
  clearUserQuotes();
  addUserQuote('First', 'general');
  addUserQuote('Second', 'general');

  assert.equal(getUserQuotes().length, 2);
});

test('updateUserQuote changes only the matching quote', () => {
  clearUserQuotes();
  const a = addUserQuote('Original A', 'focus');
  const b = addUserQuote('Original B', 'habits');

  updateUserQuote(a.id, { quote: 'Updated A', category: 'general' });

  const quotes = getUserQuotes();
  const updatedA = quotes.find(q => q.id === a.id);
  const untouchedB = quotes.find(q => q.id === b.id);

  assert.equal(updatedA.quote, 'Updated A');
  assert.equal(updatedA.category, 'general');
  assert.equal(untouchedB.quote, 'Original B');
  assert.equal(untouchedB.category, 'habits');
});

test('deleteUserQuote removes only the matching quote', () => {
  clearUserQuotes();
  const a = addUserQuote('Keep me', 'focus');
  const b = addUserQuote('Delete me', 'focus');

  deleteUserQuote(b.id);

  const quotes = getUserQuotes();
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].id, a.id);
});

test('deleteUserQuote on an unknown id is a safe no-op', () => {
  clearUserQuotes();
  addUserQuote('Untouched', 'focus');

  assert.doesNotThrow(() => deleteUserQuote('not-a-real-id'));
  assert.equal(getUserQuotes().length, 1);
});

test('getRandomQuote includes a user-added quote in its category pool', async () => {
  clearUserQuotes();
  addUserQuote('Unique user quote for pool test', 'habits');

  // Random selection, so poll enough times that missing a quote present
  // in a small pool would be astronomically unlikely if the merge logic
  // were broken (this pool is at most ~5 quotes: fallback + 1 user quote,
  // plus any 'general' fallback quote — see filtering test below).
  let seenUserQuote = false;
  for (let i = 0; i < 200 && !seenUserQuote; i++) {
    const { quote } = await getRandomQuote('habits');
    if (quote === 'Unique user quote for pool test') {seenUserQuote = true;}
  }
  assert.ok(seenUserQuote, 'user-added quote eventually appears when rotating the "habits" category');
});

test('getRandomQuote never returns a quote from an unrelated category', async () => {
  clearUserQuotes();
  addUserQuote('A focus-only quote', 'focus');
  addUserQuote('A habits-only quote', 'habits');

  for (let i = 0; i < 100; i++) {
    const { category } = await getRandomQuote('focus');
    assert.ok(category === 'focus' || category === 'general', `expected focus or general, got "${category}"`);
  }
});

test('getRandomQuote treats a "general" user quote as fitting every category', async () => {
  clearUserQuotes();
  addUserQuote('A general-purpose quote', 'general');

  let seenInHabits = false;
  let seenInFocus = false;
  for (let i = 0; i < 200 && !(seenInHabits && seenInFocus); i++) {
    if (!seenInHabits) {
      const { quote } = await getRandomQuote('habits');
      if (quote === 'A general-purpose quote') {seenInHabits = true;}
    }
    if (!seenInFocus) {
      const { quote } = await getRandomQuote('focus');
      if (quote === 'A general-purpose quote') {seenInFocus = true;}
    }
  }

  assert.ok(seenInHabits, 'a "general" user quote surfaces when rotating "habits"');
  assert.ok(seenInFocus, 'a "general" user quote surfaces when rotating "focus"');
});

test('adding a user quote never mutates the built-in fallback pool itself', async () => {
  clearUserQuotes();
  const before = await getRandomQuote('focus');
  addUserQuote('Should not leak backward', 'focus');
  // The built-in pool is a fixed module-level array in motivation.js;
  // this just checks the well-known built-in "focus" fallback quote is
  // still obtainable afterward, i.e. it wasn't replaced or spliced.
  let stillPresent = false;
  for (let i = 0; i < 100; i++) {
    const { quote } = await getRandomQuote('focus');
    if (quote === before.quote) {stillPresent = true; break;}
  }
  assert.ok(stillPresent, 'original built-in quote is still reachable after adding a user quote');

  clearUserQuotes();
});
