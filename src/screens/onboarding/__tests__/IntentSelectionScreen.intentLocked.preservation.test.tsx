/**
 * Preservation Property Tests — Forward Transition Button Disabling and Fresh Mount State (Bug 5)
 *
 * **Validates: Requirements 3.13, 3.14, 3.16**
 *
 * Property 2: Preservation - Forward Transition Button Disabling and Fresh Mount State
 *
 * These tests capture BASELINE behavior that must remain unchanged after the fix:
 * - Fresh mount: all buttons enabled, isTransitioning = false
 * - After intent tap (forward transition): all buttons disabled (isTransitioning = true)
 *
 * On UNFIXED code: These tests PASS (confirms baseline behavior to preserve).
 * On FIXED code: These tests should STILL PASS (confirms no regressions).
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as fc from 'fast-check';

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

describe('Bug 5 Preservation: Forward Transition Button Disabling and Fresh Mount State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.13**
   *
   * Property: For all fresh mounts of IntentSelectionScreen (no prior navigation),
   * `isTransitioning` starts as `false` and all intent option buttons are enabled.
   */
  it('fresh mount shows all intent buttons enabled with no pre-selected state', async () => {
    await fc.assert(
      fc.asyncProperty(intentIdArb, async (_intentId: IntentId) => {
        jest.clearAllMocks();

        // Fresh mount — no prior navigation
        const rendered = await act(async () => {
          return render(<IntentSelectionScreen />);
        });

        // All intent option buttons should be enabled (isTransitioning = false)
        for (const opt of INTENT_OPTIONS) {
          const btn = rendered.getByLabelText(`${opt.label}. ${opt.description}`);
          // disabled should be false or undefined (not true)
          expect(btn.props.accessibilityState?.disabled).not.toBe(true);
          // selected should be false (no pre-selected state)
          expect(btn.props.accessibilityState?.selected).toBe(false);
        }

        rendered.unmount();
      }),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 3.14**
   *
   * Property: For all intent selections on a fresh mount, `isTransitioning` becomes
   * `true` immediately after selection — all buttons become disabled during the
   * forward transition to prevent double-taps.
   */
  it('after selecting any intent, all buttons are disabled during forward transition', async () => {
    await fc.assert(
      fc.asyncProperty(intentIdArb, async (intentId: IntentId) => {
        jest.clearAllMocks();

        const intentOption = INTENT_OPTIONS.find((opt) => opt.intentId === intentId)!;
        const rendered = await act(async () => {
          return render(<IntentSelectionScreen />);
        });

        // Initially all buttons are enabled
        const targetButton = rendered.getByLabelText(
          `${intentOption.label}. ${intentOption.description}`
        );
        expect(targetButton.props.accessibilityState?.disabled).not.toBe(true);

        // Press the intent button (triggers handleSelect → sets isTransitioning=true)
        await act(async () => {
          fireEvent.press(targetButton);
        });

        // After pressing, ALL intent buttons should be disabled (isTransitioning = true)
        for (const opt of INTENT_OPTIONS) {
          const btn = rendered.getByLabelText(`${opt.label}. ${opt.description}`);
          expect(btn.props.accessibilityState?.disabled).toBe(true);
        }

        // Clean up timers to avoid interference between runs
        await act(async () => {
          jest.advanceTimersByTime(700);
        });
        await act(async () => {
          await Promise.resolve();
        });

        rendered.unmount();
      }),
      { numRuns: 10 }
    );
  });
});
