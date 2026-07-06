/**
 * Bug Condition Exploration Test — Intent Selection Locked After Back-Navigation (Bug 5)
 *
 * **Validates: Requirements 1.9, 1.10**
 *
 * Property 1: Bug Condition - Intent Selection Locked After Back-Navigation
 *
 * This test asserts the EXPECTED (fixed) behavior:
 * - When IntentSelectionScreen regains focus after back-navigation from KpiSelection,
 *   `isTransitioning` resets to `false` and all intent buttons become enabled.
 *
 * On UNFIXED code: `isTransitioning` remains `true` after back-navigation —
 * all buttons stay disabled — this test FAILS (confirms the bug exists).
 *
 * On FIXED code: `useFocusEffect` resets `isTransitioning` to `false` on re-focus —
 * this test will PASS (confirms the bug is resolved).
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as fc from 'fast-check';

// --- Track useFocusEffect callbacks for re-invocation (simulate back-nav re-focus) ---
const mockFocusEffectCbs: Array<() => void | (() => void)> = [];

// --- Navigation mocks ---
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      // Capture callbacks so we can re-invoke them to simulate screen re-focus
      mockFocusEffectCbs.push(cb);
      // Execute immediately on mount (simulates initial focus)
      const React = require('react');
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

// --- Onboarding store mock ---
jest.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: jest.fn((selector?: (state: any) => any) => {
    const state = {
      completeOnboardingScreens: jest.fn().mockResolvedValue(undefined),
    };
    if (selector) return selector(state);
    return state;
  }),
}));

// --- Onboarding service mock ---
const mockSeedStarterCards = jest.fn().mockResolvedValue(undefined);
const mockClearStarterCards = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/onboardingService', () => ({
  createOnboardingService: () => ({
    seedStarterCards: mockSeedStarterCards,
    clearStarterCards: mockClearStarterCards,
  }),
}));

// --- Analytics mock ---
jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

// --- Mock react-native-safe-area-context ---
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('View', props, props.children),
  };
});

jest.useFakeTimers();

import IntentSelectionScreen from '../IntentSelectionScreen';
import { INTENT_OPTIONS, type IntentId } from '@/data/onboardingConfig';

// Arbitrary that generates valid IntentId values
const intentIdArb = fc.constantFrom<IntentId>('overwhelm', 'routine', 'organize', 'explore');

describe('Bug 5 Exploration: Intent Selection Locked After Back-Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffectCbs.length = 0;
  });

  /**
   * **Validates: Requirements 1.9, 1.10**
   *
   * Property: For any IntentId selection, after the user selects an intent
   * (setting isTransitioning=true) and then navigates back (screen re-focus),
   * `isTransitioning` SHALL reset to `false` and all buttons SHALL be enabled.
   *
   * On UNFIXED code this FAILS because there is no useFocusEffect or navigation
   * listener to reset isTransitioning — all buttons remain disabled after back-nav.
   */
  it('after selecting any intent and simulating back-navigation re-focus, all buttons become enabled', async () => {
    await fc.assert(
      fc.asyncProperty(intentIdArb, async (intentId: IntentId) => {
        jest.clearAllMocks();
        mockFocusEffectCbs.length = 0;

        // Step 1: Render the screen
        const intentOption = INTENT_OPTIONS.find((opt) => opt.intentId === intentId)!;
        const { getByLabelText, unmount } = await render(<IntentSelectionScreen />);

        // Step 2: Confirm the target button is initially enabled
        const targetButton = getByLabelText(
          `${intentOption.label}. ${intentOption.description}`
        );
        expect(targetButton.props.accessibilityState?.disabled).not.toBe(true);

        // Step 3: Press the intent button (triggers handleSelect → sets isTransitioning=true)
        await act(async () => {
          fireEvent.press(targetButton);
        });

        // Step 4: Verify buttons are now disabled (isTransitioning = true)
        // After pressing, all intent buttons should have disabled state
        for (const opt of INTENT_OPTIONS) {
          const btn = getByLabelText(`${opt.label}. ${opt.description}`);
          expect(btn.props.accessibilityState?.disabled).toBe(true);
        }

        // Step 5: Advance past the 600ms timeout and let async operations settle
        // (simulates the time between selection and navigation to KpiSelection)
        await act(async () => {
          jest.advanceTimersByTime(700);
        });
        await act(async () => {
          await Promise.resolve();
        });

        // Step 6: Simulate back-navigation re-focus
        // In the real app, React Navigation re-invokes useFocusEffect callbacks
        // when the screen regains focus after back-navigation from KpiSelection.
        await act(async () => {
          for (const cb of mockFocusEffectCbs) {
            cb();
          }
        });
        await act(async () => {
          await Promise.resolve();
        });

        // Step 7: ASSERT — After re-focus, ALL buttons should be ENABLED
        //
        // On UNFIXED code: the component does NOT use useFocusEffect at all,
        // so no callback is registered (mockFocusEffectCbs is empty or contains
        // no relevant reset). isTransitioning remains `true` → buttons stay
        // disabled → this assertion FAILS (proving the bug exists).
        for (const opt of INTENT_OPTIONS) {
          const btn = getByLabelText(`${opt.label}. ${opt.description}`);
          expect(btn.props.accessibilityState?.disabled).not.toBe(true);
        }

        unmount();
      }),
      { numRuns: 10 }
    );
  });
});
