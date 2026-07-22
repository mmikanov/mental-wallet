/**
 * WalletInsightsScreen — Top-level wallet insights screen composing
 * all insight sections in a fixed order with a unified time period selector.
 *
 * Section order (fixed):
 *   1. TimePeriodSelector (unified, at top)
 *   2. TierHintBanner (dismissible, tier-specific)
 *   3. Privacy note (first-visit only)
 *   4. KPI label change notice (with toggle)
 *   5. BestToolsSection
 *   6. EngagementMessage
 *   7. OutcomeTrendsSection
 *   8. TrySomethingDifferent (may render null if all tools used)
 *   9. ToolsToReconsider (may render null if no tools qualify or not at confident tier)
 *  10. TierProgressCard (progress toward next tier)
 *  11. CorrelationDisclaimer
 *  12. Crisis Resources link (always last)
 *
 * Validates: Requirements 5.1, 5.9, 5.10, 7.2, 10.4, 10.5, 10.6, 10.7, 3.9
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useInsightsStore } from '@/stores/insightsStore';
import { logEvent } from '@/services/analyticsEventLogger';
import { TimePeriodSelector } from '@/components/insights/TimePeriodSelector';
import { TierHintBanner } from '@/components/insights/TierHintBanner';
import { BestToolsSection } from '@/components/insights/BestToolsSection';
import { EngagementMessage } from '@/components/insights/EngagementMessage';
import { OutcomeTrendsSection } from '@/components/insights/OutcomeTrendsSection';
import { TrySomethingDifferent } from '@/components/insights/TrySomethingDifferent';
import { ToolsToReconsider } from '@/components/insights/ToolsToReconsider';
import { TierProgressCard } from '@/components/insights/TierProgressCard';
import { CorrelationDisclaimer } from '@/components/insights/CorrelationDisclaimer';
import {
  generateEngagementMessage,
  getEngagementData,
} from '@/utils/engagementMessaging';
import {
  computeDataAge,
  getDisabledPeriods,
  formatTrackingLabel,
} from '@/utils/dataAge';
import type { InsightTier, TimePeriod } from '@/services/tierEvaluator';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletInsights'>;

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

// --- Component ---

export default function WalletInsightsScreen({ navigation }: Props) {
  // --- Store state ---
  const {
    tierProgress,
    isLoading,
    timePeriod,
    walletCorrelation,
    bestTools,
    toolsToReconsider,
    kpiLabelChange,
    includePreChangeData,
    privacyNoteShown,
    loadWalletInsights,
    setTimePeriod,
    setIncludePreChangeData,
    dismissTool,
  } = useInsightsStore();

  // --- Local state ---
  const [engagementData, setEngagementData] = useState<{
    currentWeekCount: number;
    previousWeekCount: number;
    rollingAverage: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dataAge, setDataAge] = useState<number>(0);

  // --- Derived values ---
  const currentTier: InsightTier = tierProgress?.currentTier ?? 'below_nascent';
  const availablePeriods = useMemo(
    () => getAvailablePeriodsForTier(currentTier),
    [currentTier]
  );

  // Check if there are any negative correlations for the disclaimer
  const hasNegativeCorrelations = useMemo(
    () => toolsToReconsider.length > 0,
    [toolsToReconsider]
  );

  // Disabled periods based on data age
  const disabledPeriods = useMemo(
    () => getDisabledPeriods(dataAge),
    [dataAge]
  );

  // Tracking label
  const trackingLabel = formatTrackingLabel(dataAge);

  // --- Load data on mount ---
  useEffect(() => {
    loadWalletInsights();
    loadEngagementData();
    computeDataAge().then(({ dataAge: age }) => setDataAge(age));
    void logEvent('insights_viewed', { screen: 'wallet_insights' });
  }, []);

  const loadEngagementData = useCallback(async () => {
    try {
      const data = await getEngagementData();
      setEngagementData(data);
    } catch {
      // Silently fail — engagement message will use defaults
    }
  }, []);

  // --- Pull-to-refresh handler ---
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWalletInsights();
    await loadEngagementData();
    const { dataAge: age } = await computeDataAge();
    setDataAge(age);
    setRefreshing(false);
  }, [loadWalletInsights, loadEngagementData]);

  // --- Time period change handler ---
  const handlePeriodChange = useCallback(
    (period: TimePeriod) => {
      setTimePeriod(period);
    },
    [setTimePeriod]
  );

  // --- Auto-select 'all' if current period is disabled ---
  useEffect(() => {
    if (disabledPeriods.includes(timePeriod)) {
      setTimePeriod('all');
    }
  }, [disabledPeriods, timePeriod, setTimePeriod]);

  // --- Navigation handlers ---
  const handleNavigateToWallet = useCallback(() => {
    navigation.navigate('MainTabs');
  }, [navigation]);

  const handleNavigateToHelp = useCallback(() => {
    navigation.navigate('InsightsHelp');
  }, [navigation]);

  const handleToolPress = useCallback(
    (cardId: string) => {
      navigation.navigate('ToolInsights', { cardId });
    },
    [navigation]
  );

  const handleNavigateToCrisisResources = useCallback(() => {
    navigation.navigate('CrisisResources');
  }, [navigation]);

  // --- Archive handler for ToolsToReconsider ---
  const handleArchiveTool = useCallback(
    (_cardId: string) => {
      // Full archive wiring will be done in the navigation task.
      // For now, dismiss it from the list.
      dismissTool(_cardId);
    },
    [dismissTool]
  );

  // --- Keep handler for ToolsToReconsider ---
  const handleKeepTool = useCallback(
    (cardId: string) => {
      dismissTool(cardId);
    },
    [dismissTool]
  );

  // --- Engagement message ---
  const engagementMessage = useMemo(() => {
    if (!engagementData) return null;
    return generateEngagementMessage(
      currentTier,
      engagementData.currentWeekCount,
      engagementData.previousWeekCount,
      engagementData.rollingAverage
    );
  }, [engagementData, currentTier]);

  // --- Loading state ---
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Insights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2B7DE9" />
          <Text style={styles.loadingText}>Loading your insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Insights
          </Text>
          {trackingLabel && (
            <Text style={styles.trackingLabel}>
              {trackingLabel}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.helpLink}
          onPress={handleNavigateToHelp}
          accessibilityRole="link"
          accessibilityLabel="How this works. Learn how insights are calculated."
          testID="insights-help-link"
        >
          <Text style={styles.helpLinkText}>How this works</Text>
        </TouchableOpacity>
      </View>

      {/* Anchored TimePeriodSelector — stays visible while scrolling */}
      <View style={styles.periodSelectorContainer}>
        <TimePeriodSelector
          availablePeriods={availablePeriods}
          selectedPeriod={timePeriod}
          onPeriodChange={handlePeriodChange}
          disabledPeriods={disabledPeriods}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2B7DE9"
          />
        }
        testID="wallet-insights-scroll"
      >
        {/* 2. TierHintBanner */}
        <TierHintBanner tier={currentTier} />

        {/* 3. Privacy note (first-visit only) */}
        {!privacyNoteShown && <PrivacyNote />}

        {/* 4. KPI label change notice */}
        {kpiLabelChange && (
          <KpiLabelChangeNotice
            kpiLabelChange={kpiLabelChange}
            includePreChangeData={includePreChangeData}
            onToggle={setIncludePreChangeData}
          />
        )}

        {/* 5. BestToolsSection */}
        <View style={styles.sectionContainer}>
          <BestToolsSection
            bestTools={bestTools}
            tier={currentTier}
            tierProgress={tierProgress}
            selectedPeriod={timePeriod}
            onToolPress={handleToolPress}
            onExploreTools={handleNavigateToWallet}
          />
        </View>

        {/* 6. EngagementMessage — always about the current week */}
        {engagementMessage && (
          <View style={styles.engagementContainer}>
            <Text style={styles.engagementContextLabel}>This week</Text>
            <EngagementMessage message={engagementMessage} />
          </View>
        )}

        {/* 7. OutcomeTrendsSection */}
        <OutcomeTrendsSection
          tier={currentTier}
          tierProgress={tierProgress}
          walletCorrelation={walletCorrelation}
          onNavigateToWallet={handleNavigateToWallet}
        />

        {/* 8. TrySomethingDifferent */}
        <TrySomethingDifferent
          tools={[]}
          onToolPress={handleToolPress}
        />

        {/* 9. ToolsToReconsider */}
        {currentTier === 'confident' && (
          <View style={styles.sectionContainer}>
            <ToolsToReconsider
              tools={toolsToReconsider}
              onArchive={handleArchiveTool}
              onKeep={handleKeepTool}
            />
          </View>
        )}

        {/* 10. TierProgressCard */}
        {tierProgress && tierProgress.currentTier !== 'confident' && (
          <TierProgressCard
            tierProgress={tierProgress}
            onNavigateToWallet={handleNavigateToWallet}
          />
        )}

        {/* 11. CorrelationDisclaimer */}
        <View style={styles.sectionContainer}>
          <CorrelationDisclaimer
            showNegativeCorrelationNote={hasNegativeCorrelations}
          />
        </View>

        {/* 12. Crisis Resources link (always last) */}
        <TouchableOpacity
          style={styles.crisisResourcesLink}
          onPress={handleNavigateToCrisisResources}
          accessibilityRole="link"
          accessibilityLabel="Crisis support resources"
          testID="insights-crisis-resources-link"
        >
          <Text style={styles.crisisResourcesText}>
            Need support? Crisis resources →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Privacy Note Sub-Component ---

