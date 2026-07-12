/**
 * CheckinProgressIndicator unit tests.
 *
 * Validates: Requirements 2.7, 8.4
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import CheckinProgressIndicator from '../CheckinProgressIndicator';

describe('CheckinProgressIndicator', () => {
  it('renders 4 dots by default', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<CheckinProgressIndicator currentStep={1} />);
    });
    const root = tree!.root;
    // The dots row contains View children (the dots)
    const container = root.findAll(
      (node) => node.props.accessibilityLiveRegion === 'polite'
    )[0];
    expect(container).toBeDefined();

    // Find the dots row and count dot Views
    const allViews = root.findAllByType('View' as any);
    // Dots are the smallest Views with width/height 8
    const dots = allViews.filter(
      (v) => v.props.style && Array.isArray(v.props.style)
    );
    expect(dots).toHaveLength(4);
  });

  it('displays "Question N of 4" text for each step', () => {
    for (const step of [1, 2, 3, 4] as const) {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<CheckinProgressIndicator currentStep={step} />);
      });
      const json = JSON.stringify(tree!.toJSON());
      expect(json).toContain(`Question ${step} of 4`);
    }
  });

  it('sets accessibilityLabel to "Question N of 4"', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<CheckinProgressIndicator currentStep={2} />);
    });
    const root = tree!.root;
    const liveRegion = root.findAll(
      (node) => node.props.accessibilityLiveRegion === 'polite'
    )[0];
    expect(liveRegion.props.accessibilityLabel).toBe('Question 2 of 4');
  });

  it('uses accessibilityLiveRegion="polite" for screen reader announcements', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<CheckinProgressIndicator currentStep={3} />);
    });
    const root = tree!.root;
    const liveRegion = root.findAll(
      (node) => node.props.accessibilityLiveRegion === 'polite'
    )[0];
    expect(liveRegion).toBeDefined();
    expect(liveRegion.props.accessibilityLiveRegion).toBe('polite');
  });

  it('accepts a custom totalSteps prop', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <CheckinProgressIndicator currentStep={2} totalSteps={6} />
      );
    });
    const root = tree!.root;
    const liveRegion = root.findAll(
      (node) => node.props.accessibilityLiveRegion === 'polite'
    )[0];
    expect(liveRegion.props.accessibilityLabel).toBe('Question 2 of 6');
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Question 2 of 6');
  });
});
