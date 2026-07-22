/**
 * Bug Condition Exploration Test — Crisis Link Does Not Navigate from LibraryToolPreview
 *
 * **Validates: Requirements 7.1, 7.2, 8.1, 8.2**
 *
 * Property 1: Bug Condition — Crisis Link Does Not Navigate from LibraryToolPreview
 *
 * For any distress-related CuratedCardDefinition (with emotion tags containing
 * 'anxious', 'angry', or 'stressed'), when the user opens the rationale sheet
 * and taps "In crisis? Get support →", the onCrisisResourcesPress callback
 * passed to LibraryToolPreview SHALL be invoked.
 *
 * On UNFIXED code: this test MUST FAIL because:
 * - LibraryToolPreview does NOT accept an `onCrisisResourcesPress` prop
 * - The handler passed to RationaleSheet's onCrisisResourcesPress is
 *   `() => setRationaleVisible(false)` — it only dismisses the sheet
 * - No navigation callback is ever triggered
 *
 * Counterexample: "For any distress card X, tapping crisis link only dismisses
 * rationale sheet without calling navigation callback"
 *
 * On FIXED code: this test will PASS (confirming the crisis navigation fix works).
 */

import React from 'react';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react-native';
import * as fc from 'fast-check';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { RationaleMetadata } from '@/types/rationale';
import type { EmotionType } from '@/types/index';

// --- Mocks ---

// Mock ControlRenderer to keep tests focused
jest.mock('@/components/controls/ControlRenderer', () => {
  const React = require('react');
  return function MockControlRenderer() {
    return React.createElement('View', { testID: 'mock-control-renderer' });
  };
});

import LibraryToolPreview from '../LibraryToolPreview';

// --- fast-check arbitraries ---

/** Generate valid RationaleMetadata objects with non-whitespace inANutshell */
const arbRationale: fc.Arbitrary<RationaleMetadata> = fc.record({
  approach: fc.constantFrom(
    'CBT' as const,
    'DBT' as const,
    'ACT' as const,
    'mindfulness-based stress reduction' as const,
    'grounding' as const,
    'somatic techniques' as const
  ),
  inANutshell: fc.constantFrom(
    'Helps reframe negative thought patterns.',
    'Activates the relaxation response through controlled breathing.',
    'Grounds you in the present moment using sensory awareness.',
    'Builds emotional regulation skills through mindful observation.'
  ),
  howItWorks: fc.constantFrom(
    'Engages the prefrontal cortex to evaluate thoughts logically.',
    'Stimulates the vagus nerve to calm the nervous system.',
    'Redirects attention from rumination to immediate sensory input.'
  ),
  evidenceLevel: fc.constantFrom(
    'strong' as const,
    'moderate' as const,
    'emerging' as const,
    'not_specifically_studied' as const
  ),
  researchSummary: fc.tuple(
    fc.constantFrom(
      'Studies show effectiveness in reducing anxiety symptoms.',
      'Research supports use for emotional regulation.'
    ),
    fc.constantFrom(
      'Meta-analyses confirm moderate to large effect sizes.',
      'Clinical trials demonstrate significant symptom improvement.'
    )
  ) as fc.Arbitrary<[string, string]>,
  learnMoreLinks: fc.constant(undefined),
});

/** Distress emotion tags that trigger isDistressRelated in the component */
const DISTRESS_EMOTIONS: EmotionType[] = ['anxious', 'angry', 'stressed'];

/**
 * Generate distress-related CuratedCardDefinition objects.
 * These will have at least one distress emotion tag ('anxious', 'angry', 'stressed')
 * and a valid rationale object (required for RationaleSheet to render).
 */
