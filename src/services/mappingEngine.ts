/**
 * Mapping Engine — Pure deterministic function that maps guided check-in
 * responses to derived feeling(s) from the full 12-emotion set.
 *
 * Uses an additive scoring model: for each of the 12 feelings, sums weights
 * from the SCORING_TABLE across 4 input dimensions. The highest-scoring
 * feeling(s) win. Ties return all tied feelings for user selection.
 */

import { EmotionType } from '@/types/index';
import {
  BodyEnergyLevel,
  Pleasantness,
  ThoughtPattern,
  SocialContext,
  MappingInput,
  MappingResult,
  ScoringWeights,
} from '@/types/checkin';

// --- Valid enum sets for input validation ---

export const VALID_BODY_ENERGY: BodyEnergyLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
export const VALID_PLEASANTNESS: Pleasantness[] = ['unpleasant', 'mixed', 'pleasant'];
export const VALID_THOUGHT_PATTERN: ThoughtPattern[] = [
  'racing',
  'stuck_worries',
  'stuck_mistakes',
  'blank',
  'numb',
  'curious_interested',
  'okay',
];
export const VALID_CONTEXT: SocialContext[] = ['alone_at_home', 'at_work', 'with_family', 'with_friends'];

// --- Declarative scoring table ---

export const SCORING_TABLE: Record<EmotionType, ScoringWeights> = {
  hopeless: {
    body_very_low: 2, body_low: 1, body_medium: 0, body_high: 0, body_very_high: 0,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 2, thought_blank: 2, thought_numb: 1, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 0, ctx_with_family: 0, ctx_with_friends: 0,
  },
  guilty: {
    body_very_low: 0, body_low: 1, body_medium: 1, body_high: 0, body_very_high: 0,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 2, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 1, ctx_with_family: 1, ctx_with_friends: 1,
  },
  ashamed: {
    body_very_low: 0, body_low: 0, body_medium: 1, body_high: 1, body_very_high: 0,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 2, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 1, ctx_with_family: 1, ctx_with_friends: 1,
  },
  lonely: {
    body_very_low: 0, body_low: 1, body_medium: 1, body_high: 0, body_very_high: 0,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 1, thought_stuck_mistakes: 0, thought_blank: 2, thought_numb: 2, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 2, ctx_at_work: 0, ctx_with_family: 1, ctx_with_friends: 1,
  },
  angry: {
    body_very_low: 0, body_low: 0, body_medium: 0, body_high: 2, body_very_high: 2,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 1, thought_stuck_worries: 0, thought_stuck_mistakes: 1, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 0, ctx_with_family: 0, ctx_with_friends: 0,
  },
  anxious: {
    body_very_low: 0, body_low: 0, body_medium: 0, body_high: 2, body_very_high: 2,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 2, thought_stuck_worries: 2, thought_stuck_mistakes: 0, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 1, ctx_at_work: 1, ctx_with_family: 0, ctx_with_friends: 0,
  },
  overwhelmed: {
    body_very_low: 0, body_low: 0, body_medium: 1, body_high: 1, body_very_high: 0,
    pleasant_unpleasant: 1, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 2, thought_stuck_worries: 1, thought_stuck_mistakes: 0, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 1, ctx_with_family: 1, ctx_with_friends: 0,
  },
  stressed: {
    body_very_low: 0, body_low: 0, body_medium: 1, body_high: 1, body_very_high: 0,
    pleasant_unpleasant: 1, pleasant_mixed: 1, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 1, thought_stuck_mistakes: 0, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 1,
    ctx_alone_at_home: 1, ctx_at_work: 2, ctx_with_family: 1, ctx_with_friends: 1,
  },
  numb: {
    body_very_low: 2, body_low: 1, body_medium: 0, body_high: 0, body_very_high: 0,
    pleasant_unpleasant: 1, pleasant_mixed: 1, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 0, thought_blank: 1, thought_numb: 2, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 0, ctx_with_family: 0, ctx_with_friends: 0,
  },
  sad: {
    body_very_low: 1, body_low: 2, body_medium: 0, body_high: 0, body_very_high: 0,
    pleasant_unpleasant: 2, pleasant_mixed: 0, pleasant_pleasant: 0,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 0, thought_blank: 2, thought_numb: 1, thought_curious_interested: 0, thought_okay: 0,
    ctx_alone_at_home: 1, ctx_at_work: 0, ctx_with_family: 0, ctx_with_friends: 0,
  },
  curious: {
    body_very_low: 0, body_low: 0, body_medium: 2, body_high: 2, body_very_high: 0,
    pleasant_unpleasant: 0, pleasant_mixed: 2, pleasant_pleasant: 2,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 0, thought_blank: 0, thought_numb: 0, thought_curious_interested: 2, thought_okay: 0,
    ctx_alone_at_home: 0, ctx_at_work: 0, ctx_with_family: 0, ctx_with_friends: 0,
  },
  calm: {
    body_very_low: 0, body_low: 1, body_medium: 1, body_high: 0, body_very_high: 0,
    pleasant_unpleasant: 0, pleasant_mixed: 2, pleasant_pleasant: 2,
    thought_racing: 0, thought_stuck_worries: 0, thought_stuck_mistakes: 0, thought_blank: 0, thought_numb: 0, thought_curious_interested: 0, thought_okay: 2,
    ctx_alone_at_home: 0, ctx_at_work: 0, ctx_with_family: 0, ctx_with_friends: 0,
  },
};

