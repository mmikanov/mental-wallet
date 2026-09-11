/**
 * Unit tests for BoxBreathingAnimation.
 *
 * Validates: Requirements 1.4, 2.1, 2.4
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import BoxBreathingAnimation, { derivePacerState } from '../BoxBreathingAnimation';

// --- Mock react-native-reanimated ---
jest.mock('react-native-reanimated', () => {
  const mockReact = require('react');
  const mockAnimatedView = mockReact.forwardRef((props: any, _ref: any) =>
    mockReact.createElement('View', props, props.children)
  );
  return {
    __esModule: true,
    default: { View: mockAnimatedView },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: (val: any) => val,
    withSequence: (...args: any[]) => args[args.length - 1],
    withRepeat: (val: any) => val,
    cancelAnimation: () => {},
    Easing: { inOut: () => () => 0, ease: () => 0 },
  };
});

describe('BoxBreathingAnimation', () => {
  const realIsReduceMotion = AccessibilityInfo.isReduceMotionEnabled;
  const realAddListener = AccessibilityInfo.addEventListener;

  afterEach(() => {
    (AccessibilityInfo as any).isReduceMotionEnabled = realIsReduceMotion;
    (AccessibilityInfo as any).addEventListener = realAddListener;
    jest.clearAllMocks();
  });

  function mockReduceMotion(enabled: boolean) {
    (AccessibilityInfo as any).isReduceMotionEnabled = jest
      .fn()
      .mockResolvedValue(enabled);
    (AccessibilityInfo as any).addEventListener = jest
      .fn()
      .mockReturnValue({ remove: jest.fn() });
  }

  it('renders without throwing (motion enabled)', async () => {
    mockReduceMotion(false);
    await render(<BoxBreathingAnimation />);
    await waitFor(() => {
      expect(screen.getByLabelText(/box breathing pacer/i)).toBeTruthy();
    });
  });

  it('exposes an accessibility label describing the pacer', async () => {
    mockReduceMotion(false);
    await render(<BoxBreathingAnimation />);
    await waitFor(() => {
      expect(screen.getByLabelText(/box breathing pacer/i)).toBeTruthy();
    });
  });

  it('renders a non-animating static branch when reduce motion is on', async () => {
    mockReduceMotion(true);
    await render(<BoxBreathingAnimation />);
    // Static branch shows the descriptive slow-breathing hint rather than a
    // single cycling phase word.
    await waitFor(() => {
      expect(screen.getByText(/breathe slowly/i)).toBeTruthy();
    });
  });

  it('renders an optional label when provided', async () => {
    mockReduceMotion(false);
    await render(<BoxBreathingAnimation label="Follow along" />);
    await waitFor(() => {
      expect(screen.getByText('Follow along')).toBeTruthy();
    });
  });

  it('starts on the first second of inhale (count 1) and cycle 1', async () => {
    mockReduceMotion(false);
    await render(<BoxBreathingAnimation />);
    await waitFor(() => {
      expect(screen.getByText('Breathe in')).toBeTruthy();
    });
    // Inhale counts up: first second shows 1. The count lives inside an
    // accessibility-hidden stage, so include hidden elements in the query.
    expect(screen.getByText('1', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Cycle 1 of 4')).toBeTruthy();
  });

});

describe('derivePacerState (timing math)', () => {
  it('counts up 1..4 across the inhale phase', () => {
    expect(derivePacerState(0).count).toBe(1);
    expect(derivePacerState(1).count).toBe(2);
    expect(derivePacerState(2).count).toBe(3);
    expect(derivePacerState(3).count).toBe(4);
    for (let s = 0; s < 4; s++) {
      expect(derivePacerState(s).phaseIndex).toBe(0); // inhale
      expect(derivePacerState(s).cycleIndex).toBe(0);
    }
  });

  it('alternates direction each phase: up, down, up, down', () => {
    // Phase 0 inhale = up (1..4), phase 1 first hold = down (4..1),
    // phase 2 exhale = up (1..4), phase 3 second hold = down (4..1).
    expect(derivePacerState(0).count).toBe(1); // inhale start
    expect(derivePacerState(3).count).toBe(4); // inhale end

    expect(derivePacerState(4).phaseIndex).toBe(1); // first hold
    expect(derivePacerState(4).count).toBe(4);
    expect(derivePacerState(7).count).toBe(1);

    expect(derivePacerState(8).phaseIndex).toBe(2); // exhale
    expect(derivePacerState(8).count).toBe(1);
    expect(derivePacerState(11).count).toBe(4);

    expect(derivePacerState(12).phaseIndex).toBe(3); // second hold
    expect(derivePacerState(12).count).toBe(4);
    expect(derivePacerState(15).count).toBe(1);
  });

  it('advances the cycle index every full 16s cycle and wraps after 4', () => {
    expect(derivePacerState(0).cycleIndex).toBe(0); // cycle 1
    expect(derivePacerState(16).cycleIndex).toBe(1); // cycle 2
    expect(derivePacerState(32).cycleIndex).toBe(2); // cycle 3
    expect(derivePacerState(48).cycleIndex).toBe(3); // cycle 4
    // 4 cycles = 64s; wraps back to cycle 1.
    expect(derivePacerState(64).cycleIndex).toBe(0);
    expect(derivePacerState(64).phaseIndex).toBe(0);
    expect(derivePacerState(64).count).toBe(1);
  });
});
