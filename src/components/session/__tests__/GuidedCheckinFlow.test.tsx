/**
 * GuidedCheckinFlow unit tests.
 *
 * Validates: Requirements 2.1, 2.8, 2.9, 2.13
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { useCheckinStore } from '@/stores/checkinStore';
import GuidedCheckinFlow from '../GuidedCheckinFlow';

// --- Mock react-native-reanimated ---
jest.mock('react-native-reanimated', () => {
  const mockReact = require('react');
  const mockAnimatedView = mockReact.forwardRef((props: any, _ref: any) =>
    mockReact.createElement('View', props, props.children)
  );
  const mockAnimatedText = mockReact.forwardRef((props: any, _ref: any) =>
    mockReact.createElement('Text', props, props.children)
  );
  return {
    __esModule: true,
    default: { View: mockAnimatedView, Text: mockAnimatedText },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: (val: any, _cfg?: any, cb?: any) => {
      if (cb) cb(true);
      return val;
    },
    withSequence: (...args: any[]) => args[args.length - 1],
    withSpring: (val: any) => val,
    runOnJS: (fn: any) => fn,
    Easing: { out: () => undefined, in: () => undefined, linear: undefined, ease: undefined },
    SlideInRight: { duration: () => ({ duration: () => ({}) }) },
    SlideOutLeft: { duration: () => ({ duration: () => ({}) }) },
  };
});

// --- Spy on AccessibilityInfo ---
import { AccessibilityInfo } from 'react-native';
jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});

describe('GuidedCheckinFlow', () => {
  const mockOnDismiss = jest.fn();
  const mockOnAccept = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Reset store to initial state before each test
    act(() => {
      useCheckinStore.setState({
        isActive: true,
        currentStep: 1,
        answers: {
          bodyEnergy: null,
          pleasantness: null,
          thoughtPattern: null,
          context: null,
        },
        topFeelings: [],
        isTransitioning: false,
      });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders first question prompt "Right now, my body feels…"', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Right now, my body feels…');
    act(() => { tree!.unmount(); });
  });

  it('completes all 4 questions in order and sets topFeelings', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });

    // Step 1: select body energy
    act(() => {
      useCheckinStore.getState().selectAnswer(1, 'high');
      jest.runAllTimers();
    });
    // Clear transition to allow next selection
    act(() => {
      useCheckinStore.setState({ isTransitioning: false });
    });

    // Verify step 2
    expect(useCheckinStore.getState().currentStep).toBe(2);

    // Step 2: select pleasantness
    act(() => {
      useCheckinStore.getState().selectAnswer(2, 'unpleasant');
      jest.runAllTimers();
    });
    act(() => {
      useCheckinStore.setState({ isTransitioning: false });
    });

    // Verify step 3
    expect(useCheckinStore.getState().currentStep).toBe(3);

    // Step 3: select thought pattern
    act(() => {
      useCheckinStore.getState().selectAnswer(3, 'racing');
      jest.runAllTimers();
    });
    act(() => {
      useCheckinStore.setState({ isTransitioning: false });
    });

    // Verify step 4
    expect(useCheckinStore.getState().currentStep).toBe(4);

    // Step 4: select context (this triggers complete)
    act(() => {
      useCheckinStore.getState().selectAnswer(4, 'at_work');
      jest.runAllTimers();
    });

    // After all 4 questions, topFeelings should be set
    const { topFeelings } = useCheckinStore.getState();
    expect(topFeelings.length).toBeGreaterThan(0);
    expect(typeof topFeelings[0]).toBe('string');

    act(() => { tree!.unmount(); });
  });

  it('back navigation works: pressing back on step 2+ returns to previous question', () => {
    // Start at step 2
    act(() => {
      useCheckinStore.setState({
        currentStep: 2,
        answers: {
          bodyEnergy: 'medium',
          pleasantness: null,
          thoughtPattern: null,
          context: null,
        },
        topFeelings: [],
        isTransitioning: false,
      });
    });

    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });

    // Find the back button by its accessibilityLabel
    const root = tree!.root;
    const backButton = root.findAll(
      (node) => node.props.accessibilityLabel === 'Go back to previous question'
    )[0];
    expect(backButton).toBeDefined();

    // Press back
    act(() => {
      backButton.props.onPress();
    });

    // Should be back on step 1
    expect(useCheckinStore.getState().currentStep).toBe(1);

    act(() => { tree!.unmount(); });
  });

  it('dismiss returns to picker: close button calls onDismiss and resets store', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });

    // Find the close button
    const root = tree!.root;
    const closeButton = root.findAll(
      (node) => node.props.accessibilityLabel === 'Close guided check-in'
    )[0];
    expect(closeButton).toBeDefined();

    // Press close
    act(() => {
      closeButton.props.onPress();
      jest.runAllTimers();
    });

    // onDismiss should be called
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);

    // Store should be reset
    const state = useCheckinStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.currentStep).toBe(1);
    expect(state.answers.bodyEnergy).toBeNull();
    expect(state.topFeelings).toEqual([]);

    act(() => { tree!.unmount(); });
  });

  it('back button is not shown on step 1', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });

    const root = tree!.root;
    const backButtons = root.findAll(
      (node) => node.props.accessibilityLabel === 'Go back to previous question'
    );
    expect(backButtons).toHaveLength(0);

    act(() => { tree!.unmount(); });
  });

  it('close button is shown on all steps', () => {
    // Test step 1
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });
    let root = tree!.root;
    let closeButtons = root.findAll(
      (node) => node.props.accessibilityLabel === 'Close guided check-in'
    );
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    act(() => { tree!.unmount(); });

    // Test step 2
    act(() => {
      useCheckinStore.setState({
        currentStep: 2,
        isTransitioning: false,
        answers: { bodyEnergy: 'medium', pleasantness: null, thoughtPattern: null, context: null },
      });
    });
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });
    root = tree!.root;
    closeButtons = root.findAll(
      (node) => node.props.accessibilityLabel === 'Close guided check-in'
    );
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    act(() => { tree!.unmount(); });

    // Test step 3
    act(() => {
      useCheckinStore.setState({
        currentStep: 3,
        isTransitioning: false,
        answers: { bodyEnergy: 'medium', pleasantness: 'unpleasant', thoughtPattern: null, context: null },
      });
    });
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });
    root = tree!.root;
    closeButtons = root.findAll(
      (node) => node.props.accessibilityLabel === 'Close guided check-in'
    );
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    act(() => { tree!.unmount(); });

    // Test step 4
    act(() => {
      useCheckinStore.setState({
        currentStep: 4,
        isTransitioning: false,
        answers: { bodyEnergy: 'medium', pleasantness: 'unpleasant', thoughtPattern: 'racing', context: null },
      });
    });
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });
    root = tree!.root;
    closeButtons = root.findAll(
      (node) => node.props.accessibilityLabel === 'Close guided check-in'
    );
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    act(() => { tree!.unmount(); });
  });

  it('transition locking prevents double-advance', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<GuidedCheckinFlow onDismiss={mockOnDismiss} onAccept={mockOnAccept} />);
    });

    // Select answer on step 1 — this sets isTransitioning = true
    act(() => {
      useCheckinStore.getState().selectAnswer(1, 'high');
    });

    // isTransitioning should be true now
    expect(useCheckinStore.getState().isTransitioning).toBe(true);

    // Try to select again while transitioning — should be ignored
    act(() => {
      useCheckinStore.getState().selectAnswer(2, 'unpleasant');
    });

    // Should still be on step 2 (from the first advance), not step 3
    // and pleasantness should not be set because the second call was blocked
    expect(useCheckinStore.getState().currentStep).toBe(2);
    expect(useCheckinStore.getState().answers.pleasantness).toBeNull();

    act(() => {
      jest.runAllTimers();
      tree!.unmount();
    });
  });
});