const arbDistressCard: fc.Arbitrary<CuratedCardDefinition> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).map(
    (s) => `lib-distress-${s.replace(/[^a-z0-9]/gi, 'x')}`
  ),
  title: fc.constantFrom(
    'Deep Breathing',
    'Progressive Relaxation',
    'Grounding Exercise',
    'Crisis Coping Plan',
    'Emotional Check-In'
  ),
  description: fc.constantFrom(
    'A calming technique to manage acute stress and anxiety.',
    'Systematically relax muscle groups to release tension.',
    'Use your senses to anchor yourself in the present.',
    'Structured steps for when emotions feel overwhelming.',
    'Check in with your feelings and physical sensations.'
  ),
  iconType: fc.constant('emoji' as const),
  iconValue: fc.constantFrom('😰', '😤', '😨', '🆘', '💔', '🌊'),
  backgroundType: fc.constant('color' as const),
  backgroundValue: fc.constantFrom('#FEF2F2', '#FEE2E2', '#FECACA'),
  categoryId: fc.constantFrom('grounding-calming', 'body-sensory'),
  allowBackgroundCustomization: fc.boolean(),
  controls: fc.array(
    fc.record({
      type: fc.constantFrom('static_text', 'text_input') as fc.Arbitrary<any>,
      position: fc.nat({ max: 3 }),
      config: fc.constant({ label: 'Test', body: 'Test content', fontSize: 'medium' } as any),
      isRequired: fc.boolean(),
    }),
    { minLength: 0, maxLength: 2 }
  ),
  emotionTags: fc
    .subarray(DISTRESS_EMOTIONS, { minLength: 1, maxLength: 3 })
    .map((tags) => tags as EmotionType[]),
  contextTags: fc.constant(['alone_at_home'] as any),
  timeTags: fc.constant(['5_10_min'] as any),
  rationale: arbRationale,
});

describe('Bug Condition: Crisis Link Does Not Navigate from LibraryToolPreview', () => {
  /**
   * **Validates: Requirements 7.1, 7.2, 8.1, 8.2**
   *
   * Property: For any distress-related CuratedCardDefinition, when the user:
   * 1. Opens the rationale sheet (taps "Learn more")
   * 2. Taps "In crisis? Get support →"
   *
   * Then the `onCrisisResourcesPress` callback prop SHALL be invoked.
   *
   * On UNFIXED code this FAILS because:
   * - LibraryToolPreview does NOT have an `onCrisisResourcesPress` prop
   * - The handler passed to RationaleSheet is `() => setRationaleVisible(false)`
   * - Only the rationale sheet is dismissed; no callback is triggered
   *
   * Counterexample: "For any distress card X, tapping crisis link only dismisses
   * rationale sheet without calling navigation callback"
   */
  it('onCrisisResourcesPress callback is invoked when crisis link is tapped', async () => {
    await fc.assert(
      fc.asyncProperty(arbDistressCard, async (generatedCard) => {
        const mockOnCrisisResourcesPress = jest.fn();

        await render(
          <LibraryToolPreview
            card={generatedCard}
            onClose={jest.fn()}
            onAddToWallet={jest.fn()}
            isAddedToWallet={false}
            // This prop doesn't exist on unfixed code — it will be ignored
            // but the key assertion is that the callback IS called when
            // the crisis link is tapped (which it won't be on unfixed code)
            {...({ onCrisisResourcesPress: mockOnCrisisResourcesPress } as any)}
          />
        );

        // Step 1: Open the rationale sheet by pressing "Learn more"
        const learnMoreLink = screen.getByLabelText('Learn more about why this might help');
        fireEvent.press(learnMoreLink);

        // Step 2: Find and tap the crisis link "In crisis? Get support →"
        // RationaleSheet renders inside a Modal; after state update
        // the crisis link should appear since the card is distress-related
        const crisisLink = await screen.findByLabelText('Crisis support resources');
        fireEvent.press(crisisLink);

        // ASSERTION: The onCrisisResourcesPress callback must have been invoked.
        //
        // On UNFIXED code, this FAILS because:
        // - The `onCrisisResourcesPress` prop is not part of LibraryToolPreviewProps
        // - Even if passed via spread, it is never read or called by the component
        // - The RationaleSheet's onCrisisResourcesPress handler is hardcoded to
        //   `() => setRationaleVisible(false)` — it only dismisses the sheet
        // - mockOnCrisisResourcesPress is NEVER called
        expect(mockOnCrisisResourcesPress).toHaveBeenCalled();

        // Cleanup for next iteration — wait for state updates to flush
        await waitFor(() => {});
        await cleanup();
      }),
      { numRuns: 20 }
    );
  });
});
