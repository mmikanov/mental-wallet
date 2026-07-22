/**
 * Unit tests for DualAxisChart component.
 *
 * Validates: Requirements 5.8, 9.1, 9.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DualAxisChart from '../DualAxisChart';

describe('DualAxisChart', () => {
  const defaultProps = {
    weeklyAvgScore: [5.2, 6.1, 6.8, 7.3],
    weeklyTotalDurationMin: [15, 22, 30, 28],
    overallTrend: 'positive' as const,
    summaryText: 'Weeks where you practiced more tended to have higher check-in scores.',
  };

  it('renders the chart with relative week labels ending in Now', async () => {
    await render(<DualAxisChart {...defaultProps} />);

    expect(screen.getByText('-3w')).toBeTruthy();
    expect(screen.getByText('-2w')).toBeTruthy();
    expect(screen.getByText('-1w')).toBeTruthy();
    // Last label is always "Now" to indicate most recent week
    expect(screen.getByText('Now')).toBeTruthy();
  });

  it('renders the chart without crashing when summaryText is provided', async () => {
    await render(<DualAxisChart {...defaultProps} />);

    // summaryText is passed but not currently rendered visually (used for accessibility)
    expect(screen.getByText('Check-in score')).toBeTruthy();
  });

  it('renders the legend with both series labels', async () => {
    await render(<DualAxisChart {...defaultProps} />);

    expect(screen.getByText('Check-in score')).toBeTruthy();
    expect(screen.getByText('Practice time')).toBeTruthy();
  });

  it('provides accessible description with positive trend', async () => {
    await render(<DualAxisChart {...defaultProps} />);

    const chartView = screen.getByLabelText(/trending upward over 4 weeks/);
    expect(chartView).toBeTruthy();
    expect(chartView.props.accessibilityRole).toBe('image');
  });

  it('provides accessible description for negative trend', async () => {
    await render(
      <DualAxisChart {...defaultProps} overallTrend="negative" />
    );

    const chartView = screen.getByLabelText(/trending downward over 4 weeks/);
    expect(chartView).toBeTruthy();
  });

  it('provides accessible description for neutral trend', async () => {
    await render(
      <DualAxisChart {...defaultProps} overallTrend="neutral" />
    );

    const chartView = screen.getByLabelText(/remaining steady over 4 weeks/);
    expect(chartView).toBeTruthy();
  });

  it('includes score and duration values in accessible description', async () => {
    await render(<DualAxisChart {...defaultProps} />);

    const chartView = screen.getByLabelText(/from 5.2 to 7.3/);
    expect(chartView).toBeTruthy();
    expect(chartView.props.accessibilityLabel).toContain('15 minutes');
    expect(chartView.props.accessibilityLabel).toContain('28 minutes');
  });

  it('returns null when no data is provided', async () => {
    const result = await render(
      <DualAxisChart
        weeklyAvgScore={[]}
        weeklyTotalDurationMin={[]}
        overallTrend="neutral"
        summaryText="No data yet."
      />
    );

    expect(result.toJSON()).toBeNull();
  });

  it('renders a single week with Now label', async () => {
    await render(
      <DualAxisChart
        weeklyAvgScore={[7.0]}
        weeklyTotalDurationMin={[20]}
        overallTrend="neutral"
        summaryText="Just getting started."
      />
    );

    // Single week still shows "Now" since it's the most recent
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByLabelText(/over 1 week/)).toBeTruthy();
  });

  it('renders the accessible wrapper with accessible={true}', async () => {
    await render(<DualAxisChart {...defaultProps} />);

    const chartView = screen.getByLabelText(/Line chart/);
    expect(chartView.props.accessible).toBe(true);
  });

  describe('adaptive granularity', () => {
    /**
     * Validates: Requirements 5.1, 5.5
     * Test: 7d period produces daily buckets with day-name labels
     */
    it('renders day-name labels for daily granularity with 7 data points', async () => {
      await render(
        <DualAxisChart
          weeklyAvgScore={[5, 6, 7, 5, 6, 7, 8]}
          weeklyTotalDurationMin={[10, 15, 20, 12, 18, 22, 25]}
          overallTrend="positive"
          summaryText="Test summary"
          granularity="daily"
          rangeStartDate="2025-07-14"
        />
      );

      // 2025-07-14 is a Monday
      expect(screen.getByText('Mon')).toBeTruthy();
      expect(screen.getByText('Tue')).toBeTruthy();
      expect(screen.getByText('Wed')).toBeTruthy();
      expect(screen.getByText('Thu')).toBeTruthy();
      expect(screen.getByText('Fri')).toBeTruthy();
      expect(screen.getByText('Sat')).toBeTruthy();
      expect(screen.getByText('Sun')).toBeTruthy();
    });

    /**
     * Validates: Requirements 5.2, 5.5
     * Test: 30d period produces weekly buckets with week labels (unchanged)
     */
    it('renders week labels when no granularity prop is passed (defaults to weekly)', async () => {
      await render(<DualAxisChart {...defaultProps} />);

      // Default behavior — weekly labels in -Nw format
      expect(screen.getByText('-3w')).toBeTruthy();
      expect(screen.getByText('-2w')).toBeTruthy();
      expect(screen.getByText('-1w')).toBeTruthy();
      expect(screen.getByText('Now')).toBeTruthy();
    });

    /**
     * Validates: Requirements 5.5, 5.8
     * Test: accessible description uses "days" for daily granularity
     */
    it('accessible description uses "days" for daily granularity', async () => {
      await render(
        <DualAxisChart
          weeklyAvgScore={[5, 6, 7, 5, 6, 7, 8]}
          weeklyTotalDurationMin={[10, 15, 20, 12, 18, 22, 25]}
          overallTrend="positive"
          summaryText="Test summary"
          granularity="daily"
          rangeStartDate="2025-07-14"
        />
      );

      const chartView = screen.getByLabelText(/over 7 days/);
      expect(chartView).toBeTruthy();
      expect(chartView.props.accessibilityLabel).toContain('daily check-in score');
    });

    /**
     * Validates: Requirements 5.5, 5.8
     * Test: accessible description uses "weeks" for weekly granularity
     */
    it('accessible description uses "weeks" for weekly granularity', async () => {
      await render(
        <DualAxisChart
          weeklyAvgScore={[5, 6, 7, 8]}
          weeklyTotalDurationMin={[10, 15, 20, 25]}
          overallTrend="positive"
          summaryText="Test summary"
          granularity="weekly"
        />
      );

      const chartView = screen.getByLabelText(/over 4 weeks/);
      expect(chartView).toBeTruthy();
      expect(chartView.props.accessibilityLabel).toContain('weekly check-in score');
    });

    /**
     * Validates: Requirements 5.1, 5.5
     * Test: Daily labels > 7 days shows every other day with "Today" at end
     */
    it('renders every-other-day labels with Today at the end for 14 daily data points', async () => {
      await render(
        <DualAxisChart
          weeklyAvgScore={[5, 6, 7, 5, 6, 7, 8, 5, 6, 7, 5, 6, 7, 8]}
          weeklyTotalDurationMin={[10, 15, 20, 12, 18, 22, 25, 10, 15, 20, 12, 18, 22, 25]}
          overallTrend="positive"
          summaryText="Test summary"
          granularity="daily"
          rangeStartDate="2025-07-14"
        />
      );

      // 2025-07-14 is Monday. With 14 days, every other day is shown:
      // index 0 = Mon, index 2 = Wed, index 4 = Fri, index 6 = Sun,
      // index 8 = Tue, index 10 = Thu, index 12 = Sat
      // Last index is 13 (Sunday) — should be "Today"
      expect(screen.getByText('Mon')).toBeTruthy();
      expect(screen.getByText('Wed')).toBeTruthy();
      expect(screen.getByText('Fri')).toBeTruthy();
      expect(screen.getByText('Today')).toBeTruthy();
    });
  });
});
