/**
 * ToolInsightsScreen — Per-tool insights panel showing correlation,
 * engagement, outcome trends, and disclaimer sections.
 *
 * Section order:
 *   1. DailyCheckInImpact — correlation insight
 *   2. EngagementSection — duration stats
 *   3. PerToolOutcomeTrendsSection — weekly outcome trend chart (hidden if <2 buckets)
 *   4. CorrelationDisclaimer — at bottom
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 2.1, 2.2
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { DailyCheckInImpact } from '@/components/insights/DailyCheckInImpact';
import { EngagementSection } from '@/components/insights/EngagementSection';
import { PerToolOutcomeTrendsSection } from '@/components/insights/PerToolOutcomeTrendsSection';
import { CorrelationDisclaimer } from '@/components/insights/CorrelationDisclaimer';
import { TimePeriodSelector } from '@/components/insights/TimePeriodSelector';
import { createDurationService, type DurationStats } from '@/services/durationService';
import {
  createCorrelationEngine,
  getTimePeriodStartDate,
  type ToolCorrelationResult,
  type WalletCorrelationResult,
} from '@/services/correlationEngine';
import {
  createTierEvaluator,
  type InsightTier,
  type TimePeriod,
  type TierProgress,
} from '@/services/tierEvaluator';
import { getOutcomePromptEnabled } from '@/services/settingsService';
import { computeDataAge, getDisabledPeriods, formatTrackingLabel } from '@/utils/dataAge';
import { logEvent } from '@/services/analyticsEventLogger';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolInsights'>;

// --- Available periods by tier ---

function getAvailablePeriodsForTier(tier: InsightTier): TimePeriod[] {
  switch (tier) {
    case 'confident':
      return ['7d', '30d', '90d', 'all'];
    case 'preliminary':
      return ['7d', '30d', 'all'];
    case 'nascent':
      return ['7d', 'all'];
    default:
      return ['7d', 'all'];
  }
}

export default function ToolInsightsScreen({ route, navigation }: Props) {
  const { cardId } = route.params;

  // --- Local state ---
  const [isLoading, setIsLoading] = useState(true);
  const [cardTitle, setCardTitle] = useState<string>('');
  const [tierProgress, setTierProgress] = useState<TierProgress | null>(null);
  const [correlation, setCorrelation] = useState<ToolCorrelationResult | null>(null);
  const [durationStats, setDurationStats] = useState<DurationStats | null>(null);
  const [hasHistoricalDurationData, setHasHistoricalDurationData] = useState(false);
  const [outcomeTrend, setOutcomeTrend] = useState<WalletCorrelationResult | null>(null);
  const [impactTimePeriod, setImpactTimePeriod] = useState<TimePeriod>('all');
  const [outcomePromptEnabled, setOutcomePromptEnabled] = useState<boolean>(true);
  const [dataAge, setDataAge] = useState<number>(0);

  // --- Services (memoized to avoid recreation) ---
  const durationService = useMemo(() => createDurationService(), []);
  const correlationEngine = useMemo(() => createCorrelationEngine(), []);
  const tierEvaluator = useMemo(() => createTierEvaluator(), []);

  // --- Derived state ---
  const currentTier: InsightTier = tierProgress?.currentTier ?? 'below_nascent';
  const availablePeriods = useMemo(
    () => getAvailablePeriodsForTier(currentTier),
    [currentTier]
  );

  // Determine if disclaimer should show negative correlation note
  const showNegativeCorrelationNote = useMemo(
    () => correlation?.correlationDirection === 'negative',
    [correlation]
  );

  // Derive disabled periods from data age
  const disabledPeriods = useMemo(() => getDisabledPeriods(dataAge), [dataAge]);

  // Format tracking label for header subtitle
  const trackingLabel = formatTrackingLabel(dataAge);
  const subtitleText = trackingLabel ? `${cardTitle} · ${trackingLabel}` : cardTitle;

  // --- Load data on mount ---
  useEffect(() => {
    loadInsightsData();
    void logEvent('insights_viewed', { screen: 'tool_insights', card_id: cardId });
  }, []);

  // --- Reload correlation when impact time period changes ---
  useEffect(() => {
    if (!isLoading) {
      reloadCorrelation();
    }
  }, [impactTimePeriod]);

  // --- Auto-select 'all' if current period becomes disabled ---
  useEffect(() => {
    if (disabledPeriods.includes(impactTimePeriod)) {
      setImpactTimePeriod('all');
    }
  }, [disabledPeriods, impactTimePeriod]);

  const loadInsightsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 0. Read outcome prompt setting
      const promptEnabled = await getOutcomePromptEnabled();
      setOutcomePromptEnabled(promptEnabled);

      // 0.5 Compute data age for period availability
      const { dataAge: computedDataAge } = await computeDataAge();
      setDataAge(computedDataAge);

      // 0.6 Determine effective period — if current period is disabled, fall back to 'all'
      const computedDisabledPeriods = getDisabledPeriods(computedDataAge);
      let effectivePeriod = impactTimePeriod;
      if (computedDisabledPeriods.includes(impactTimePeriod)) {
        effectivePeriod = 'all';
        setImpactTimePeriod('all');
      }

      // 1. Evaluate tier
      const tier = await tierEvaluator.evaluate();
      setTierProgress(tier);

      // 2. Load duration stats for this card (filtered by effective time period)
      const startDate = getTimePeriodStartDate(effectivePeriod);
      const stats = await durationService.getStats(cardId, startDate ?? undefined);
      setDurationStats(stats);

      // Check if tool has any historical duration data (for empty state messaging)
      if (!stats) {
        const allTimeStats = await durationService.getStats(cardId);
        setHasHistoricalDurationData(allTimeStats !== null);
      } else {
        setHasHistoricalDurationData(true);
      }

      // 2.5 Compute per-tool outcome trend (filtered by effective time period)
      try {
        const trendStartDate = getTimePeriodStartDate(effectivePeriod);
        const granularity: 'daily' | 'weekly' = effectivePeriod === '7d' || (effectivePeriod === 'all' && computedDataAge <= 14) ? 'daily' : 'weekly';
        const trend = await correlationEngine.computeToolOutcomeTrend(cardId, trendStartDate ?? undefined, granularity);
        setOutcomeTrend(trend);
      } catch (trendError) {
        console.warn('[ToolInsightsScreen] Failed to compute outcome trend:', trendError);
        // Leave outcomeTrend as null — section will be hidden
      }

      // 3. Compute correlation for this card if tier qualifies
      if (
        tier.currentTier === 'preliminary' ||
        tier.currentTier === 'confident'
      ) {
        // Try selected period first, then fall back to broader periods
        const periodsToTry: TimePeriod[] = [effectivePeriod];
        if (effectivePeriod !== 'all') {
          // Add fallbacks: if selected is 30d, try 90d then all
          if (effectivePeriod === '7d') periodsToTry.push('30d', '90d', 'all');
          else if (effectivePeriod === '30d') periodsToTry.push('90d', 'all');
          else if (effectivePeriod === '90d') periodsToTry.push('all');
        }

        let correlationResult: ToolCorrelationResult | null = null;
        for (const period of periodsToTry) {
          const qualifies = await tierEvaluator.cardQualifiesForCorrelation(
            cardId,
            tier.currentTier,
            period
          );
          if (qualifies) {
            correlationResult = await correlationEngine.computeSingleToolCorrelation(
              cardId,
              period
            );
            if (correlationResult) break;
          }
        }

        setCorrelation(correlationResult);
        if (correlationResult) {
          setCardTitle(correlationResult.cardTitle);
        }
      }

      // If we didn't get the card title from correlation, fetch it directly
      if (!cardTitle) {
        try {
          const { getDatabase } = await import('@/data/database');
          const db = await getDatabase();
          const row = await db.getFirstAsync<{ title: string }>(
            'SELECT title FROM cards WHERE id = ?',
            [cardId]
          );
          if (row) {
            setCardTitle(row.title);
          }
        } catch {
          // Non-critical — title is for display only
        }
      }
    } catch (error) {
      console.warn('[ToolInsightsScreen] Failed to load insights:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cardId, impactTimePeriod]);

  const reloadCorrelation = useCallback(async () => {
    if (!tierProgress) return;
    const tier = tierProgress.currentTier;

    // Reload duration stats for the new time period
    const startDate = getTimePeriodStartDate(impactTimePeriod);
    const stats = await durationService.getStats(cardId, startDate ?? undefined);
    setDurationStats(stats);

    // Check if tool has any historical duration data
    if (!stats) {
      const allTimeStats = await durationService.getStats(cardId);
      setHasHistoricalDurationData(allTimeStats !== null);
    } else {
      setHasHistoricalDurationData(true);
    }

    if (tier === 'preliminary' || tier === 'confident') {
      const periodsToTry: TimePeriod[] = [impactTimePeriod];
      if (impactTimePeriod !== 'all') {
        if (impactTimePeriod === '7d') periodsToTry.push('30d', '90d', 'all');
        else if (impactTimePeriod === '30d') periodsToTry.push('90d', 'all');
        else if (impactTimePeriod === '90d') periodsToTry.push('all');
      }

      let correlationResult: ToolCorrelationResult | null = null;
      for (const period of periodsToTry) {
        const qualifies = await tierEvaluator.cardQualifiesForCorrelation(
          cardId,
          tier,
          period
        );
        if (qualifies) {
          correlationResult = await correlationEngine.computeSingleToolCorrelation(
            cardId,
            period
          );
          if (correlationResult) break;
        }
      }

      setCorrelation(correlationResult);
    } else {
      setCorrelation(null);
    }

    // Reload outcome trend for the new time period
    try {
      const trendStartDate = getTimePeriodStartDate(impactTimePeriod);
      const granularity: 'daily' | 'weekly' = impactTimePeriod === '7d' || (impactTimePeriod === 'all' && dataAge <= 14) ? 'daily' : 'weekly';
      const trend = await correlationEngine.computeToolOutcomeTrend(cardId, trendStartDate ?? undefined, granularity);
      setOutcomeTrend(trend);
    } catch {
      // Leave as previous value
    }
  }, [tierProgress, cardId, impactTimePeriod, dataAge]);

  const handlePracticeNow = useCallback(() => {
    // Navigate back to wallet with this card focused
    navigation.navigate('MainTabs', {
      screen: 'Wallet',
      params: { focusCardId: cardId },
    });
  }, [navigation, cardId]);

  const handleImpactTimePeriodChange = useCallback((period: TimePeriod) => {
    setImpactTimePeriod(period);
  }, []);

  // --- Loading state ---
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <View style={styles.periodSelectorContainer}>
          <TimePeriodSelector
            availablePeriods={availablePeriods}
            selectedPeriod={impactTimePeriod}
            onPeriodChange={handleImpactTimePeriodChange}
            disabledPeriods={disabledPeriods}
          />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Insights</Text>
          {cardTitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitleText}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Anchored TimePeriodSelector — stays visible while scrolling */}
      <View style={styles.periodSelectorContainer}>
        <TimePeriodSelector
          availablePeriods={availablePeriods}
          selectedPeriod={impactTimePeriod}
          onPeriodChange={handleImpactTimePeriodChange}
          disabledPeriods={disabledPeriods}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Daily Check-In Impact (Req 10.1 — position 1) */}
        <DailyCheckInImpact
          correlation={correlation}
          tier={currentTier}
          timePeriod={impactTimePeriod}
          onTimePeriodChange={handleImpactTimePeriodChange}
          availablePeriods={availablePeriods}
          onPracticeNow={handlePracticeNow}
          outcomePromptEnabled={outcomePromptEnabled}
          showTimePeriodSelector={false}
        />

        {/* Section 2: Engagement (Req 10.1 — position 2) */}
        <EngagementSection stats={durationStats} hasHistoricalData={hasHistoricalDurationData} />

        {/* Section 3: Outcome Trends (Req 2.1, 2.2 — between Engagement and Disclaimer) */}
        <PerToolOutcomeTrendsSection data={outcomeTrend} />

        {/* Section 4: Correlation Disclaimer (Req 10.1 — bottom) */}
        <CorrelationDisclaimer
          showNegativeCorrelationNote={showNegativeCorrelationNote}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  periodSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
});
