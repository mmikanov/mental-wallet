/**
 * Pure drip-sequence logic (no D1, no network) so it is directly unit-testable.
 *
 * The drip is a single global ordered list of campaigns ("steps"). A subscriber moves
 * through it one at a time; their position is DERIVED (never stored) from which campaigns
 * they have already received:
 *
 *   next campaign = the earliest ENABLED step, in position order, whose campaign the
 *   subscriber has NOT received AND for which they are currently eligible
 *   (opted into the campaign's scope, and the campaign's N-day gap is satisfied).
 *
 * Carry-over (a deferral holds up everything downstream) falls out of "earliest unreceived"
 * automatically: if the subscriber hasn't received step K, step K is their earliest
 * unreceived step, so step K+1 is never considered until K is received.
 */

export interface SequenceStep {
  id: string;
  campaign_id: string;
  position: number;
  enabled: number; // 1 enabled, 0 disabled
}

/** The resolution outcome for one subscriber on one evaluation. */
export type NextStepResult =
  | { kind: 'next'; step: SequenceStep } // this campaign should be sent to them now
  | { kind: 'waiting'; step: SequenceStep } // their next unreceived step exists but they're not eligible yet (gap/scope)
  | { kind: 'finished' }; // they have received every enabled step (or the sequence is empty)

/**
 * Resolve the single next step for a subscriber.
 *
 * @param steps          all sequence steps (any order; this function sorts + filters enabled).
 * @param hasReceived    (campaignId) => true if the subscriber already received that campaign.
 * @param isEligible     (step) => true if the subscriber is eligible for that step's campaign
 *                       right now (scope opted-in AND gap satisfied). Only called for the
 *                       earliest unreceived enabled step.
 *
 * Returns:
 *  - { kind: 'next', step }    — earliest unreceived enabled step, and they're eligible → send.
 *  - { kind: 'waiting', step } — earliest unreceived enabled step exists but not eligible yet.
 *  - { kind: 'finished' }      — no unreceived enabled steps remain (incl. empty sequence).
 */
export function resolveNextStep(
  steps: SequenceStep[],
  hasReceived: (campaignId: string) => boolean,
  isEligible: (step: SequenceStep) => boolean
): NextStepResult {
  const ordered = steps
    .filter((s) => s.enabled === 1)
    .sort((a, b) => a.position - b.position);

  for (const step of ordered) {
    if (hasReceived(step.campaign_id)) continue; // already got this one; move on
    // This is the earliest unreceived enabled step — the subscriber's current frontier.
    // They advance no further than here until they receive it.
    return isEligible(step) ? { kind: 'next', step } : { kind: 'waiting', step };
  }

  // Every enabled step received (or there are none) → finished / nothing due.
  return { kind: 'finished' };
}

/**
 * Derive the relative signup ages (in days-ago) for a sequence-shaped test cohort.
 *
 * Walks the enabled steps in order, accumulating each step's gap to get the age at which a
 * tester would be DUE for that step, and adds a brand-new (day 0) tester and one past the
 * end of the sequence. The result is the set of "joined N days ago" ages that place one
 * tester at each meaningful point in the flow.
 *
 * @param gapsInOrder  the enabled steps' gap_days, in sequence order (step 1 gap first, ...).
 * @returns ascending, de-duplicated list of ages (days ago). Always includes 0.
 *
 * Example: gaps [1, 7, 7] →
 *   cumulative due-ages: step1 due at 0, step2 due at 0+1=1... but a tester must be old
 *   enough to have passed each gap. We place testers at the cumulative gap boundaries:
 *   [0, 1, 8, 15] plus a past-the-end tester at 15 + lastGap. See tests for exact shape.
 */
export function deriveTestAges(gapsInOrder: number[]): number[] {
  const ages = new Set<number>([0]); // always a brand-new tester
  let cumulative = 0;
  for (const g of gapsInOrder) {
    const gap = Math.max(1, Math.floor(g || 1));
    cumulative += gap;
    ages.add(cumulative); // a tester old enough to be due for the step after this gap
  }
  // `cumulative` now sits just past the last step; add one more past-the-end tester
  // so we exercise the "finished" state too.
  ages.add(cumulative + 1);
  return Array.from(ages).sort((a, b) => a - b);
}