// --- Input validation ---

/**
 * Validates all input fields against their valid enum sets.
 * Throws a synchronous Error identifying the invalid field if validation fails.
 */
function validateInput(input: MappingInput): void {
  if (!VALID_BODY_ENERGY.includes(input.bodyEnergy)) {
    throw new Error(`Invalid bodyEnergy: "${input.bodyEnergy}"`);
  }
  if (!VALID_PLEASANTNESS.includes(input.pleasantness)) {
    throw new Error(`Invalid pleasantness: "${input.pleasantness}"`);
  }
  if (!VALID_THOUGHT_PATTERN.includes(input.thoughtPattern)) {
    throw new Error(`Invalid thoughtPattern: "${input.thoughtPattern}"`);
  }
  if (!VALID_CONTEXT.includes(input.context)) {
    throw new Error(`Invalid context: "${input.context}"`);
  }
}

// --- Main mapping function ---

/**
 * Pure, synchronous function that derives feeling(s) from check-in responses.
 * Computes an additive score for each of the 12 feelings by summing weights
 * from SCORING_TABLE, then returns the highest-scoring feeling(s).
 * Falls back to "stressed" when all scores ≤ 2.
 * Throws on invalid input with field identification.
 */
export function deriveFeeling(input: MappingInput): MappingResult {
  // 1. Validate all input fields against their enum sets
  validateInput(input);

  // 2. Compute score for each feeling
  const scores: Record<EmotionType, number> = {} as Record<EmotionType, number>;

  for (const [feeling, weights] of Object.entries(SCORING_TABLE)) {
    const bodyKey = `body_${input.bodyEnergy}` as keyof ScoringWeights;
    const pleasantKey = `pleasant_${input.pleasantness}` as keyof ScoringWeights;
    const thoughtKey = `thought_${input.thoughtPattern}` as keyof ScoringWeights;
    const ctxKey = `ctx_${input.context}` as keyof ScoringWeights;

    scores[feeling as EmotionType] =
      weights[bodyKey] + weights[pleasantKey] + weights[thoughtKey] + weights[ctxKey];
  }

  // 3. Find the maximum score
  const maxScore = Math.max(...Object.values(scores));

  // 4. Fallback: if all scores ≤ 2, return "stressed"
  if (maxScore <= 2) {
    return { topFeelings: ['stressed'], scores };
  }

  // 5. Collect all feelings tied at the max score
  const topFeelings = (Object.entries(scores) as [EmotionType, number][])
    .filter(([_, score]) => score === maxScore)
    .map(([feeling]) => feeling);

  return { topFeelings, scores };
}
