/**
 * DualAxisChart — Simple line chart overlay showing weekly average KPI score
 * alongside weekly total active duration.
 *
 * Uses View-based dots + connecting lines at proportional heights instead of
 * a charting library. Provides accessible text description for screen readers
 * and a visible text summary of the trend relationship.
 *
 * Validates: Requirements 5.8, 9.1, 9.5
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';

export interface DualAxisChartProps {
  weeklyAvgScore: number[];
  weeklyTotalDurationMin: number[];
  overallTrend: 'positive' | 'neutral' | 'negative';
  summaryText: string;
  /** Determines x-axis label format. Default 'weekly'. */
  granularity?: 'daily' | 'weekly';
  /** Start date of the range (needed for daily label generation). ISO string like "2025-07-14". */
  rangeStartDate?: string;
}

const CHART_HEIGHT = 120;
const SCORE_COLOR = '#6366F1'; // indigo for KPI score
const DURATION_COLOR = '#10B981'; // green for duration

/**
 * Computes adaptive X-axis labels relative to "Now" (the rightmost point).
 * Labels show how far back each point is from the present week.
 * When the last stepped label is too close to the final index, it gets
 * replaced with "Now" rather than appending a separate "Now" label.
 * - ≤8 weeks: all points labeled (-Nw format + Now)
 * - 9–16 weeks: every other point (-Nw format + Now)
 * - 17–26 weeks: every 4 weeks (-Nmo format + Now)
 * - >26 weeks: every 13 weeks (-Nmo format + Now)
 */
function getWeekLabels(weeks: number): Array<{ index: number; label: string }> {
  const labels: Array<{ index: number; label: string }> = [];

  if (weeks <= 8) {
    // Show all points — last one is always "Now"
    for (let i = 0; i < weeks; i++) {
      const weeksAgo = weeks - 1 - i;
      labels.push({
        index: i,
        label: weeksAgo === 0 ? 'Now' : `-${weeksAgo}w`,
      });
    }
  } else if (weeks <= 16) {
    const step = 2;
    for (let i = 0; i < weeks; i += step) {
      const weeksAgo = weeks - 1 - i;
      labels.push({
        index: i,
        label: weeksAgo === 0 ? 'Now' : `-${weeksAgo}w`,
      });
    }
    ensureNowLabel(labels, weeks - 1, step);
  } else if (weeks <= 26) {
    const step = 4;
    for (let i = 0; i < weeks; i += step) {
      const weeksAgo = weeks - 1 - i;
      const monthsAgo = Math.round(weeksAgo / 4);
      labels.push({
        index: i,
        label: monthsAgo === 0 ? 'Now' : `-${monthsAgo}mo`,
      });
    }
    ensureNowLabel(labels, weeks - 1, step);
  } else {
    const step = 13;
    for (let i = 0; i < weeks; i += step) {
      const weeksAgo = weeks - 1 - i;
      const monthsAgo = Math.round(weeksAgo / 4);
      labels.push({
        index: i,
        label: monthsAgo === 0 ? 'Now' : `-${monthsAgo}mo`,
      });
    }
    ensureNowLabel(labels, weeks - 1, step);
  }

  return labels;
}

/**
 * Ensures the final index is labeled "Now". If the last existing label
 * is already at the final index, relabel it. If it's too close (less than
 * the step), replace it with "Now" at the final index. Otherwise append.
 */
function ensureNowLabel(
  labels: Array<{ index: number; label: string }>,
  finalIndex: number,
  step: number
): void {
  if (labels.length === 0) {
    labels.push({ index: finalIndex, label: 'Now' });
    return;
  }

  const last = labels[labels.length - 1];
  if (last.index === finalIndex) {
    // Already at the end — just relabel
    last.label = 'Now';
  } else if (finalIndex - last.index < step) {
    // Too close — replace the last label with "Now" at the final position
    last.index = finalIndex;
    last.label = 'Now';
  } else {
    // Far enough — append as a separate label
    labels.push({ index: finalIndex, label: 'Now' });
  }
}

/**
 * Computes x-axis labels for daily granularity.
 * Each label is an abbreviated day name derived from rangeStartDate + index.
 * - ≤ 7 days: show all labels
 * - > 7 days: show every other label + "Today" for the last point
 */
