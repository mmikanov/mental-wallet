/**
 * EngagementSection — Per-tool duration insights section.
 *
 * Displays average Active_Duration formatted as "Xm Ys", a duration
 * trend indicator (more/less/consistent), and an InsightTooltip explaining
 * the metric. Shows an encouraging empty state when fewer than 3 completed
 * records exist.
 *
 * Screen readers announce durations in full words (e.g., "four minutes
 * thirty-two seconds") via accessibilityLabel.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 9.3
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InsightTooltip } from './InsightTooltip';
import type { DurationStats } from '@/services/durationService';

// --- Props ---

export interface EngagementSectionProps {
  stats: DurationStats | null;
  /** Whether the tool has any duration data outside the current period. */
  hasHistoricalData?: boolean;
}

// --- Number-to-words helpers ---

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

function numberToWords(n: number): string {
  if (n < 0) return 'zero';
  if (n === 0) return 'zero';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return one === 0 ? TENS[ten] : `${TENS[ten]}-${ONES[one]}`;
  }
  // For numbers >= 100, fall back to digits (unlikely for duration display)
  return String(n);
}

// --- Duration formatting helpers ---

/**
 * Formats seconds into "Xm Ys" visual display.
 * Examples: 272 → "4m 32s", 60 → "1m 0s", 45 → "0m 45s"
 */
export function formatDurationVisual(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * Formats seconds into full words for accessibility.
 * Examples: 272 → "four minutes thirty-two seconds", 60 → "one minute zero seconds"
 */
export function formatDurationAccessible(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minWord = numberToWords(mins);
  const secWord = numberToWords(secs);
  const minUnit = mins === 1 ? 'minute' : 'minutes';
  const secUnit = secs === 1 ? 'second' : 'seconds';
  return `${minWord} ${minUnit} ${secWord} ${secUnit}`;
}

// --- Trend display helpers ---

interface TrendInfo {
  label: string;
  indicator: string;
  color: string;
}

function getTrendInfo(direction: DurationStats['trendDirection']): TrendInfo {
  switch (direction) {
    case 'more':
      return { label: 'spending more time', indicator: '↑', color: '#059669' };
    case 'less':
      return { label: 'spending less time', indicator: '↓', color: '#DC2626' };
    case 'consistent':
      return { label: 'consistent', indicator: '→', color: '#6B7280' };
  }
}

function getTrendBadgeColor(direction: DurationStats['trendDirection']): string {
  switch (direction) {
    case 'more':
      return '#D1FAE5'; // light green
    case 'less':
      return '#FEE2E2'; // light red
    case 'consistent':
      return '#F3F4F6'; // light gray
  }
}

// --- Tooltip explanation text ---

const DURATION_TREND_EXPLANATION =
  'We compare your last 5 sessions to your overall average. If you\'re spending 15% more or less time, we note the trend.';

// --- Component ---

export function EngagementSection({ stats, hasHistoricalData }: EngagementSectionProps) {
  // Empty state: fewer than 3 completed records in this period
  if (!stats) {
    return (
      <View style={styles.container} testID="engagement-section-empty">
        <Text style={styles.sectionTitle}>Engagement</Text>
        <Text style={styles.emptyText}>
          {hasHistoricalData
            ? "You haven't used this tool recently. Come back to it when you're ready — it'll be here."
            : 'Use this tool a few more times to see your engagement patterns'}
        </Text>
      </View>
    );
  }

  const durationVisual = formatDurationVisual(stats.averageDurationSec);
  const durationAccessible = formatDurationAccessible(stats.averageDurationSec);
  const showTrend = stats.totalRecords >= 5;
  const trendInfo = showTrend ? getTrendInfo(stats.trendDirection) : null;

  return (
    <View style={styles.container} testID="engagement-section">
      {/* Title */}
      <Text style={styles.sectionTitle}>Engagement</Text>

      {/* Trend badge row (below title, when 5+ records) */}
      {showTrend && trendInfo && (
        <View style={styles.trendBadgeRow} testID="engagement-trend">
          <View style={[styles.trendBadge, { backgroundColor: getTrendBadgeColor(stats.trendDirection) }]}>
            <Text
              style={[styles.trendBadgeText, { color: trendInfo.color }]}
              accessibilityLabel={`Trend: ${trendInfo.label}`}
            >
              {trendInfo.label}
            </Text>
          </View>
          <InsightTooltip explanation={DURATION_TREND_EXPLANATION} />
        </View>
      )}

      {/* Average duration display */}
      <Text
        style={styles.durationText}
        accessibilityLabel={`Average time: ${durationAccessible}`}
        testID="engagement-average-duration"
      >
        Average time: {durationVisual}
      </Text>
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
  },
  trendBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  trendBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#374151',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 8,
  },
});
