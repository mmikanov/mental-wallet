/**
 * Unit tests for EngagementSection component.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 9.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EngagementSection } from '../EngagementSection';
import {
  formatDurationVisual,
  formatDurationAccessible,
} from '../EngagementSection';
import type { DurationStats } from '@/services/durationService';

describe('EngagementSection', () => {
  describe('empty state (stats is null)', () => {
    it('shows the encouraging empty state message', async () => {
      await render(<EngagementSection stats={null} />);

      expect(
        screen.getByText(
          'Use this tool a few more times to see your engagement patterns'
        )
      ).toBeTruthy();
    });

    it('shows the section title', async () => {
      await render(<EngagementSection stats={null} />);

      expect(screen.getByText('Engagement')).toBeTruthy();
    });

    it('does not show duration or trend', async () => {
      await render(<EngagementSection stats={null} />);

      expect(screen.queryByTestId('engagement-average-duration')).toBeNull();
      expect(screen.queryByTestId('engagement-trend')).toBeNull();
    });

    it('renders the empty testID', async () => {
      await render(<EngagementSection stats={null} />);

      expect(screen.getByTestId('engagement-section-empty')).toBeTruthy();
    });

    it('shows historical data message when hasHistoricalData is true', async () => {
      await render(<EngagementSection stats={null} hasHistoricalData={true} />);

      expect(
        screen.getByText(
          "You haven't used this tool recently. Come back to it when you're ready — it'll be here."
        )
      ).toBeTruthy();
    });

    it('shows default new-user message when hasHistoricalData is false', async () => {
      await render(<EngagementSection stats={null} hasHistoricalData={false} />);

      expect(
        screen.getByText(
          'Use this tool a few more times to see your engagement patterns'
        )
      ).toBeTruthy();
    });
  });

  describe('with stats (3-4 records, no trend)', () => {
    const stats: DurationStats = {
      averageDurationSec: 272, // 4m 32s
      totalRecords: 4,
      recentAverageSec: 280,
      trendDirection: 'consistent',
    };

    it('shows the section title', async () => {
      await render(<EngagementSection stats={stats} />);

      expect(screen.getByText('Engagement')).toBeTruthy();
    });

    it('displays average duration formatted as "Xm Ys"', async () => {
      await render(<EngagementSection stats={stats} />);

      expect(screen.getByText('Average time: 4m 32s')).toBeTruthy();
    });

    it('does not show trend indicator when fewer than 5 records', async () => {
      await render(<EngagementSection stats={stats} />);

      expect(screen.queryByTestId('engagement-trend')).toBeNull();
    });

    it('provides accessible label with full words for duration', async () => {
      await render(<EngagementSection stats={stats} />);

      expect(
        screen.getByLabelText(
          'Average time: four minutes thirty-two seconds'
        )
      ).toBeTruthy();
    });
  });

  describe('with stats (5+ records, trend shown)', () => {
    it('shows "spending more time" trend badge', async () => {
      const stats: DurationStats = {
        averageDurationSec: 300,
        totalRecords: 8,
        recentAverageSec: 360,
        trendDirection: 'more',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByTestId('engagement-trend')).toBeTruthy();
      expect(screen.getByText('spending more time')).toBeTruthy();
    });

    it('shows "spending less time" trend badge', async () => {
      const stats: DurationStats = {
        averageDurationSec: 300,
        totalRecords: 6,
        recentAverageSec: 200,
        trendDirection: 'less',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByTestId('engagement-trend')).toBeTruthy();
      expect(screen.getByText('spending less time')).toBeTruthy();
    });

    it('shows "consistent" trend badge', async () => {
      const stats: DurationStats = {
        averageDurationSec: 300,
        totalRecords: 10,
        recentAverageSec: 310,
        trendDirection: 'consistent',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByTestId('engagement-trend')).toBeTruthy();
      expect(screen.getByText('consistent')).toBeTruthy();
    });

    it('provides accessible label on trend', async () => {
      const stats: DurationStats = {
        averageDurationSec: 300,
        totalRecords: 5,
        recentAverageSec: 360,
        trendDirection: 'more',
      };

      await render(<EngagementSection stats={stats} />);

      expect(
        screen.getByLabelText('Trend: spending more time')
      ).toBeTruthy();
    });
  });

  describe('duration at edge values', () => {
    it('handles 0 minutes correctly (e.g., 45 seconds)', async () => {
      const stats: DurationStats = {
        averageDurationSec: 45,
        totalRecords: 3,
        recentAverageSec: 45,
        trendDirection: 'consistent',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByText('Average time: 0m 45s')).toBeTruthy();
      expect(
        screen.getByLabelText('Average time: zero minutes forty-five seconds')
      ).toBeTruthy();
    });

    it('handles exact minute boundary (60 seconds)', async () => {
      const stats: DurationStats = {
        averageDurationSec: 60,
        totalRecords: 3,
        recentAverageSec: 60,
        trendDirection: 'consistent',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByText('Average time: 1m 0s')).toBeTruthy();
      expect(
        screen.getByLabelText('Average time: one minute zero seconds')
      ).toBeTruthy();
    });

    it('handles 1 second correctly for plural/singular', async () => {
      const stats: DurationStats = {
        averageDurationSec: 61,
        totalRecords: 3,
        recentAverageSec: 61,
        trendDirection: 'consistent',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByText('Average time: 1m 1s')).toBeTruthy();
      expect(
        screen.getByLabelText('Average time: one minute one second')
      ).toBeTruthy();
    });
  });

  describe('tooltip', () => {
    it('renders InsightTooltip when trend badge is shown (5+ records)', async () => {
      const stats: DurationStats = {
        averageDurationSec: 200,
        totalRecords: 5,
        recentAverageSec: 210,
        trendDirection: 'consistent',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.getByTestId('insight-tooltip-trigger')).toBeTruthy();
    });

    it('does not render InsightTooltip when no trend badge (fewer than 5 records)', async () => {
      const stats: DurationStats = {
        averageDurationSec: 200,
        totalRecords: 4,
        recentAverageSec: 210,
        trendDirection: 'consistent',
      };

      await render(<EngagementSection stats={stats} />);

      expect(screen.queryByTestId('insight-tooltip-trigger')).toBeNull();
    });
  });
});

describe('formatDurationVisual', () => {
  it('formats 272 seconds as "4m 32s"', () => {
    expect(formatDurationVisual(272)).toBe('4m 32s');
  });

  it('formats 60 seconds as "1m 0s"', () => {
    expect(formatDurationVisual(60)).toBe('1m 0s');
  });

  it('formats 0 seconds as "0m 0s"', () => {
    expect(formatDurationVisual(0)).toBe('0m 0s');
  });

  it('formats 3 seconds as "0m 3s"', () => {
    expect(formatDurationVisual(3)).toBe('0m 3s');
  });

  it('formats 3661 seconds as "61m 1s"', () => {
    expect(formatDurationVisual(3661)).toBe('61m 1s');
  });
});

describe('formatDurationAccessible', () => {
  it('formats 272 seconds in full words', () => {
    expect(formatDurationAccessible(272)).toBe(
      'four minutes thirty-two seconds'
    );
  });

  it('formats 60 seconds in full words (singular minute)', () => {
    expect(formatDurationAccessible(60)).toBe('one minute zero seconds');
  });

  it('formats 61 seconds with singular second', () => {
    expect(formatDurationAccessible(61)).toBe('one minute one second');
  });

  it('formats 0 seconds', () => {
    expect(formatDurationAccessible(0)).toBe('zero minutes zero seconds');
  });

  it('formats 45 seconds (zero minutes)', () => {
    expect(formatDurationAccessible(45)).toBe(
      'zero minutes forty-five seconds'
    );
  });
});
