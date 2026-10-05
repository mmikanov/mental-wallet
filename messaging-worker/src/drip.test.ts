// Unit tests for the pure drip-sequence logic.
// Run via the package.json "test" script (node --test, TypeScript stripped).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNextStep, deriveTestAges, type SequenceStep } from './drip.ts';

function step(campaign_id: string, position: number, enabled = 1): SequenceStep {
  return { id: `s-${campaign_id}`, campaign_id, position, enabled };
}

const SEQ: SequenceStep[] = [
  step('welcome', 1),
  step('emotion', 2),
  step('outcome', 3),
];

const eligibleAlways = () => true;

test('welcome first: a brand-new subscriber (received nothing) gets the earliest step', () => {
  const r = resolveNextStep(SEQ, () => false, eligibleAlways);
  assert.equal(r.kind, 'next');
  assert.equal(r.kind === 'next' && r.step.campaign_id, 'welcome');
});

test('one-at-a-time: after receiving welcome, next is emotion', () => {
  const received = new Set(['welcome']);
  const r = resolveNextStep(SEQ, (c) => received.has(c), eligibleAlways);
  assert.equal(r.kind === 'next' && r.step.campaign_id, 'emotion');
});

test('carry-over: owing emotion (not received), never jumps to outcome even if eligible', () => {
  // received welcome + outcome but NOT emotion → earliest unreceived is emotion.
  const received = new Set(['welcome', 'outcome']);
  const r = resolveNextStep(SEQ, (c) => received.has(c), eligibleAlways);
  assert.equal(r.kind === 'next' && r.step.campaign_id, 'emotion');
});

test('waiting: earliest unreceived step exists but subscriber not eligible (gap/scope)', () => {
  const received = new Set(['welcome']);
  // emotion is next but not eligible yet
  const r = resolveNextStep(SEQ, (c) => received.has(c), (s) => s.campaign_id !== 'emotion');
  assert.equal(r.kind, 'waiting');
  assert.equal(r.kind === 'waiting' && r.step.campaign_id, 'emotion');
});

test('finished: received every enabled step', () => {
  const received = new Set(['welcome', 'emotion', 'outcome']);
  const r = resolveNextStep(SEQ, (c) => received.has(c), eligibleAlways);
  assert.equal(r.kind, 'finished');
});

test('empty sequence: finished / nothing due, no error', () => {
  const r = resolveNextStep([], () => false, eligibleAlways);
  assert.equal(r.kind, 'finished');
});

test('disabled steps are skipped', () => {
  const seq = [step('welcome', 1, 0), step('emotion', 2), step('outcome', 3)];
  // welcome disabled → earliest enabled unreceived is emotion
  const r = resolveNextStep(seq, () => false, eligibleAlways);
  assert.equal(r.kind === 'next' && r.step.campaign_id, 'emotion');
});

test('reorder: resolution follows position order, not insertion order', () => {
  // outcome moved to position 0 (earliest)
  const seq = [step('welcome', 2), step('emotion', 3), step('outcome', 1)];
  const r = resolveNextStep(seq, () => false, eligibleAlways);
  assert.equal(r.kind === 'next' && r.step.campaign_id, 'outcome');
});

test('insert earlier re-engages a "finished" subscriber', () => {
  // Subscriber received welcome+emotion+outcome (was finished). A new step inserted earlier
  // that they have NOT received becomes their next.
  const seq = [step('welcome', 1), step('newtip', 2), step('emotion', 3), step('outcome', 4)];
  const received = new Set(['welcome', 'emotion', 'outcome']);
  const r = resolveNextStep(seq, (c) => received.has(c), eligibleAlways);
  assert.equal(r.kind === 'next' && r.step.campaign_id, 'newtip');
});

// --- deriveTestAges ---

test('deriveTestAges: gaps [1,7,7] → [0,1,8,15,16]', () => {
  // cumulative: 0 (new) ; +1=1 ; +7=8 ; +7=15 ; past-end 15+1=16
  assert.deepEqual(deriveTestAges([1, 7, 7]), [0, 1, 8, 15, 16]);
});

test('deriveTestAges: all gap-1 [1,1,1] → [0,1,2,3,4]', () => {
  assert.deepEqual(deriveTestAges([1, 1, 1]), [0, 1, 2, 3, 4]);
});

test('deriveTestAges: empty sequence → just [0,1]', () => {
  // no steps: new tester (0) + past-end (0+1)
  assert.deepEqual(deriveTestAges([]), [0, 1]);
});

test('deriveTestAges: clamps bad gaps to 1', () => {
  // both clamp to 1: cumulative 0->1->2, plus past-end 2+1=3
  assert.deepEqual(deriveTestAges([0, -3]), [0, 1, 2, 3]);
});
