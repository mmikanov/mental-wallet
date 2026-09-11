/**
 * Unit tests for BoxBreathingAnimation.
 *
 * Validates: Requirements 1.4, 2.1, 2.4
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import BoxBreathingAnimation from '../BoxBreathingAnimation';

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
});
