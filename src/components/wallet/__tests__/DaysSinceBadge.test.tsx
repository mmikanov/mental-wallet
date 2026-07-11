/**
 * Unit tests for DaysSinceBadge component.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 3.5, 4.4
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { DaysSinceBadge } from '../DaysSinceBadge';

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
    withSpring: (val: any) => val,
  };
});

describe('DaysSinceBadge', () => {
  it('renders nothing when daysElapsed is null', async () => {
    const result = await render(<DaysSinceBadge daysElapsed={null} />);
    expect(result.toJSON()).toBeNull();
  });

  it('renders nothing when daysElapsed is 0', async () => {
    const result = await render(<DaysSinceBadge daysElapsed={0} />);
    expect(result.toJSON()).toBeNull();
  });

  it('renders badge with correct text when daysElapsed >= 1', async () => {
    const result = await render(<DaysSinceBadge daysElapsed={5} />);
    const tree = result.toJSON() as any;
    // Badge renders as View > Text with the days count
    const textNode = tree?.children?.[0];
    expect(textNode?.children).toContain('5');
  });

  it('shows "99+" when daysElapsed > 99', async () => {
    const result = await render(<DaysSinceBadge daysElapsed={150} />);
    const tree = result.toJSON() as any;
    const textNode = tree?.children?.[0];
    expect(textNode?.children).toContain('99+');
  });

  it('badge has pointerEvents none', async () => {
    const result = await render(<DaysSinceBadge daysElapsed={3} />);
    const tree = result.toJSON();
    expect(tree?.props?.pointerEvents).toBe('none');
  });
});
