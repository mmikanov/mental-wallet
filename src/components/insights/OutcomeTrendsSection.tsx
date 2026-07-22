/**
 * OutcomeTrendsSection — Wallet-level Outcome Trends section showing KPI
 * score trend, activity summary, and dual-axis chart progressively by tier.
 *
 * - below_nascent: Tier progress teaser only
 * - Nascent: KPI trend line + simple activity summary + "Your journey so far" framing + CTA
 * - Preliminary: Summary insight with hedged language + "Tools you've been using" list
 * - Confident: Full summary + DualAxisChart overlay
 *
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.8
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DualAxisChart from './DualAxisChart';
import { TierProgressCard } from './TierProgressCard';
import type { InsightTier, TierProgress } from '@/services/tierEvaluator';
import type { WalletCorrelationResult } from '@/services/correlationEngine';

// --- Props ---

export interface OutcomeTrendsSectionProps {
  tier: InsightTier;
  tierProgress: TierProgress | null;
  walletCorrelation: WalletCorrelationResult | null;
  onNavigateToWallet?: () => void;
}

// --- Component ---

export function OutcomeTrendsSection({
  tier,
  tierProgress,
  walletCorrelation,
  onNavigateToWallet,
}: OutcomeTrendsSectionProps) {
  // below_nascent: show tier progress teaser only
  if (tier === 'below_nascent') {
    return (
      <View style={styles.container} testID="outcome-trends-below-nascent">
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Outcome Trends
        </Text>
        {tierProgress && (
          <TierProgressCard
            tierProgress={tierProgress}
            onNavigateToWallet={onNavigateToWallet}
          />
        )}
      </View>
    );
  }

  if (tier === 'nascent') {
    return <NascentView walletCorrelation={walletCorrelation} tierProgress={tierProgress} onNavigateToWallet={onNavigateToWallet} />;
  }

  if (tier === 'preliminary') {
    return <PreliminaryView walletCorrelation={walletCorrelation} />;
  }

  // confident
  return <ConfidentView walletCorrelation={walletCorrelation} />;
}

// --- Nascent View ---

interface NascentViewProps {
  walletCorrelation: WalletCorrelationResult | null;
  tierProgress: TierProgress | null;
  onNavigateToWallet?: () => void;
}

function NascentView({ walletCorrelation, tierProgress, onNavigateToWallet }: NascentViewProps) {
  const totalCheckIns = tierProgress?.checkInCount ?? 0;
  const totalPractice = tierProgress?.toolUseCount ?? 0;

  return (
    <View style={styles.container} testID="outcome-trends-nascent">
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Your journey so far
      </Text>

      {/* Simple activity summary */}
      <View style={styles.contentCard}>
        <Text style={styles.activitySummary}>
          You've checked in {totalCheckIns} {totalCheckIns === 1 ? 'time' : 'times'} and
          practiced {totalPractice} {totalPractice === 1 ? 'time' : 'times'}
        </Text>

        {/* Simple trend dots if data available */}
        {walletCorrelation && walletCorrelation.weeklyAvgScore.length > 0 && (
          <View style={styles.trendDotsContainer}>
            {walletCorrelation.weeklyAvgScore.map((score, index) => (
              <View
                key={`trend-dot-${index}`}
                style={[
                  styles.trendDot,
                  { opacity: 0.4 + (score / 10) * 0.6 },
                ]}
                accessible={false}
              />
            ))}
          </View>
        )}

        {/* Encouragement CTA */}
        <Text style={styles.encouragementText}>
          Keep it up — a few more days and we'll start spotting patterns for you
        </Text>

        {onNavigateToWallet && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={onNavigateToWallet}
            accessibilityRole="link"
            accessibilityLabel="Go to your wallet to practice tools"
            testID="outcome-trends-nascent-cta"
          >
            <Text style={styles.ctaButtonText}>Go to wallet →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// --- Preliminary View ---

interface PreliminaryViewProps {
  walletCorrelation: WalletCorrelationResult | null;
}

function PreliminaryView({ walletCorrelation }: PreliminaryViewProps) {
  const summaryText = walletCorrelation?.summaryText ??
    'Early signs: days you practice tend to have slightly higher check-in scores';

  return (
    <View style={styles.container} testID="outcome-trends-preliminary">
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Outcome Trends
        </Text>
        <View style={styles.earlyPatternBadge}>
          <Text style={styles.earlyPatternBadgeText}>Early pattern</Text>
        </View>
      </View>

      <View style={styles.contentCard}>
        {/* Summary insight with hedged language */}
        <Text style={styles.summaryInsight}>{summaryText}</Text>

        {/* "Tools you've been using" placeholder list */}
        <View style={styles.toolsListSection}>
          <Text style={styles.toolsListTitle}>Tools you've been using</Text>
          <Text style={styles.toolsListHint}>
            Keep exploring your tools to build stronger patterns
          </Text>
        </View>
      </View>
    </View>
  );
}

// --- Confident View ---

interface ConfidentViewProps {
  walletCorrelation: WalletCorrelationResult | null;
}

function ConfidentView({ walletCorrelation }: ConfidentViewProps) {
  if (!walletCorrelation) {
    return (
      <View style={styles.container} testID="outcome-trends-confident-empty">
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Outcome Trends
        </Text>
        <View style={styles.contentCard}>
          <Text style={styles.emptyText}>Unable to load trend data</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="outcome-trends-confident">
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Outcome Trends
      </Text>

      <View style={styles.contentCard}>
        {/* Full summary text */}
        <Text style={styles.confidentSummary}>{walletCorrelation.summaryText}</Text>

        {/* DualAxisChart */}
        <DualAxisChart
          weeklyAvgScore={walletCorrelation.weeklyAvgScore}
          weeklyTotalDurationMin={walletCorrelation.weeklyTotalDurationMin}
          overallTrend={walletCorrelation.overallTrend}
          summaryText={walletCorrelation.summaryText}
          granularity={walletCorrelation.granularity}
          rangeStartDate={walletCorrelation.rangeStartDate}
        />
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  contentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  // --- Nascent ---
  activitySummary: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  trendDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingVertical: 8,
  },
  trendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  encouragementText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7DE9',
  },
  // --- Preliminary ---
  earlyPatternBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  earlyPatternBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  summaryInsight: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
  toolsListSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  toolsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  toolsListHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  // --- Confident ---
  confidentSummary: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 8,
  },
  // --- Empty ---
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
