/**
 * Unit tests for InsightTooltip component.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 9.4
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { InsightTooltip } from '../InsightTooltip';

describe('InsightTooltip', () => {
  const defaultExplanation =
    'We compare your check-in scores on days you used this tool (and the day before) to days you didn\'t.';

  it('renders the ⓘ trigger icon button', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    expect(screen.getByTestId('insight-tooltip-trigger')).toBeTruthy();
    expect(screen.getByText('ⓘ')).toBeTruthy();
  });

  it('trigger has accessibility label "More information"', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    const trigger = screen.getByTestId('insight-tooltip-trigger');
    expect(trigger.props.accessibilityLabel).toBe('More information');
    expect(trigger.props.accessibilityRole).toBe('button');
  });

  it('trigger has 44×44pt minimum tap target', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    const trigger = screen.getByTestId('insight-tooltip-trigger');
    const style = trigger.props.style;
    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;
    expect(flatStyle.minWidth).toBeGreaterThanOrEqual(44);
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('does not show tooltip content initially', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    // Modal with visible=false is not rendered in the tree
    expect(screen.queryByTestId('insight-tooltip-content')).toBeNull();
    expect(screen.queryByText(defaultExplanation)).toBeNull();
  });

  it('shows tooltip with explanation when trigger is pressed', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    expect(screen.getByTestId('insight-tooltip-content')).toBeTruthy();
    expect(screen.getByText(defaultExplanation)).toBeTruthy();
  });

  it('dismisses tooltip when close button is pressed', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    expect(screen.getByTestId('insight-tooltip-content')).toBeTruthy();

    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-close'));
    });
    // Modal content removed from tree when visible=false
    expect(screen.queryByTestId('insight-tooltip-content')).toBeNull();
  });

  it('dismisses tooltip when backdrop is pressed', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    expect(screen.getByTestId('insight-tooltip-content')).toBeTruthy();

    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-backdrop'));
    });
    // Modal content removed from tree when visible=false
    expect(screen.queryByTestId('insight-tooltip-content')).toBeNull();
  });

  it('shows "Based on limited data" qualifier when isPreliminary is true', async () => {
    await render(
      <InsightTooltip explanation={defaultExplanation} isPreliminary={true} />
    );
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    expect(screen.getByText('Based on limited data')).toBeTruthy();
    expect(screen.getByText(defaultExplanation)).toBeTruthy();
  });

  it('does not show qualifier when isPreliminary is false', async () => {
    await render(
      <InsightTooltip explanation={defaultExplanation} isPreliminary={false} />
    );
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    expect(screen.queryByText('Based on limited data')).toBeNull();
    expect(screen.getByText(defaultExplanation)).toBeTruthy();
  });

  it('does not show qualifier when isPreliminary is not provided', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    expect(screen.queryByText('Based on limited data')).toBeNull();
  });

  it('close button has accessible label', async () => {
    await render(<InsightTooltip explanation={defaultExplanation} />);
    await act(() => {
      fireEvent.press(screen.getByTestId('insight-tooltip-trigger'));
    });
    const closeButton = screen.getByTestId('insight-tooltip-close');
    expect(closeButton.props.accessibilityLabel).toBe('Close');
    expect(closeButton.props.accessibilityRole).toBe('button');
  });
});
