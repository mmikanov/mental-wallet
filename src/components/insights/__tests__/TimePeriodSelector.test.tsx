/**
 * Unit tests for TimePeriodSelector component.
 *
 * Validates: Requirements 4.6, 5.9, 9.4
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TimePeriodSelector } from '../TimePeriodSelector';
import type { TimePeriod } from '@/services/tierEvaluator';

describe('TimePeriodSelector', () => {
  const mockOnPeriodChange = jest.fn();

  afterEach(() => {
    mockOnPeriodChange.mockClear();
  });

  it('renders all available periods with correct labels', async () => {
    const periods: TimePeriod[] = ['7d', '30d', '90d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="7d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    expect(result.getByText('7 days')).toBeTruthy();
    expect(result.getByText('30 days')).toBeTruthy();
    expect(result.getByText('90 days')).toBeTruthy();
    expect(result.getByText('All time')).toBeTruthy();
  });

  it('renders nascent tier options (7d, all)', async () => {
    const periods: TimePeriod[] = ['7d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="7d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    expect(result.getByText('7 days')).toBeTruthy();
    expect(result.getByText('All time')).toBeTruthy();
    expect(result.queryByText('30 days')).toBeNull();
    expect(result.queryByText('90 days')).toBeNull();
  });

  it('renders preliminary tier options (7d, 30d, all)', async () => {
    const periods: TimePeriod[] = ['7d', '30d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="7d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    expect(result.getByText('7 days')).toBeTruthy();
    expect(result.getByText('30 days')).toBeTruthy();
    expect(result.getByText('All time')).toBeTruthy();
    expect(result.queryByText('90 days')).toBeNull();
  });

  it('calls onPeriodChange when a segment is pressed', async () => {
    const periods: TimePeriod[] = ['7d', '30d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="7d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    await act(() => {
      fireEvent.press(result.getByText('30 days'));
    });
    expect(mockOnPeriodChange).toHaveBeenCalledWith('30d');
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(1);
  });

  it('calls onPeriodChange with correct period for each option', async () => {
    const periods: TimePeriod[] = ['7d', '30d', '90d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="7d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    await act(() => {
      fireEvent.press(result.getByText('All time'));
    });
    expect(mockOnPeriodChange).toHaveBeenCalledWith('all');

    await act(() => {
      fireEvent.press(result.getByText('90 days'));
    });
    expect(mockOnPeriodChange).toHaveBeenCalledWith('90d');
  });

  it('marks selected segment with correct accessibility state', async () => {
    const periods: TimePeriod[] = ['7d', '30d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="30d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    // Navigate to parent (TouchableOpacity) via text children
    const selectedText = result.getByText('30 days');
    const selectedParent = selectedText.parent;
    expect(selectedParent?.props.accessibilityState).toMatchObject({ selected: true });
    expect(selectedParent?.props.accessibilityRole).toBe('tab');

    const unselectedText = result.getByText('7 days');
    const unselectedParent = unselectedText.parent;
    expect(unselectedParent?.props.accessibilityState).toMatchObject({ selected: false });
    expect(unselectedParent?.props.accessibilityRole).toBe('tab');
  });

  it('segments have minimum 44pt height for tap targets', async () => {
    const periods: TimePeriod[] = ['7d', 'all'];
    const result = await render(
      <TimePeriodSelector
        availablePeriods={periods}
        selectedPeriod="7d"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    const text = result.getByText('7 days');
    const parent = text.parent;
    const styles = parent?.props.style;
    const flatStyle = Array.isArray(styles)
      ? Object.assign({}, ...styles.filter(Boolean))
      : styles;
    expect(flatStyle?.minHeight).toBeGreaterThanOrEqual(44);
  });

  /**
   * Property 3: Disabled segments do not trigger period change callback
   * Validates: Requirements 3.3, 3.5
   */
  describe('disabled periods behavior', () => {
    it('does NOT call onPeriodChange when a disabled segment is pressed', async () => {
      const periods: TimePeriod[] = ['7d', '30d', 'all'];
      const result = await render(
        <TimePeriodSelector
          availablePeriods={periods}
          selectedPeriod="all"
          onPeriodChange={mockOnPeriodChange}
          disabledPeriods={['7d', '30d']}
        />
      );

      await act(() => {
        fireEvent.press(result.getByTestId('period-segment-7d'));
      });
      expect(mockOnPeriodChange).not.toHaveBeenCalled();

      await act(() => {
        fireEvent.press(result.getByTestId('period-segment-30d'));
      });
      expect(mockOnPeriodChange).not.toHaveBeenCalled();
    });

    it('DOES call onPeriodChange when an enabled segment is pressed (control test)', async () => {
      const periods: TimePeriod[] = ['7d', '30d', 'all'];
      const result = await render(
        <TimePeriodSelector
          availablePeriods={periods}
          selectedPeriod="all"
          onPeriodChange={mockOnPeriodChange}
          disabledPeriods={['7d', '30d']}
        />
      );

      await act(() => {
        fireEvent.press(result.getByTestId('period-segment-all'));
      });
      expect(mockOnPeriodChange).toHaveBeenCalledWith('all');
      expect(mockOnPeriodChange).toHaveBeenCalledTimes(1);
    });

    it('has accessibilityState.disabled=true on disabled segments', async () => {
      const periods: TimePeriod[] = ['7d', '30d', 'all'];
      const result = await render(
        <TimePeriodSelector
          availablePeriods={periods}
          selectedPeriod="all"
          onPeriodChange={mockOnPeriodChange}
          disabledPeriods={['7d']}
        />
      );

      const disabledSegment = result.getByTestId('period-segment-7d');
      expect(disabledSegment.props.accessibilityState).toMatchObject({ disabled: true });
    });

    it('renders disabled segments with reduced opacity style', async () => {
      const periods: TimePeriod[] = ['7d', '30d', 'all'];
      const result = await render(
        <TimePeriodSelector
          availablePeriods={periods}
          selectedPeriod="all"
          onPeriodChange={mockOnPeriodChange}
          disabledPeriods={['7d']}
        />
      );

      const disabledSegment = result.getByTestId('period-segment-7d');
      const styles = disabledSegment.props.style;
      const flatStyle = Array.isArray(styles)
        ? Object.assign({}, ...styles.filter(Boolean))
        : styles;
      expect(flatStyle?.opacity).toBe(0.4);
    });
  });
});
