/**
 * PerToolOutcomeTrendsSection — Per-tool Outcome Trends section showing a
 * dual-axis chart of weekly average check-in score alongside weekly total
 * practice time for a specific tool.
 *
 * Renders between EngagementSection and CorrelationDisclaimer on the
 * ToolInsightsScreen. Hidden when data is null or fewer than 2 weekly
 * buckets exist.
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DualAxisChart from './DualAxisChart';
import type { WalletCorrelationResult } from '@/services/correlationEngine';

// --- Props ---

export interface PerToolOutcomeTrendsSectionProps {
  data: WalletCorrelationResult | null;
}

// --- Component ---

export function PerToolOutcomeTrendsSection({
  data,
}: PerToolOutcomeTrendsSectionProps) {
  // Hide section when data is insufficient (Req 2.7)
  if (!data || data.weeklyAvgScore.length < 2) {
    return null;
  }

  const accessibilityLabelText = `Outcome Trends. ${data.summaryText}`;

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabelText}
      testID="per-tool-outcome-trends-section"
    >
      {/* Section title (Req 2.5) */}
      <Text style={styles.sectionTitle}>Outcome Trends</Text>

      {/* DualAxisChart (Req 2.3) */}
      <DualAxisChart
        weeklyAvgScore={data.weeklyAvgScore}
        weeklyTotalDurationMin={data.weeklyTotalDurationMin}
        weeklyPositiveOutcomeRate={data.weeklyPositiveOutcomeRate}
        overallTrend={data.overallTrend}
        summaryText={data.summaryText}
        granularity={data.granularity}
        rangeStartDate={data.rangeStartDate}
      />

      {/* Summary text below chart (Req 2.6, 4.3) */}
      <Text style={styles.summaryText}>{data.summaryText}</Text>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 8,
  },
});
