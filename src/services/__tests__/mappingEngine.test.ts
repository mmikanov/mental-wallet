/**
 * Property-based tests for the score-based Guided Emotion Check-in mapping engine.
 *
 * Uses fast-check 3 to verify correctness properties of deriveFeeling
 * and the SCORING_TABLE-based evaluation model.
 */
import * as fc from 'fast-check';

import {
  deriveFeeling,
  SCORING_TABLE,
  VALID_BODY_ENERGY,
  VALID_PLEASANTNESS,
  VALID_THOUGHT_PATTERN,
  VALID_CONTEXT,
} from '@/services/mappingEngine';
import {
  BodyEnergyLevel,
  Pleasantness,
  ThoughtPattern,
  SocialContext,
  MappingInput,
} from '@/types/checkin';
import { EmotionType } from '@/types';

// --- Valid enum values (for assertions) ---

const VALID_EMOTIONS: EmotionType[] = [
  'stressed',
  'overwhelmed',
  'anxious',
  'sad',
  'angry',
  'numb',
  'lonely',
  'ashamed',
  'guilty',
  'hopeless',
  'calm',
  'curious',
];

// --- fast-check arbitraries for valid inputs ---

const bodyEnergyArb = fc.constantFrom(...VALID_BODY_ENERGY);
const pleasantnessArb = fc.constantFrom(...VALID_PLEASANTNESS);
const thoughtPatternArb = fc.constantFrom(...VALID_THOUGHT_PATTERN);
const contextArb = fc.constantFrom(...VALID_CONTEXT);

const validInputArb: fc.Arbitrary<MappingInput> = fc.record({
  bodyEnergy: bodyEnergyArb,
  pleasantness: pleasantnessArb,
  thoughtPattern: thoughtPatternArb,
  context: contextArb,
});

// =============================================================================
// Property 1: Total Function — all 420 combinations produce valid output
// =============================================================================

describe('Property 1: Total Function — all 420 combinations produce valid output', () => {
  /**
   * Validates: Requirements 3.1, 3.7
   */
  it('deriveFeeling returns a non-empty topFeelings array of valid EmotionType values for every valid input', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = deriveFeeling(input);

        // topFeelings is a non-empty array
        expect(Array.isArray(result.topFeelings)).toBe(true);
        expect(result.topFeelings.length).toBeGreaterThanOrEqual(1);

        // Every element in topFeelings is a valid EmotionType
        for (const feeling of result.topFeelings) {
          expect(VALID_EMOTIONS).toContain(feeling);
        }
      }),
      { numRuns: 420 },
    );
  });

  it('deriveFeeling returns scores containing all 12 emotion keys with numeric values for every valid input', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = deriveFeeling(input);

        // scores contains all 12 keys
        const scoreKeys = Object.keys(result.scores);
        expect(scoreKeys.length).toBe(12);

        for (const emotion of VALID_EMOTIONS) {
          expect(result.scores).toHaveProperty(emotion);
          expect(typeof result.scores[emotion]).toBe('number');
          expect(Number.isFinite(result.scores[emotion])).toBe(true);
        }
      }),
      { numRuns: 420 },
    );
  });
});

// =============================================================================
// Property 3: Referential transparency — same input same output (Score-based)
// =============================================================================

describe('Feature: guided-emotion-checkin, Property 3: Referential transparency — same input same output', () => {
  it('calling deriveFeeling twice with the same input produces identical topFeelings and scores', () => {
    /**
     * Validates: Requirements 3.6
     */
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result1 = deriveFeeling(input);
        const result2 = deriveFeeling(input);

        // topFeelings must be identical arrays (same elements in same order)
        expect(result1.topFeelings).toEqual(result2.topFeelings);

        // scores records must be identical
        expect(result1.scores).toEqual(result2.scores);
      }),
      { numRuns: 200 },
    );
  });
});

// =============================================================================
// Property 4: Invalid Input Rejection
// =============================================================================

