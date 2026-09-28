/**
 * Unit tests for DualAxisChart component.
 *
 * Validates: Requirements 5.8, 9.1, 9.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DualAxisChart, { computeDurationAxisLabels } from '../DualAxisChart';

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

  describe('duration axis labels — Bug 3 (duplicate "1m")', () => {
    /**
     * Validates: Requirements 8.1, 8.2, 8.5
     *
     * This is the Bug 3 case (all-zero practice-time data). The component floors
     * the range to durationMax=1 / durationMin=0 (via Math.max(...,1) /
     * Math.min(...,0)). BEFORE the fix the three ticks were:
     *   top    = format(1)           → "1m"
     *   mid    = format((1+0)/2=0.5) → round → 1 → "1m"   ← collided with top
     *   bottom = format(0)           → "0"
     * which showed a duplicate "1m" on the axis.
     *
     * AFTER the fix (task 3.3) the midpoint is blanked when it would collide
     * with the top or bottom, so no VISIBLE label repeats:
     *   top = "1m", mid = "" (blanked), bottom = "0".
     */
    it('blanks the midpoint for a near-zero range so no visible duration label repeats (fixed behavior)', () => {
      // Mirrors the component's floored range for all-zero duration data.
      const durationMax = 1;
      const durationMin = 0;

      const { top, mid, bottom } = computeDurationAxisLabels(durationMax, durationMin);

      // Top and bottom are unchanged; the colliding midpoint is now blanked.
      expect(top).toBe('1m');
      expect(mid).toBe('');
      expect(bottom).toBe('0');

      // No VISIBLE label repeats (empty string is not a visible label).
      const visibleLabels = [top, mid, bottom].filter((l) => l !== '');
      const noVisibleDuplicate = new Set(visibleLabels).size === visibleLabels.length;
      expect(noVisibleDuplicate).toBe(true);
    });

    /**
     * Validates: Requirements 8.3, 8.4
     *
     * PRESERVATION TEST (bugfix workflow). Captures the correct baseline for a
     * NORMAL multi-minute range: the three duration ticks are already all
     * distinct today, and the upcoming dedupe fix (task 3.3) must NOT alter
     * them. This proves the fix is scoped to the near-zero collision case and
     * leaves normal charts untouched (Req 8.3 — only the minute labels change,
     * and only when they would otherwise repeat; Req 8.4 — the normal
     * multi-minute case shows no repeated label).
     *
     * Must PASS on the current (unfixed) code AND remain true after the fix.
     */
    it('keeps all three duration labels distinct for a normal multi-minute range (baseline, must not regress)', () => {
      // Case 1: max=30, min=0 → top "30m", mid "15m", bottom "0" — all distinct.
      {
        const { top, mid, bottom } = computeDurationAxisLabels(30, 0);

        expect(top).toBe('30m');
        expect(mid).toBe('15m');
        expect(bottom).toBe('0');

        const allDistinct = new Set([top, mid, bottom]).size === 3;
        expect(allDistinct).toBe(true);
      }

      // Case 2: another normal range max=28, min=10 → top "28m", mid "19m", bottom "10m".
      {
        const { top, mid, bottom } = computeDurationAxisLabels(28, 10);

        expect(top).toBe('28m');
        expect(mid).toBe('19m');
        expect(bottom).toBe('10m');

        const allDistinct = new Set([top, mid, bottom]).size === 3;
        expect(allDistinct).toBe(true);
      }
    });

    /**
     * Validates: Requirements 8.4, 8.5
     *
     * The "tiny amount (under a couple of minutes)" case from Req 8.4 — a
     * non-zero but very small practice-time range. This is distinct from the
     * all-zero (max=1/min=0) case above and from the normal multi-minute case.
     * It exercises BOTH sub-cases of a sub-2-minute range:
     *
     *   (i)  max=2, min=1 → top "2m", mid (1.5→round→2) "2m" collides with top,
     *        so mid is blanked; visible labels are ["2m", "1m"] — no repeat.
     *   (ii) max=3, min=0 → top "3m", mid (1.5→round→2) "2m", bottom "0" — a
     *        tiny range that does NOT collide and stays all-distinct.
     *
     * In neither sub-case does a VISIBLE minute label repeat.
     */
    it('shows no repeated label for a tiny sub-2-minute range (near-collision and non-collision)', () => {
      // (i) Near-collision: midpoint rounds to the top → blanked.
      {
        const { top, mid, bottom } = computeDurationAxisLabels(2, 1);

        expect(top).toBe('2m');
        expect(mid).toBe(''); // collided with top → blanked
        expect(bottom).toBe('1m');

        const visibleLabels = [top, mid, bottom].filter((l) => l !== '');
        const noVisibleDuplicate = new Set(visibleLabels).size === visibleLabels.length;
        expect(noVisibleDuplicate).toBe(true);
      }

      // (ii) Tiny but distinct: no collision, all three remain visible + unique.
      {
        const { top, mid, bottom } = computeDurationAxisLabels(3, 0);

        expect(top).toBe('3m');
        expect(mid).toBe('2m');
        expect(bottom).toBe('0');

        const allDistinct = new Set([top, mid, bottom]).size === 3;
        expect(allDistinct).toBe(true);
      }
    });
  });
});
