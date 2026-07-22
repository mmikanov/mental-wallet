/**
 * DailyCheckInImpact — Per-tool correlation section showing how this tool
 * relates to the user's daily check-in scores.
 *
 * Displays Score_Delta in plain language with direction indicator (positive/neutral/negative),
 * effectiveness pattern when available, hedged qualifier at Preliminary tier,
 * and encouraging empty state with "Practice now" CTA when insufficient data.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 12.3, 12.4, 12.5, 12.6
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { InsightTooltip } from './InsightTooltip';
import { TimePeriodSelector } from './TimePeriodSelector';
import { scoreDeltaToWords } from '@/utils/accessibility';
import type { InsightTier, TimePeriod } from '@/services/tierEvaluator';
import type { ToolCorrelationResult, EffectivenessPattern } from '@/services/correlationEngine';

// --- Props ---

export interface DailyCheckInImpactProps {
  correlation: ToolCorrelationResult | null;
  tier: InsightTier;
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  availablePeriods: TimePeriod[];
  onPracticeNow?: () => void;
  /** Whether the post-use check-in setting is enabled. When false and no effectiveness data, shows a hint. */
  outcomePromptEnabled?: boolean;
  /** Whether to render the internal TimePeriodSelector. Default true for backwards compat. */
  showTimePeriodSelector?: boolean;
}

// --- Constants ---

const SCORE_DELTA_TOOLTIP =
  "We compare your check-in scores on days you used this tool (and the day before) to days you didn't. The difference is shown here.";

const EFFECTIVENESS_TOOLTIP =
  "We combine two signals: how your daily check-in relates to using this tool, and how you usually feel right after using it. Together, they tell us whether this tool is helping.";

const PATTERN_LABELS: Record<EffectivenessPattern, string> = {
  helpful_on_hard_days: 'Helpful on hard days',
  reliable_booster: 'Reliable booster',
  comfort_tool: 'Comfort tool',
  not_helping: 'Not helping much',
};

const PATTERN_DESCRIPTIONS: Record<EffectivenessPattern, string> = {
  helpful_on_hard_days:
    'You tend to reach for this on harder days, and it usually helps you feel better afterward. That\u2019s exactly what it\u2019s for.',
  reliable_booster:
    'This tool seems linked to better days, and you usually feel better right after using it too.',
  comfort_tool:
    'You tend to use this when things are tough. It sometimes helps, sometimes doesn\u2019t \u2014 and that\u2019s okay.',
  not_helping:
    'When you use this tool, you usually don\u2019t feel much different afterward. It might be worth trying something else \u2014 or this tool might help in ways that are hard to capture.',
};

// --- Direction indicators ---

const DIRECTION_ICONS: Record<'positive' | 'neutral' | 'negative', string> = {
  positive: '\u2197',  // ↗
  neutral: '\u2192',   // →
  negative: '\u2198',  // ↘
};

// --- Helpers ---

function shouldShowEmptyState(
  correlation: ToolCorrelationResult | null,
  tier: InsightTier
): boolean {
  return correlation === null || tier === 'below_nascent' || tier === 'nascent';
}

function getCorrelationText(correlation: ToolCorrelationResult): string {
  const { scoreDelta, correlationDirection } = correlation;

  if (correlationDirection === 'positive') {
    const delta = Math.abs(scoreDelta).toFixed(1);
    return `On days you use this tool, your check-in tends to be about ${delta} points higher`;
  }

  if (correlationDirection === 'negative') {
    return 'Your check-in tends to be a bit lower on days you use this \u2014 this might mean you reach for it on harder days, which is okay';
  }

  // neutral
  return 'Your check-in scores are similar whether or not you use this tool \u2014 it may help in ways not captured by a number';
}

function getCorrelationAccessibilityLabel(correlation: ToolCorrelationResult): string {
  const { scoreDelta, correlationDirection } = correlation;

  if (correlationDirection === 'positive') {
    const deltaWords = scoreDeltaToWords(scoreDelta);
    return `Upward trend. On days you use this tool, your check-in tends to be about ${deltaWords} points higher`;
  }

  if (correlationDirection === 'negative') {
    return 'Downward trend. Your check-in tends to be a bit lower on days you use this. This might mean you reach for it on harder days, which is okay';
  }

  return 'Neutral trend. Your check-in scores are similar whether or not you use this tool. It may help in ways not captured by a number';
}

// --- Component ---

export function DailyCheckInImpact({
  correlation,
  tier,
  timePeriod,
  onTimePeriodChange,
  availablePeriods,
  onPracticeNow,
  outcomePromptEnabled,
  showTimePeriodSelector = true,
}: DailyCheckInImpactProps) {
  const showEmpty = shouldShowEmptyState(correlation, tier);
  const isPreliminary = tier === 'preliminary';

  return (
    <View style={styles.container} testID="daily-checkin-impact-section">
      {/* Per-section TimePeriodSelector (always show when available) */}
      {showTimePeriodSelector && availablePeriods.length > 0 && (
        <View style={styles.periodSelectorContainer}>
          <TimePeriodSelector
            availablePeriods={availablePeriods}
            selectedPeriod={timePeriod}
            onPeriodChange={onTimePeriodChange}
          />
        </View>
      )}

      {showEmpty ? (
        <EmptyState onPracticeNow={onPracticeNow} />
      ) : (
        <CorrelationContent
          correlation={correlation!}
          isPreliminary={isPreliminary}
          outcomePromptEnabled={outcomePromptEnabled}
        />
      )}
    </View>
  );
}

