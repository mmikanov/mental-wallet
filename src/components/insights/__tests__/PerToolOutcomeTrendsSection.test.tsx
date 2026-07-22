/**
 * Unit tests for PerToolOutcomeTrendsSection component.
 *
 * Validates: Requirements 2.7, 4.1, 4.2, 4.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PerToolOutcomeTrendsSection } from '../PerToolOutcomeTrendsSection';
import type { WalletCorrelationResult } from '@/services/correlationEngine';

// Mock DualAxisChart to verify props passed through
jest.mock('../DualAxisChart', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <View testID="mock-dual-axis-chart">
        <Text testID="chart-weeklyAvgScore">{JSON.stringify(props.weeklyAvgScore)}</Text>
        <Text testID="chart-weeklyTotalDurationMin">{JSON.stringify(props.weeklyTotalDurationMin)}</Text>
        <Text testID="chart-overallTrend">{props.overallTrend}</Text>
        <Text testID="chart-summaryText">{props.summaryText}</Text>
      </View>
    ),
  };
});

const validData: WalletCorrelationResult = {
  weeklyAvgScore: [5.2, 6.1, 6.8, 7.3],
  weeklyTotalDurationMin: [15, 22, 30, 28],
  overallTrend: 'positive',
  summaryText:
    'Your check-in scores tend to be higher in weeks where you practice this tool more.',
};

describe('PerToolOutcomeTrendsSection', () => {
  describe('Property 7: Section Hidden When Insufficient Data', () => {
    it('renders nothing when data is null', async () => {
      await render(<PerToolOutcomeTrendsSection data={null} />);
      expect(screen.queryByTestId('per-tool-outcome-trends-section')).toBeNull();
    });

    it('renders nothing when weeklyAvgScore has length 0', async () => {
      const data: WalletCorrelationResult = {
        weeklyAvgScore: [],
        weeklyTotalDurationMin: [],
        overallTrend: 'neutral',
        summaryText: 'Not enough data.',
      };
      await render(<PerToolOutcomeTrendsSection data={data} />);
      expect(screen.queryByTestId('per-tool-outcome-trends-section')).toBeNull();
    });

    it('renders nothing when weeklyAvgScore has length 1', async () => {
      const data: WalletCorrelationResult = {
        weeklyAvgScore: [5.0],
        weeklyTotalDurationMin: [10],
        overallTrend: 'neutral',
        summaryText: 'Just started.',
      };
      await render(<PerToolOutcomeTrendsSection data={data} />);
      expect(screen.queryByTestId('per-tool-outcome-trends-section')).toBeNull();
    });

    it('renders section when weeklyAvgScore has 2 or more entries', async () => {
      const data: WalletCorrelationResult = {
        weeklyAvgScore: [5.0, 6.0],
        weeklyTotalDurationMin: [10, 15],
        overallTrend: 'neutral',
        summaryText: 'Your scores and practice time have stayed fairly steady.',
      };
      await render(<PerToolOutcomeTrendsSection data={data} />);
      expect(screen.getByTestId('per-tool-outcome-trends-section')).toBeTruthy();
    });
  });

  describe('DualAxisChart receives correct props', () => {
    it('passes weeklyAvgScore, weeklyTotalDurationMin, overallTrend, and summaryText', async () => {
      await render(<PerToolOutcomeTrendsSection data={validData} />);

      expect(screen.getByTestId('chart-weeklyAvgScore').props.children).toBe(
        JSON.stringify(validData.weeklyAvgScore)
      );
      expect(screen.getByTestId('chart-weeklyTotalDurationMin').props.children).toBe(
        JSON.stringify(validData.weeklyTotalDurationMin)
      );
      expect(screen.getByTestId('chart-overallTrend').props.children).toBe('positive');
      expect(screen.getByTestId('chart-summaryText').props.children).toBe(validData.summaryText);
    });
  });

  describe('Accessibility attributes', () => {
    it('container has accessibilityRole="summary"', async () => {
      await render(<PerToolOutcomeTrendsSection data={validData} />);

      const container = screen.getByTestId('per-tool-outcome-trends-section');
      expect(container.props.accessibilityRole).toBe('summary');
    });

    it('container has accessibilityLabel combining title and summaryText', async () => {
      await render(<PerToolOutcomeTrendsSection data={validData} />);

      const container = screen.getByTestId('per-tool-outcome-trends-section');
      expect(container.props.accessibilityLabel).toBe(
        `Outcome Trends. ${validData.summaryText}`
      );
    });

    it('summary text is rendered as standalone Text with no numberOfLines (no truncation)', async () => {
      await render(<PerToolOutcomeTrendsSection data={validData} />);

      // summaryText appears in both the mock chart and the standalone Text element
      const elements = screen.getAllByText(validData.summaryText);
      // Find the standalone Text element (not the one inside the mock chart with testID)
      const summaryTextElement = elements.find(
        (el) => el.props.testID !== 'chart-summaryText'
      );
      expect(summaryTextElement).toBeTruthy();
      // Verify no numberOfLines prop is set (no truncation)
      expect(summaryTextElement!.props.numberOfLines).toBeUndefined();
    });
  });
});
