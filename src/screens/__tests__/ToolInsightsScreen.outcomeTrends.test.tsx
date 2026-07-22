/**
 * Integration tests for ToolInsightsScreen — OutcomeTrends section ordering
 * and conditional rendering.
 *
 * Validates: Requirements 2.2, 2.7
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// --- Mock navigation ---
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

// --- Mock react-native-safe-area-context ---
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// --- Mock database ---
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue({ title: 'Test Card' }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));

// --- Mock correlationEngine ---
const mockComputeToolOutcomeTrend = jest.fn();
const mockComputeSingleToolCorrelation = jest.fn().mockResolvedValue(null);

jest.mock('@/services/correlationEngine', () => ({
  createCorrelationEngine: () => ({
    computeToolOutcomeTrend: mockComputeToolOutcomeTrend,
    computeSingleToolCorrelation: mockComputeSingleToolCorrelation,
  }),
  getTimePeriodStartDate: (period: string) => {
    if (period === 'all') return null;
    return '2024-01-01T00:00:00.000Z';
  },
}));

// --- Mock durationService ---
jest.mock('@/services/durationService', () => ({
  createDurationService: () => ({
    getStats: jest.fn().mockResolvedValue({
      averageDurationSec: 300,
      totalSessions: 10,
      trend: 'stable',
      recentSessions: [],
    }),
  }),
}));

// --- Mock tierEvaluator ---
jest.mock('@/services/tierEvaluator', () => ({
  createTierEvaluator: () => ({
    evaluate: jest.fn().mockResolvedValue({
      currentTier: 'nascent',
      totalDaysTracked: 5,
      completedDays: 3,
      progressToNext: 0.3,
    }),
    cardQualifiesForCorrelation: jest.fn().mockResolvedValue(false),
  }),
}));

// --- Mock settingsService ---
jest.mock('@/services/settingsService', () => ({
  getOutcomePromptEnabled: jest.fn().mockResolvedValue(true),
}));

// --- Mock DualAxisChart (avoid rendering SVG/canvas internals) ---
jest.mock('@/components/insights/DualAxisChart', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="dual-axis-chart" />,
  };
});

import ToolInsightsScreen from '../ToolInsightsScreen';

describe('ToolInsightsScreen — OutcomeTrends section ordering and conditional rendering', () => {
  const routeProp: any = {
    key: 'tool-insights',
    name: 'ToolInsights',
    params: { cardId: 'card-123' },
  };

  const navigationProp: any = {
    goBack: mockGoBack,
    navigate: mockNavigate,
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => true),
    getParent: jest.fn(),
    getState: jest.fn(),
    reset: jest.fn(),
    getId: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders PerToolOutcomeTrendsSection between EngagementSection and CorrelationDisclaimer when data is available', async () => {
    // Provide valid trend data with 2+ buckets
    mockComputeToolOutcomeTrend.mockResolvedValue({
      weeklyAvgScore: [3.5, 4.0, 4.2],
      weeklyTotalDurationMin: [15, 20, 25],
      overallTrend: 'positive' as const,
      summaryText: 'Your check-in scores tend to be higher in weeks where you practice this tool more.',
    });

    const tree = await render(
      <ToolInsightsScreen route={routeProp} navigation={navigationProp} />
    );

    // Wait for loading to finish and sections to render
    await waitFor(() => {
      expect(tree.queryByTestId('engagement-section')).toBeTruthy();
    });

    // All three sections should be present
    expect(tree.getByTestId('engagement-section')).toBeTruthy();
    expect(tree.getByTestId('per-tool-outcome-trends-section')).toBeTruthy();

    // Verify ordering via the serialized tree structure.
    const json = tree.toJSON();
    const jsonString = JSON.stringify(json);

    // Verify that engagement-section testID appears before per-tool-outcome-trends-section
    const engagementIndex = jsonString.indexOf('engagement-section');
    const outcomeTrendsIndex = jsonString.indexOf('per-tool-outcome-trends-section');
    // CorrelationDisclaimer text: "they don't prove" — look for the unique phrase
    const disclaimerTextIndex = jsonString.indexOf("they don");

    expect(engagementIndex).toBeGreaterThan(-1);
    expect(outcomeTrendsIndex).toBeGreaterThan(-1);
    expect(disclaimerTextIndex).toBeGreaterThan(-1);
    expect(engagementIndex).toBeLessThan(outcomeTrendsIndex);
    expect(outcomeTrendsIndex).toBeLessThan(disclaimerTextIndex);
  });

  it('does not render PerToolOutcomeTrendsSection when computeToolOutcomeTrend returns null', async () => {
    // Return null — insufficient data
    mockComputeToolOutcomeTrend.mockResolvedValue(null);

    const tree = await render(
      <ToolInsightsScreen route={routeProp} navigation={navigationProp} />
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(tree.queryByTestId('engagement-section')).toBeTruthy();
    });

    // Outcome trends section should NOT be present
    expect(tree.queryByTestId('per-tool-outcome-trends-section')).toBeNull();
  });
});