function getDayLabels(days: number, rangeStartDate: string): Array<{ index: number; label: string }> {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const labels: Array<{ index: number; label: string }> = [];
  const startDate = new Date(rangeStartDate + 'T00:00:00');

  if (days <= 7) {
    // Show all labels
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      labels.push({
        index: i,
        label: DAY_NAMES[date.getDay()],
      });
    }
  } else {
    // Show every other label + "Today" for the last point
    for (let i = 0; i < days; i += 2) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      labels.push({
        index: i,
        label: DAY_NAMES[date.getDay()],
      });
    }
    // Replace/append "Today" for the last data point
    const lastIndex = days - 1;
    const lastLabel = labels[labels.length - 1];
    if (lastLabel && lastLabel.index === lastIndex) {
      lastLabel.label = 'Today';
    } else if (lastLabel && lastIndex - lastLabel.index < 2) {
      // Too close — replace last label with Today at the final index
      lastLabel.index = lastIndex;
      lastLabel.label = 'Today';
    } else {
      labels.push({ index: lastIndex, label: 'Today' });
    }
  }

  return labels;
}

/**
 * Builds a screen-reader accessible description of the chart data.
 */
function buildAccessibleDescription(
  weeklyAvgScore: number[],
  weeklyTotalDurationMin: number[],
  overallTrend: 'positive' | 'neutral' | 'negative',
  granularity: 'daily' | 'weekly' = 'weekly',
): string {
  const count = weeklyAvgScore.length;
  const trendWord =
    overallTrend === 'positive'
      ? 'trending upward'
      : overallTrend === 'negative'
        ? 'trending downward'
        : 'remaining steady';

  const scoreStart = weeklyAvgScore[0]?.toFixed(1) ?? '0';
  const scoreEnd = weeklyAvgScore[count - 1]?.toFixed(1) ?? '0';

  const durationStart = weeklyTotalDurationMin[0]?.toFixed(0) ?? '0';
  const durationEnd = weeklyTotalDurationMin[count - 1]?.toFixed(0) ?? '0';

  const periodLabel = granularity === 'daily'
    ? `${count} day${count === 1 ? '' : 's'}`
    : `${count} week${count === 1 ? '' : 's'}`;

  const frequencyLabel = granularity === 'daily' ? 'daily' : 'weekly';

  return (
    `Line chart showing ${frequencyLabel} check-in score ${trendWord} over ${periodLabel}, ` +
    `from ${scoreStart} to ${scoreEnd}, alongside practice time ` +
    `from ${durationStart} minutes to ${durationEnd} minutes.`
  );
}

/**
 * Formats a duration value (in minutes) for the Y-axis label.
 * Shows as "Xm" for whole minutes or "0" for zero.
 */
function formatDurationAxisLabel(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return '0';
  return `${rounded}m`;
}