// --- Empty State Sub-Component ---

interface EmptyStateProps {
  onPracticeNow?: () => void;
}

function EmptyState({ onPracticeNow }: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer} testID="daily-checkin-impact-empty">
      <Text style={styles.sectionTitle} accessibilityRole="header">Daily Check-In Impact</Text>
      <Text style={styles.emptyText}>
        Use this tool a few more times and we'll show how it relates to your
        check-in scores
      </Text>
      {onPracticeNow && (
        <TouchableOpacity
          style={styles.practiceNowButton}
          onPress={onPracticeNow}
          accessibilityRole="button"
          accessibilityLabel="Practice now. Opens this tool for practice."
          testID="daily-checkin-impact-practice-now"
        >
          <Text style={styles.practiceNowText}>Practice now →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Correlation Content Sub-Component ---

interface CorrelationContentProps {
  correlation: ToolCorrelationResult;
  isPreliminary: boolean;
  outcomePromptEnabled?: boolean;
}

function CorrelationContent({ correlation, isPreliminary, outcomePromptEnabled }: CorrelationContentProps) {
  const { correlationDirection, effectivenessPattern, outcomeEffectivenessScore } = correlation;
  const directionIcon = DIRECTION_ICONS[correlationDirection];
  const correlationText = getCorrelationText(correlation);
  const accessibilityLabel = getCorrelationAccessibilityLabel(correlation);
  const hasPattern = effectivenessPattern !== null && effectivenessPattern !== undefined;

  // Show hint when prompt is disabled and no effectiveness data (Req 12.6)
  const showOutcomeHint =
    outcomePromptEnabled === false && outcomeEffectivenessScore === null;

  return (
    <View style={styles.correlationContainer} testID="daily-checkin-impact-content">
      <View
        style={styles.correlationCard}
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        {/* Title row inside the card */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Daily Check-In Impact</Text>
          {/* Show Score_Delta tooltip only when NO effectiveness pattern */}
          {!hasPattern && (
            <InsightTooltip explanation={SCORE_DELTA_TOOLTIP} isPreliminary={isPreliminary} />
          )}
        </View>

        {/* Effectiveness pattern (when available) — includes its own tooltip */}
        {hasPattern && (
          <View style={styles.patternContainer} testID="effectiveness-pattern">
            <View style={styles.patternHeaderRow}>
              <View style={styles.patternBadge}>
                <Text style={styles.patternBadgeText}>
                  {PATTERN_LABELS[effectivenessPattern!]}
                </Text>
              </View>
              <InsightTooltip explanation={EFFECTIVENESS_TOOLTIP} isPreliminary={isPreliminary} />
            </View>
            <Text style={styles.patternDescription}>
              {PATTERN_DESCRIPTIONS[effectivenessPattern!]}
            </Text>
          </View>
        )}

        {/* Score_Delta interpretation — ONLY shown when NO effectiveness pattern */}
        {!hasPattern && (
          <View style={styles.correlationRow}>
            <Text
              style={[
                styles.directionIcon,
                correlationDirection === 'positive' && styles.directionPositive,
                correlationDirection === 'negative' && styles.directionNegative,
                correlationDirection === 'neutral' && styles.directionNeutral,
              ]}
            >
              {directionIcon}
            </Text>
            <Text style={styles.correlationText}>{correlationText}</Text>
          </View>
        )}

        {/* Preliminary tier qualifier */}
        {isPreliminary && (
          <View style={styles.qualifierContainer} testID="preliminary-qualifier">
            <Text style={styles.qualifierText}>Based on limited data</Text>
          </View>
        )}

        {/* Hint when outcome prompt is disabled and no effectiveness data (Req 12.6) */}
        {showOutcomeHint && (
          <View style={styles.outcomeHintContainer} testID="outcome-prompt-hint">
            <Text style={styles.outcomeHintText}>
              Enable post-use check-ins in Settings to get more detailed insights about this tool.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  // --- Empty state ---
  emptyContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 8,
  },
  practiceNowButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  practiceNowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7DE9',
  },
  // --- Correlation content ---
  correlationContainer: {},
  correlationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  correlationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  directionIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 1,
  },
  directionPositive: {
    color: '#059669',
  },
  directionNegative: {
    color: '#9CA3AF',
  },
  directionNeutral: {
    color: '#6B7280',
  },
  correlationText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    flex: 1,
  },
  // --- Effectiveness pattern ---
  patternContainer: {
    marginBottom: 4,
  },
  patternHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  patternBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  patternBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  patternDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginTop: 4,
  },
  // --- Preliminary qualifier ---
  qualifierContainer: {
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  qualifierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  // --- Time period selector ---
  periodSelectorContainer: {
    marginTop: 16,
  },
  // --- Outcome prompt disabled hint (Req 12.6) ---
  outcomeHintContainer: {
    marginTop: 12,
  },
  outcomeHintText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
