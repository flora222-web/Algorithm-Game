import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(here, '../algorithms/binary-search/binary-engine.js');
const sandbox = { window: {}, console };
vm.runInNewContext(fs.readFileSync(enginePath, 'utf8'), sandbox, { filename: enginePath });
const E = sandbox.window.BinaryEngine;

assert.ok(E, 'BinaryEngine should be exported');
assert.equal(E.LOWER_BOUND, 1);
assert.equal(E.UPPER_BOUND, 100);
assert.equal(E.MAX_WIRES, 7);

// 1. Midpoint math.
assert.equal(E.nextMid(1, 100), 50);
assert.equal(E.nextMid(51, 100), 75);
assert.equal(E.maxGuesses(100), 7);

// 2. Every secret is solvable by the optimal strategy within the wire budget.
for (let secret = 1; secret <= 100; secret += 1) {
  const result = E.simulateOptimal(secret);
  assert.equal(result.solved, true, `secret ${secret} should be solved`);
  assert.ok(result.guesses <= 7, `secret ${secret} should take <= 7 guesses`);
  assert.equal(result.state.status, 'defused');
}

// 3. Invalid guesses do not consume a wire, and the input state is not mutated.
const base = E.createState(50);
const invalidValues = [0, 101, 1.5, '50', null, undefined];
for (const value of invalidValues) {
  const result = E.applyGuess(base, value);
  assert.equal(result.ok, false);
  assert.equal(base.wiresLeft, 7);
  assert.equal(base.guesses.length, 0);
}

// 4. Wrong guesses consume wires and narrow the range.
const first = E.applyGuess(base, 25);
assert.equal(first.ok, true);
assert.equal(first.comparison, 'low');
assert.equal(first.state.wiresLeft, 6);
assert.equal(first.state.low, 26);
assert.equal(first.state.high, 100);
assert.equal(first.state.guesses.length, 1);
assert.equal(base.wiresLeft, 7, 'applyGuess must not mutate input');

const second = E.applyGuess(first.state, 75);
assert.equal(second.ok, true);
assert.equal(second.comparison, 'high');
assert.equal(second.state.wiresLeft, 5);
assert.equal(second.state.low, 26);
assert.equal(second.state.high, 74);

// 5. Duplicate / out-of-range.
const duplicate = E.applyGuess(second.state, 25);
assert.equal(duplicate.ok, false);
assert.equal(duplicate.errorCode, 'duplicate');
assert.equal(second.state.wiresLeft, 5);

const outside = E.applyGuess(second.state, 10);
assert.equal(outside.ok, false);
assert.equal(outside.errorCode, 'out-of-range');
assert.equal(second.state.wiresLeft, 5);

// 6. Seven wrong guesses explode.
let state = E.createState(100);
for (const value of [1, 2, 3, 4, 5, 6, 7]) {
  const result = E.applyGuess(state, value);
  assert.equal(result.ok, true);
  state = result.state;
}
assert.equal(state.wiresLeft, 0);
assert.equal(state.status, 'exploded');

// 7. A hit on the seventh wire still defuses.
state = E.createState(7);
for (const value of [1, 2, 3, 4, 5, 6]) {
  const result = E.applyGuess(state, value);
  assert.equal(result.ok, true);
  state = result.state;
}
assert.equal(state.wiresLeft, 1);
const last = E.applyGuess(state, 7);
assert.equal(last.ok, true);
assert.equal(last.comparison, 'hit');
assert.equal(last.state.status, 'defused');
assert.equal(last.state.wiresLeft, 0);

// 8. Event shape.
const event = first.event;
assert.equal(event.type, 'compare');
assert.equal(event.mid, 25);
assert.equal(event.low, 1);
assert.equal(event.high, 100);
assert.equal(event.newLow, 26);
assert.equal(event.newHigh, 100);
assert.equal(event.remaining, 75);
assert.equal(event.feedback, 'low');

// 9. The buggy low = mid search must be caught in a loop.
const buggy = E.runBuggySearch(51, { bug: 'low-mid', maxSteps: 16 });
assert.equal(buggy.solved, false);
assert.equal(buggy.loopDetected, true);
assert.equal(buggy.repeatedState.low, 50);
assert.equal(buggy.repeatedState.high, 51);
assert.ok(buggy.steps.length >= 6);

// 10. lower_bound / upper_bound on duplicates.
const duplicateValues = [1, 2, 2, 2, 4, 5, 5, 7, 9];
const firstTwo = E.simulateBound(duplicateValues, 2, 'first');
assert.equal(firstTwo.found, true);
assert.equal(firstTwo.index, 1);
const lastTwo = E.simulateBound(duplicateValues, 2, 'last');
assert.equal(lastTwo.found, true);
assert.equal(lastTwo.index, 3);

// 11. monotone predicate: smallest capacity that passes.
const predicate = E.simulatePredicate({ low: 1, high: 100, threshold: 60 });
assert.equal(predicate.answer, 60);
assert.equal(predicate.threshold, 60);
assert.ok(predicate.events.length > 0);

console.log('binary-engine tests passed');