function PrivacyNote() {
  const markPrivacyNoteShown = useInsightsStore(
    (state) => state.markPrivacyNoteShown
  );

  const handleDismiss = useCallback(() => {
    markPrivacyNoteShown();
  }, [markPrivacyNoteShown]);

  return (
    <View style={styles.privacyNote} testID="privacy-note">
      <View style={styles.privacyNoteContent}>
        <Text style={styles.privacyNoteIcon}>{'🔒'}</Text>
        <Text style={styles.privacyNoteText}>
          All analysis happens on-device — no data leaves your phone.
        </Text>
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.privacyNoteDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss privacy note"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.privacyNoteDismissText}>OK</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- KPI Label Change Notice Sub-Component ---

interface KpiLabelChangeNoticeProps {
  kpiLabelChange: {
    previousLabel: string;
    newLabel: string;
    changedAt: string;
  };
  includePreChangeData: boolean;
  onToggle: (include: boolean) => void;
}

function KpiLabelChangeNotice({
  kpiLabelChange,
  includePreChangeData,
  onToggle,
}: KpiLabelChangeNoticeProps) {
  const formattedDate = useMemo(() => {
    try {
      const date = new Date(kpiLabelChange.changedAt);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }, [kpiLabelChange.changedAt]);

  return (
    <View style={styles.kpiChangeNotice} testID="kpi-label-change-notice">
      <Text style={styles.kpiChangeText}>
        You changed your focus from "{kpiLabelChange.previousLabel}" to "
        {kpiLabelChange.newLabel}" on {formattedDate}. Your earlier scores are{' '}
        {includePreChangeData ? 'included' : 'excluded'}.
      </Text>
      <View style={styles.kpiChangeToggle}>
        <Text style={styles.kpiChangeToggleLabel}>
          Include earlier data
        </Text>
        <Switch
          value={includePreChangeData}
          onValueChange={onToggle}
          accessibilityLabel="Include data from before your focus change"
          testID="kpi-change-toggle"
        />
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  trackingLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  helpLink: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  helpLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2B7DE9',
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
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  periodSelectorContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sectionContainer: {
    paddingHorizontal: 16,
  },
  // --- Privacy Note ---
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E8FA',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  privacyNoteContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyNoteIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  privacyNoteText: {
    fontSize: 13,
    color: '#1A3A5C',
    lineHeight: 18,
    flex: 1,
  },
  privacyNoteDismiss: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  privacyNoteDismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7DE9',
  },
  // --- KPI Change Notice ---
  kpiChangeNotice: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  kpiChangeText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
    marginBottom: 12,
  },
  kpiChangeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiChangeToggleLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  // --- Crisis Resources ---
  crisisResourcesLink: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  crisisResourcesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
  // --- Engagement Context ---
  engagementContainer: {
    marginBottom: 8,
  },
  engagementContextLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 20,
    marginBottom: 4,
  },
});