describe('Property 4: Invalid input rejection', () => {
  /**
   * Validates: Requirements 3.8
   */

  // All valid values across all fields — used to filter out valid strings
  const ALL_VALID_VALUES: string[] = [
    ...VALID_BODY_ENERGY,
    ...VALID_PLEASANTNESS,
    ...VALID_THOUGHT_PATTERN,
    ...VALID_CONTEXT,
  ];

  // Arbitrary that generates strings NOT matching any valid enum value
  const invalidStringArb = fc
    .string({ minLength: 1 })
    .filter((s) => !ALL_VALID_VALUES.includes(s));

  // Arbitrary that picks which field(s) to invalidate
  const fieldNameArb = fc.constantFrom(
    'bodyEnergy' as const,
    'pleasantness' as const,
    'thoughtPattern' as const,
    'context' as const,
  );

  it('throws an Error when bodyEnergy is invalid', () => {
    fc.assert(
      fc.property(
        invalidStringArb,
        pleasantnessArb,
        thoughtPatternArb,
        contextArb,
        (badBodyEnergy, pleasantness, thoughtPattern, context) => {
          const input = {
            bodyEnergy: badBodyEnergy as any,
            pleasantness,
            thoughtPattern,
            context,
          };
          expect(() => deriveFeeling(input)).toThrow(/bodyEnergy/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws an Error when pleasantness is invalid', () => {
    fc.assert(
      fc.property(
        bodyEnergyArb,
        invalidStringArb,
        thoughtPatternArb,
        contextArb,
        (bodyEnergy, badPleasantness, thoughtPattern, context) => {
          const input = {
            bodyEnergy,
            pleasantness: badPleasantness as any,
            thoughtPattern,
            context,
          };
          expect(() => deriveFeeling(input)).toThrow(/pleasantness/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws an Error when thoughtPattern is invalid', () => {
    fc.assert(
      fc.property(
        bodyEnergyArb,
        pleasantnessArb,
        invalidStringArb,
        contextArb,
        (bodyEnergy, pleasantness, badThoughtPattern, context) => {
          const input = {
            bodyEnergy,
            pleasantness,
            thoughtPattern: badThoughtPattern as any,
            context,
          };
          expect(() => deriveFeeling(input)).toThrow(/thoughtPattern/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws an Error when context is invalid', () => {
    fc.assert(
      fc.property(
        bodyEnergyArb,
        pleasantnessArb,
        thoughtPatternArb,
        invalidStringArb,
        (bodyEnergy, pleasantness, thoughtPattern, badContext) => {
          const input = {
            bodyEnergy,
            pleasantness,
            thoughtPattern,
            context: badContext as any,
          };
          expect(() => deriveFeeling(input)).toThrow(/context/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws an Error identifying the first invalid field when multiple fields are invalid', () => {
    fc.assert(
      fc.property(
        invalidStringArb,
        invalidStringArb,
        invalidStringArb,
        invalidStringArb,
        (badBody, badPleasantness, badThought, badContext) => {
          const input = {
            bodyEnergy: badBody as any,
            pleasantness: badPleasantness as any,
            thoughtPattern: badThought as any,
            context: badContext as any,
          };
          // Should throw — the error message identifies at least the first invalid field
          expect(() => deriveFeeling(input)).toThrow(/bodyEnergy/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('never returns a MappingResult for any input with at least one invalid field', () => {
    fc.assert(
      fc.property(
        fieldNameArb,
        invalidStringArb,
        bodyEnergyArb,
        pleasantnessArb,
        thoughtPatternArb,
        contextArb,
        (fieldToInvalidate, badValue, bodyEnergy, pleasantness, thoughtPattern, context) => {
          const input: any = { bodyEnergy, pleasantness, thoughtPattern, context };
          input[fieldToInvalidate] = badValue;

          expect(() => deriveFeeling(input)).toThrow(Error);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// =============================================================================
// Property 5: Fallback When All Scores ≤ 2
// =============================================================================

describe('Property 5: Fallback when all scores ≤ 2', () => {
  /**
   * Validates: Requirements 3.5
   */

  function computeScores(input: MappingInput): Record<EmotionType, number> {
    const scores: Record<string, number> = {};
    for (const [feeling, weights] of Object.entries(SCORING_TABLE)) {
      const bodyKey = `body_${input.bodyEnergy}` as keyof typeof weights;
      const pleasantKey = `pleasant_${input.pleasantness}` as keyof typeof weights;
      const thoughtKey = `thought_${input.thoughtPattern}` as keyof typeof weights;
      const ctxKey = `ctx_${input.context}` as keyof typeof weights;
      scores[feeling] =
        weights[bodyKey] + weights[pleasantKey] + weights[thoughtKey] + weights[ctxKey];
    }
    return scores as Record<EmotionType, number>;
  }

  it('when maxScore ≤ 2, topFeelings is exactly ["stressed"]', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const scores = computeScores(input);
        const maxScore = Math.max(...Object.values(scores));

        if (maxScore <= 2) {
          const result = deriveFeeling(input);
          expect(result.topFeelings).toEqual(['stressed']);
        }
      }),
      { numRuns: 420 },
    );
  });

  it('when maxScore > 2, "stressed" only appears in topFeelings if its score equals the max', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const scores = computeScores(input);
        const maxScore = Math.max(...Object.values(scores));

        if (maxScore > 2) {
          const result = deriveFeeling(input);
          const stressedScore = scores['stressed' as EmotionType];

          if (result.topFeelings.includes('stressed')) {
            expect(stressedScore).toBe(maxScore);
          }
        }
      }),
      { numRuns: 420 },
    );
  });
});

// =============================================================================
// Property 2: Highest Score Wins
// =============================================================================

describe('Feature: guided-emotion-checkin, Property 2: Highest score wins', () => {
  it('topFeelings contains exactly those feelings with the maximum score', () => {
    /**
     * Validates: Requirements 3.2, 3.3
     */
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = deriveFeeling(input);

        // Manually compute scores from SCORING_TABLE
        const manualScores: Record<string, number> = {};
        for (const [feeling, weights] of Object.entries(SCORING_TABLE)) {
          const bodyKey = `body_${input.bodyEnergy}` as keyof typeof weights;
          const pleasantKey = `pleasant_${input.pleasantness}` as keyof typeof weights;
          const thoughtKey = `thought_${input.thoughtPattern}` as keyof typeof weights;
          const ctxKey = `ctx_${input.context}` as keyof typeof weights;

          manualScores[feeling] =
            weights[bodyKey] + weights[pleasantKey] + weights[thoughtKey] + weights[ctxKey];
        }

        // Find max score
        const maxScore = Math.max(...Object.values(manualScores));

        // Handle the fallback case where maxScore ≤ 2 → stressed
        if (maxScore <= 2) {
          expect(result.topFeelings).toEqual(['stressed']);
          return;
        }

        // Collect all feelings tied at max score
        const expectedTopFeelings = Object.entries(manualScores)
          .filter(([_, score]) => score === maxScore)
          .map(([feeling]) => feeling);

        // Assert topFeelings contains exactly those feelings at maxScore (order-independent)
        expect(result.topFeelings).toHaveLength(expectedTopFeelings.length);
        expect([...result.topFeelings].sort()).toEqual([...expectedTopFeelings].sort());
      }),
      { numRuns: 420 },
    );
  });
});

// =============================================================================
// Property 6: All 12 Emotions Reachable
// =============================================================================

describe('Property 6: All 12 emotions are reachable', () => {
  /**
   * Validates: Requirements 3.7
   */
  it('exhaustively testing all 420 combinations, every one of the 12 emotions appears in at least one topFeelings result', () => {
    const reachedEmotions = new Set<EmotionType>();

    // Iterate through all valid input combinations (5 × 3 × 7 × 4 = 420)
    for (const bodyEnergy of VALID_BODY_ENERGY) {
      for (const pleasantness of VALID_PLEASANTNESS) {
        for (const thoughtPattern of VALID_THOUGHT_PATTERN) {
          for (const context of VALID_CONTEXT) {
            const input: MappingInput = { bodyEnergy, pleasantness, thoughtPattern, context };
            const result = deriveFeeling(input);

            for (const feeling of result.topFeelings) {
              reachedEmotions.add(feeling);
            }
          }
        }
      }
    }

    // Assert all 12 emotions are reachable
    for (const emotion of VALID_EMOTIONS) {
      expect(reachedEmotions.has(emotion)).toBe(true);
    }

    // Also verify we covered exactly 12 unique emotions
    expect(reachedEmotions.size).toBe(12);
  });
});


// =============================================================================
// Property 10: Back-Navigation Clears Forward Answers
// =============================================================================

describe('Property 10: Back-navigation clears forward answers', () => {
  /**
   * **Validates: Requirements 2.14**
   *
   * For any check-in state where the user has answered questions up to step N
   * (2 ≤ N ≤ 4), navigating back clears answers for steps after the new current
   * step while preserving answers at the new step and earlier.
   */

  // We need to mock the mapping engine for this describe block because
  // answering step 4 triggers complete() which calls deriveFeeling.
  jest.mock('@/services/mappingEngine', () => ({
    ...jest.requireActual('@/services/mappingEngine'),
    deriveFeeling: jest.fn(() => ({
      topFeelings: ['stressed'],
      scores: {},
    })),
  }));

  // Import the store fresh (it uses the mocked mapping engine)
  const { useCheckinStore } = require('@/stores/checkinStore');

  // Generators for answer values per step
  const bodyEnergyStepArb = fc.constantFrom('very_low', 'low', 'medium', 'high', 'very_high');
  const pleasantnessStepArb = fc.constantFrom('unpleasant', 'mixed', 'pleasant');
  const thoughtPatternStepArb = fc.constantFrom(
    'racing', 'stuck_worries', 'stuck_mistakes', 'blank', 'numb', 'curious_interested', 'okay'
  );
  const socialContextStepArb = fc.constantFrom(
    'alone_at_home', 'at_work', 'with_family', 'with_friends'
  );

  // Step field mapping
  const STEP_FIELDS = ['bodyEnergy', 'pleasantness', 'thoughtPattern', 'context'] as const;

  function arbForStep(step: number) {
    switch (step) {
      case 1: return bodyEnergyStepArb;
      case 2: return pleasantnessStepArb;
      case 3: return thoughtPatternStepArb;
      case 4: return socialContextStepArb;
      default: return bodyEnergyStepArb;
    }
  }

  beforeEach(() => {
    useCheckinStore.getState().reset();
  });

  it('navigating back to step M clears answers for steps M+1..4 and retains answers for steps 1..M', () => {
    fc.assert(
      fc.property(
        // How many steps to fill (2-4, need at least 2 to navigate back)
        fc.integer({ min: 2, max: 4 }),
        // Random answer values for each step
        bodyEnergyStepArb,
        pleasantnessStepArb,
        thoughtPatternStepArb,
        socialContextStepArb,
        // How many times to go back (1-3)
        fc.integer({ min: 1, max: 3 }),
        (stepsToFill, a1, a2, a3, a4, backCount) => {
          const answerValues = [a1, a2, a3, a4];

          // Start the check-in
          useCheckinStore.getState().startCheckin();

          // Fill answers up to stepsToFill
          for (let step = 1; step <= stepsToFill; step++) {
            useCheckinStore.setState({ isTransitioning: false });
            useCheckinStore.getState().selectAnswer(step, answerValues[step - 1]);
          }

          // If stepsToFill === 4, complete() fires. Reset state for back-navigation testing.
          if (stepsToFill === 4) {
            useCheckinStore.setState({
              isActive: true,
              currentStep: 4 as 1 | 2 | 3 | 4,
              isTransitioning: false,
            });
          }

          const stepBeforeBack = useCheckinStore.getState().currentStep;

          // Clamp backCount so we don't go below step 1
          const actualBacks = Math.min(backCount, stepBeforeBack - 1);

          // Navigate back
          for (let i = 0; i < actualBacks; i++) {
            useCheckinStore.getState().goBack();
          }

          const state = useCheckinStore.getState();
          const targetStep = stepBeforeBack - actualBacks;

          // Answers at targetStep and earlier should be preserved
          for (let step = 1; step <= targetStep; step++) {
            const field = STEP_FIELDS[step - 1];
            expect(state.answers[field]).toBe(answerValues[step - 1]);
          }

          // Answers after targetStep should be cleared to null
          for (let step = targetStep + 1; step <= 4; step++) {
            const field = STEP_FIELDS[step - 1];
            expect(state.answers[field]).toBeNull();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});


// =============================================================================
// Properties 7, 8, 9: Soft Label, Banned Terms, Display Names
// =============================================================================

// Import emotion config functions for Properties 7, 8, 9
const {
  formatSoftLabel,
  getEmotionDisplayName,
  EMOTION_OPTIONS,
} = require('@/data/emotionConfig');

// =============================================================================
// Property 7: Soft Label Format Compliance
// =============================================================================

describe('Property 7: Soft label format compliance', () => {
  /**
   * Validates: Requirements 4.3, 7.3
   */
  it('formatSoftLabel output matches template "It sounds like you might be feeling {lowercase label} right now" for each of 12 emotions', () => {
    for (const emotion of VALID_EMOTIONS) {
      const result = formatSoftLabel(emotion);
      const displayName = getEmotionDisplayName(emotion).toLowerCase();
      const expected = `It sounds like you might be feeling ${displayName} right now`;

      expect(result).toBe(expected);
    }
  });

  it('formatSoftLabel returns a string starting with "It sounds like" for every emotion', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_EMOTIONS), (emotion) => {
        const result = formatSoftLabel(emotion);
        expect(result).toMatch(/^It sounds like you might be feeling .+ right now$/);
      }),
      { numRuns: 12 },
    );
  });
});

// =============================================================================
// Property 8: No Banned Clinical Terms in User-Facing Strings
// =============================================================================

describe('Property 8: No banned clinical terms in user-facing strings', () => {
  /**
   * Validates: Requirements 7.1
   */

  const BANNED_WORDS: string[] = [
    'assess',
    'evaluate',
    'diagnose',
    'diagnosis',
    'symptom',
    'disorder',
    'pathology',
    'clinical',
    'screening',
    'treatment',
    'patient',
    'condition',
    'prognosis',
    'therapeutic intervention',
    'mental illness',
    'abnormal',
  ];

  // Collect all user-facing strings from the check-in flow
  const USER_FACING_STRINGS: string[] = [
    // Question prompts
    'Right now, my body feels…',
    'Overall, this feels…',
    'My mind is mostly…',
    'Where are you right now?',

    // Question 1 options
    'Very low energy',
    'Low energy',
    'Medium energy',
    'High energy',
    'Very high energy',

    // Question 2 options
    'Mostly unpleasant',
    'Mixed',
    'Mostly pleasant',

    // Question 3 options
    'Racing',
    'Stuck on worries',
    'Stuck on mistakes',
    'Blank',
    'Numb',
    'Curious / interested',
    'Okay / steady',

    // Question 4 options
    'Alone at home',
    'At work',
    'With family',
    'With friends',

    // Progress text pattern
    'Question 1 of 4',
    'Question 2 of 4',
    'Question 3 of 4',
    'Question 4 of 4',

    // Normalizing message
    "It's okay if this isn't perfect — we're just using it as a starting point.",

    // Button labels
    "I'm not sure how I feel",
    'Go back to previous question',
    'Close guided check-in',
  ];

  // Add all soft labels for 12 emotions
  const allSoftLabels: string[] = VALID_EMOTIONS.map((e: EmotionType) => formatSoftLabel(e));

  // Add all emotion display names
  const allDisplayNames: string[] = VALID_EMOTIONS.map((e: EmotionType) => getEmotionDisplayName(e));

  const ALL_STRINGS = [...USER_FACING_STRINGS, ...allSoftLabels, ...allDisplayNames];

  it('no user-facing string in the check-in flow contains any banned clinical term', () => {
    for (const str of ALL_STRINGS) {
      const lowerStr = str.toLowerCase();
      for (const banned of BANNED_WORDS) {
        // Use word boundary matching for single-word banned terms
        // and substring matching for multi-word banned phrases
        if (banned.includes(' ')) {
          expect(lowerStr).not.toContain(banned);
        } else {
          // Match as a whole word (not as a substring of another word)
          const regex = new RegExp(`\\b${banned}\\b`, 'i');
          expect(regex.test(str)).toBe(false);
        }
      }
    }
  });

  it('soft labels for all 12 emotions contain no banned clinical terms', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_EMOTIONS), (emotion) => {
        const softLabel = formatSoftLabel(emotion);
        const lowerLabel = softLabel.toLowerCase();

        for (const banned of BANNED_WORDS) {
          if (banned.includes(' ')) {
            expect(lowerLabel).not.toContain(banned);
          } else {
            const regex = new RegExp(`\\b${banned}\\b`, 'i');
            expect(regex.test(softLabel)).toBe(false);
          }
        }
      }),
      { numRuns: 12 },
    );
  });
});

// =============================================================================
// Property 9: Display Name Completeness
// =============================================================================

describe('Property 9: Display name completeness', () => {
  /**
   * Validates: Requirements 5.4
   */
  it('getEmotionDisplayName returns a non-empty string for every EmotionType', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_EMOTIONS), (emotion) => {
        const displayName = getEmotionDisplayName(emotion);

        expect(typeof displayName).toBe('string');
        expect(displayName.length).toBeGreaterThan(0);
        expect(displayName.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 12 },
    );
  });

  it('every emotion in EMOTION_OPTIONS has a non-empty label matching getEmotionDisplayName', () => {
    // Verify EMOTION_OPTIONS covers all 12 emotions
    const coveredTypes = EMOTION_OPTIONS.map((opt: { type: EmotionType }) => opt.type);
    for (const emotion of VALID_EMOTIONS) {
      expect(coveredTypes).toContain(emotion);
    }

    // Verify each entry has a non-empty label
    for (const opt of EMOTION_OPTIONS) {
      expect(opt.label).toBeDefined();
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});
