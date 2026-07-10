/**
 * Property-based tests for curated library rationale completeness and content rules.
 *
 * Feature: tool-rationale-evidence, Property 9: Curated library completeness
 * Feature: tool-rationale-evidence, Property 13: Distress-related cards reference professional help
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.3**
 *
 * For every card in the CURATED_LIBRARY array, the rationale field SHALL be
 * defined and SHALL pass validateRationaleMetadata without errors.
 *
 * For every card whose emotionTags include "anxious", "angry", or "stressed",
 * at least one researchSummary item SHALL contain a reference to seeking
 * professional help.
 */

import * as fc from 'fast-check';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { validateRationaleMetadata } from '@/utils/rationaleValidation';

// Feature: tool-rationale-evidence, Property 9: Curated library completeness
describe('Property 9: Curated library completeness', () => {
  it('every card in CURATED_LIBRARY has a defined rationale field', () => {
    for (const card of CURATED_LIBRARY) {
      expect(card.rationale).toBeDefined();
      expect(card.rationale).not.toBeNull();
    }
  });

  it('every card rationale passes validateRationaleMetadata without errors', () => {
    for (const card of CURATED_LIBRARY) {
      const result = validateRationaleMetadata(card.rationale!);
      if (!result.isValid) {
        fail(
          `Card "${card.title}" (${card.id}) failed validation:\n` +
            result.errors
              .map((e) => `  - [${e.field}] ${e.message}`)
              .join('\n')
        );
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  it('confirms the curated library contains at least 20 cards', () => {
    expect(CURATED_LIBRARY.length).toBeGreaterThanOrEqual(20);
  });
});


// Feature: tool-rationale-evidence, Property 13: Distress-related cards reference professional help
describe('Property 13: Distress-related cards reference professional help', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * For every card in the CURATED_LIBRARY whose emotionTags include any of
   * "anxious", "angry", or "stressed", at least one item in researchSummary
   * SHALL contain a reference to seeking professional help (verified by presence
   * of keywords like "professional", "therapist", or "clinician").
   */

  const DISTRESS_EMOTIONS = ['anxious', 'angry', 'stressed'] as const;
  const PROFESSIONAL_KEYWORDS = /professional|therapist|clinician/i;

  const distressCards = CURATED_LIBRARY.filter(
    (card) =>
      card.emotionTags?.some((tag) =>
        DISTRESS_EMOTIONS.includes(tag as (typeof DISTRESS_EMOTIONS)[number])
      )
  );

  it('at least one distress-related card exists in CURATED_LIBRARY', () => {
    expect(distressCards.length).toBeGreaterThan(0);
  });

  it('every distress-related card has at least one researchSummary item referencing professional help', () => {
    fc.assert(
      fc.property(fc.constantFrom(...distressCards), (card) => {
        const hasReference = card.rationale!.researchSummary.some((item) =>
          PROFESSIONAL_KEYWORDS.test(item)
        );
        if (!hasReference) {
          throw new Error(
            `Card "${card.title}" (${card.id}) has distress-related emotionTags ` +
              `[${card.emotionTags?.join(', ')}] but none of its researchSummary items ` +
              `contain "professional", "therapist", or "clinician".\n` +
              `researchSummary:\n${card.rationale!.researchSummary.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});