/**
 * Normalizes a value within a [min, max] range to a 0–1 proportion.
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

export default function DualAxisChart({
  weeklyAvgScore,
  weeklyTotalDurationMin,
  overallTrend,
  summaryText: _summaryText,
  granularity = 'weekly',
  rangeStartDate,
}: DualAxisChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const weeks = Math.max(weeklyAvgScore.length, weeklyTotalDurationMin.length);

  if (weeks === 0) {
    return null;
  }

  // Adaptive dot size — smaller for dense charts
  const dotSize = weeks > 12 ? 6 : 8;

  // KPI scores use 1–10 range
  const scoreMin = 1;
  const scoreMax = 10;

  // Duration uses dynamic range from the data
  const durationMin = Math.min(...weeklyTotalDurationMin, 0);
  const durationMax = Math.max(...weeklyTotalDurationMin, 1);

  const accessibleDescription = buildAccessibleDescription(
    weeklyAvgScore,
    weeklyTotalDurationMin,
    overallTrend,
    granularity,
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  };

  // Compute pixel positions for score series — only for non-zero scores
  // Score of 0 means "no data" since real KPI scores are always 1-10
  const scorePositions = weeklyAvgScore.map((score, index) => {
    if (score === 0) return null; // no data for this week
    const proportion = normalize(score, scoreMin, scoreMax);
    const x = weeks === 1 ? chartWidth / 2 : (index / (weeks - 1)) * chartWidth;
    const y = CHART_HEIGHT - proportion * CHART_HEIGHT;
    return { x, y, index };
  }).filter((pos): pos is { x: number; y: number; index: number } => pos !== null);

  // Compute pixel positions for duration series
  const durationPositions = weeklyTotalDurationMin.map((duration, index) => {
    const proportion = normalize(duration, durationMin, durationMax);
    const x = weeks === 1 ? chartWidth / 2 : (index / (weeks - 1)) * chartWidth;
    const y = CHART_HEIGHT - proportion * CHART_HEIGHT;
    return { x, y };
  });

  return (
    <View style={styles.container}>
      {/* Chart area with accessible wrapper */}
      <View
        accessible={true}
        accessibilityLabel={accessibleDescription}
        accessibilityRole="image"
        style={styles.chartWrapper}
      >
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={[styles.yAxisLabel, { color: SCORE_COLOR }]}>10</Text>
          <Text style={[styles.yAxisLabel, { color: SCORE_COLOR }]}>5</Text>
          <Text style={[styles.yAxisLabel, { color: SCORE_COLOR }]}>1</Text>
        </View>

        {/* Chart body */}
        <View style={styles.chartBody} onLayout={handleLayout}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: CHART_HEIGHT / 2 }]} />
          <View style={[styles.gridLine, { top: CHART_HEIGHT - 1 }]} />

          {chartWidth > 0 && (
            <>
              {/* Duration connecting lines (rendered first, behind dots) */}
              {durationPositions.map((pos, index) => {
                if (index === durationPositions.length - 1) return null;
                const next = durationPositions[index + 1];
                const dx = next.x - pos.x;
                const dy = next.y - pos.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                return (
                  <View
                    key={`duration-line-${index}`}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      width: length,
                      height: 1.5,
                      backgroundColor: DURATION_COLOR,
                      opacity: 0.4,
                      transform: [{ rotate: `${angle}deg` }],
                      transformOrigin: 'left center',
                    }}
                  />
                );
              })}

              {/* Score connecting lines — only between non-zero score points */}
              {scorePositions.map((pos, i) => {
                if (i === scorePositions.length - 1) return null;
                const next = scorePositions[i + 1];
                const dx = next.x - pos.x;
                const dy = next.y - pos.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                return (
                  <View
                    key={`score-line-${pos.index}`}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      width: length,
                      height: 2,
                      backgroundColor: SCORE_COLOR,
                      opacity: 0.4,
                      transform: [{ rotate: `${angle}deg` }],
                      transformOrigin: 'left center',
                    }}
                  />
                );
              })}

              {/* Duration dots (on top of lines) */}
              {durationPositions.map((pos, index) => (
                <View
                  key={`duration-${index}`}
                  style={[
                    styles.dot,
                    {
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: DURATION_COLOR,
                      top: pos.y - dotSize / 2,
                      left: pos.x - dotSize / 2,
                    },
                  ]}
                />
              ))}

              {/* Score dots — only for weeks with data (score > 0) */}
              {scorePositions.map((pos) => (
                <View
                  key={`score-${pos.index}`}
                  style={[
                    styles.dot,
                    {
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: SCORE_COLOR,
                      top: pos.y - dotSize / 2,
                      left: pos.x - dotSize / 2,
                    },
                  ]}
                />
              ))}
            </>
          )}

          {/* X-axis labels — absolutely positioned when layout is known, fallback to flex */}
          <View
            style={
              chartWidth > 0
                ? styles.weekLabelsContainer
                : styles.weekLabelsContainerFallback
            }
          >
            {(granularity === 'daily' && rangeStartDate
              ? getDayLabels(weeks, rangeStartDate)
              : getWeekLabels(weeks)
            ).map(({ index, label }) => {
              if (chartWidth > 0) {
                const x = weeks === 1 ? chartWidth / 2 : (index / (weeks - 1)) * chartWidth;
                return (
                  <Text
                    key={`label-${index}`}
                    numberOfLines={1}
                    style={[styles.weekLabel, { position: 'absolute', left: x - 16 }]}
                  >
                    {label}
                  </Text>
                );
              }
              return (
                <Text key={`label-${index}`} numberOfLines={1} style={styles.weekLabel}>
                  {label}
                </Text>
              );
            })}
          </View>
        </View>

        {/* Right Y-axis labels (duration in minutes) */}
        <View style={styles.yAxisLabelsRight}>
          <Text style={[styles.yAxisLabel, { color: DURATION_COLOR }]}>
            {formatDurationAxisLabel(durationMax)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: DURATION_COLOR }]}>
            {formatDurationAxisLabel((durationMax + durationMin) / 2)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: DURATION_COLOR }]}>
            {formatDurationAxisLabel(durationMin)}
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SCORE_COLOR }]} />
          <Text style={styles.legendText}>Check-in score</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DURATION_COLOR }]} />
          <Text style={styles.legendText}>Practice time</Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxisLabels: {
    width: 24,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yAxisLabelsRight: {
    width: 30,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  yAxisLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  chartBody: {
    flex: 1,
    height: CHART_HEIGHT,
    position: 'relative',
    marginLeft: 4,
    marginRight: 4,
    marginBottom: 22,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dot: {
    position: 'absolute',
  },
  weekLabelsContainer: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    height: 14,
  },
  weekLabelsContainerFallback: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    height: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    width: 32,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 28,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
  },

});
