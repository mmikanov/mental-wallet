/**
 * Unit tests for DailyCheckInImpact component.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 12.3, 12.4, 12.5, 12.6
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { DailyCheckInImpact } from '../DailyCheckInImpact';
import type { ToolCorrelationResult } from '@/services/correlationEngine';
import type { InsightTier, TimePeriod } from '@/services/tierEvaluator';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

describe('DailyCheckInImpact', () => {
  const defaultProps = {
    correlation: null as ToolCorrelationResult | null,
    tier: 'confident' as InsightTier,
    timePeriod: '30d' as TimePeriod,
    onTimePeriodChange: jest.fn(),
    availablePeriods: ['7d', '30d', '90d', 'all'] as TimePeriod[],
    onPracticeNow: jest.fn(),
  };

  const positiveCorrelation: ToolCorrelationResult = {
    cardId: 'card-1',
    cardTitle: 'Box Breathing',
    scoreDelta: 0.8,
    correlationDirection: 'positive',
    sampleSizeToolDays: 10,
    sampleSizeOtherDays: 20,
    avgDurationSec: 240,
    outcomeEffectivenessScore: 0.7,
    effectivenessPattern: 'reliable_booster',
  };

  const neutralCorrelation: ToolCorrelationResult = {
    cardId: 'card-2',
    cardTitle: 'Thought Record',
    scoreDelta: 0.1,
    correlationDirection: 'neutral',
    sampleSizeToolDays: 8,
    sampleSizeOtherDays: 22,
    avgDurationSec: 300,
    outcomeEffectivenessScore: null,
    effectivenessPattern: null,
  };

  const negativeCorrelation: ToolCorrelationResult = {
    cardId: 'card-3',
    cardTitle: 'Body Scan',
    scoreDelta: -0.5,
    correlationDirection: 'negative',
    sampleSizeToolDays: 12,
    sampleSizeOtherDays: 18,
    avgDurationSec: 180,
    outcomeEffectivenessScore: 0.65,
    effectivenessPattern: 'helpful_on_hard_days',
  };

  describe('Section header', () => {
    it('renders "Daily Check-In Impact" title', async () => {
      await render(<DailyCheckInImpact {...defaultProps} />);
      expect(screen.getByText('Daily Check-In Impact')).toBeTruthy();
    });

    it('title has header accessibility role', async () => {
      await render(<DailyCheckInImpact {...defaultProps} />);
      const title = screen.getByText('Daily Check-In Impact');
      expect(title.props.accessibilityRole).toBe('header');
    });
  });

  describe('Empty state', () => {
    it('shows empty state when correlation is null', async () => {
      await render(<DailyCheckInImpact {...defaultProps} correlation={null} />);
      expect(screen.getByTestId('daily-checkin-impact-empty')).toBeTruthy();
      expect(screen.getByText(/Use this tool a few more times/)).toBeTruthy();
    });

    it('shows empty state when tier is below_nascent', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="below_nascent"
        />
      );
      expect(screen.getByTestId('daily-checkin-impact-empty')).toBeTruthy();
    });

    it('shows empty state when tier is nascent', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="nascent"
        />
      );
      expect(screen.getByTestId('daily-checkin-impact-empty')).toBeTruthy();
    });

    it('shows "Practice now" CTA when onPracticeNow is provided', async () => {
      await render(
        <DailyCheckInImpact {...defaultProps} correlation={null} />
      );
      expect(screen.getByTestId('daily-checkin-impact-practice-now')).toBeTruthy();
      expect(screen.getByText('Practice now →')).toBeTruthy();
    });

    it('calls onPracticeNow when CTA is pressed', async () => {
      const onPracticeNow = jest.fn();
      await render(
        <DailyCheckInImpact {...defaultProps} correlation={null} onPracticeNow={onPracticeNow} />
      );
      fireEvent.press(screen.getByTestId('daily-checkin-impact-practice-now'));
      expect(onPracticeNow).toHaveBeenCalledTimes(1);
    });

    it('does not show "Practice now" CTA when onPracticeNow is not provided', async () => {
      await render(
        <DailyCheckInImpact {...defaultProps} correlation={null} onPracticeNow={undefined} />
      );
      expect(screen.queryByTestId('daily-checkin-impact-practice-now')).toBeNull();
    });

    it('does not show time period selector in empty state', async () => {
      await render(<DailyCheckInImpact {...defaultProps} correlation={null} showTimePeriodSelector={false} />);
      expect(screen.queryByTestId('period-segment-30d')).toBeNull();
    });
  });

  describe('Positive correlation', () => {
    it('shows correlation content at preliminary tier', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="preliminary"
        />
      );
      expect(screen.getByTestId('daily-checkin-impact-content')).toBeTruthy();
    });

    it('displays Score_Delta in plain language when no effectiveness pattern', async () => {
      const correlationWithoutPattern: ToolCorrelationResult = {
        ...positiveCorrelation,
        effectivenessPattern: null,
        outcomeEffectivenessScore: null,
      };
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={correlationWithoutPattern}
          tier="confident"
        />
      );
      expect(
        screen.getByText(/On days you use this tool, your check-in tends to be about 0.8 points higher/)
      ).toBeTruthy();
    });

    it('shows upward direction indicator when no effectiveness pattern', async () => {
      const correlationWithoutPattern: ToolCorrelationResult = {
        ...positiveCorrelation,
        effectivenessPattern: null,
        outcomeEffectivenessScore: null,
      };
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={correlationWithoutPattern}
          tier="confident"
        />
      );
      expect(screen.getByText('\u2197')).toBeTruthy();
    });

    it('hides Score_Delta row when effectiveness pattern exists', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
        />
      );
      expect(
        screen.queryByText(/On days you use this tool, your check-in tends to be about 0.8 points higher/)
      ).toBeNull();
    });
  });

  describe('Neutral correlation', () => {
    it('displays neutral framing text', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={neutralCorrelation}
          tier="confident"
        />
      );
      expect(
        screen.getByText(/Your check-in scores are similar whether or not you use this tool/)
      ).toBeTruthy();
    });

    it('shows neutral direction indicator', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={neutralCorrelation}
          tier="confident"
        />
      );
      expect(screen.getByText('\u2192')).toBeTruthy();
    });
  });

  describe('Negative correlation', () => {
    it('displays gentle non-judgmental framing when no effectiveness pattern', async () => {
      const negativeWithoutPattern: ToolCorrelationResult = {
        ...negativeCorrelation,
        effectivenessPattern: null,
        outcomeEffectivenessScore: null,
      };
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={negativeWithoutPattern}
          tier="confident"
        />
      );
      expect(
        screen.getByText(/Your check-in tends to be a bit lower on days you use this/)
      ).toBeTruthy();
    });

    it('shows downward direction indicator when no effectiveness pattern', async () => {
      const negativeWithoutPattern: ToolCorrelationResult = {
        ...negativeCorrelation,
        effectivenessPattern: null,
        outcomeEffectivenessScore: null,
      };
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={negativeWithoutPattern}
          tier="confident"
        />
      );
      expect(screen.getByText('\u2198')).toBeTruthy();
    });

    it('hides Score_Delta row when effectiveness pattern exists', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={negativeCorrelation}
          tier="confident"
        />
      );
      expect(
        screen.queryByText(/Your check-in tends to be a bit lower on days you use this/)
      ).toBeNull();
    });
  });

  describe('Effectiveness pattern', () => {
    it('shows effectiveness pattern label when available', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
        />
      );
      expect(screen.getByTestId('effectiveness-pattern')).toBeTruthy();
      expect(screen.getByText('Reliable booster')).toBeTruthy();
    });

    it('shows helpful_on_hard_days pattern', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={negativeCorrelation}
          tier="confident"
        />
      );
      expect(screen.getByText('Helpful on hard days')).toBeTruthy();
    });

    it('does not show pattern section when effectivenessPattern is null', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={neutralCorrelation}
          tier="confident"
        />
      );
      expect(screen.queryByTestId('effectiveness-pattern')).toBeNull();
    });

    it('shows pattern description text', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
        />
      );
      expect(
        screen.getByText(/This tool seems linked to better days/)
      ).toBeTruthy();
    });
  });

  describe('Preliminary tier qualifier', () => {
    it('shows "Based on limited data" qualifier at Preliminary tier', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="preliminary"
        />
      );
      expect(screen.getByTestId('preliminary-qualifier')).toBeTruthy();
      expect(screen.getByText('Based on limited data')).toBeTruthy();
    });

    it('does not show qualifier at Confident tier', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
        />
      );
      expect(screen.queryByTestId('preliminary-qualifier')).toBeNull();
    });
  });

  describe('InsightTooltip', () => {
    it('shows tooltip trigger when correlation data is available', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
        />
      );
      // Two tooltips: one in header for Score_Delta, one for effectiveness pattern
      const triggers = screen.getAllByTestId('insight-tooltip-trigger');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show tooltip trigger in empty state', async () => {
      await render(
        <DailyCheckInImpact {...defaultProps} correlation={null} />
      );
      expect(screen.queryByTestId('insight-tooltip-trigger')).toBeNull();
    });
  });

  describe('TimePeriodSelector', () => {
    it('renders time period selector when correlation data is available', async () => {
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
        />
      );
      expect(screen.getByTestId('period-segment-7d')).toBeTruthy();
      expect(screen.getByTestId('period-segment-30d')).toBeTruthy();
      expect(screen.getByTestId('period-segment-90d')).toBeTruthy();
      expect(screen.getByTestId('period-segment-all')).toBeTruthy();
    });

    it('calls onTimePeriodChange when a period is selected', async () => {
      const onTimePeriodChange = jest.fn();
      await render(
        <DailyCheckInImpact
          {...defaultProps}
          correlation={positiveCorrelation}
          tier="confident"
          onTimePeriodChange={onTimePeriodChange}
        />
      );
      fireEvent.press(screen.getByTestId('period-segment-7d'));
      expect(onTimePeriodChange).toHaveBeenCalledWith('7d');
    });
  });
});
