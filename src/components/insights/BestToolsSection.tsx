/**
 * BestToolsSection — Displays ranked tools most correlated with KPI improvement.
 *
 * Shows different states based on tier:
 * - below_nascent/nascent OR empty bestTools: Empty state with progress indicator and "Explore your tools" CTA
 * - preliminary: Ranked list (up to 3) with "Early pattern" badge and hedged descriptors
 * - confident: Ranked list (up to 5) with confident descriptors
 *
 * Excludes tools with negative Score_Delta (handled upstream by the service).
 * Each tool entry is tappable, navigating to per-tool insights.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8, 6.9, 9.2
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { InsightTooltip } from './InsightTooltip';
import { scoreDeltaToWords } from '@/utils/accessibility';
import type { BestToolEntry } from '@/services/correlationEngine';
import type { InsightTier, TierProgress, TimePeriod } from '@/services/tierEvaluator';

// --- Props ---

export interface BestToolsSectionProps {
  bestTools: BestToolEntry[];
  tier: InsightTier;
  tierProgress: TierProgress | null;
  selectedPeriod?: TimePeriod;
  onToolPress?: (cardId: string) => void;
  onExploreTools?: () => void;
}

// --- Constants ---

const BEST_TOOLS_TOOLTIP =
  "Tools are ranked by how much higher your check-in scores tend to be on days you use them. Longer sessions count a bit more.";

// --- Helpers ---

function shouldShowEmptyState(tier: InsightTier, bestTools: BestToolEntry[]): boolean {
  return tier === 'below_nascent' || tier === 'nascent' || bestTools.length === 0;
}

function getProgressText(tierProgress: TierProgress | null): string {
  if (!tierProgress) {
    return 'Use more tools to start seeing which ones help most';
  }

  const parts: string[] = [];

  if (tierProgress.toolUsesNeeded > 0) {
    parts.push(
      `Use tools ${tierProgress.toolUsesNeeded} more ${tierProgress.toolUsesNeeded === 1 ? 'time' : 'times'}`
    );
  }

  if (tierProgress.distinctToolsNeeded > 0) {
    parts.push(
      `Try ${tierProgress.distinctToolsNeeded} more different ${tierProgress.distinctToolsNeeded === 1 ? 'tool' : 'tools'}`
    );
  }

  if (tierProgress.checkInsNeeded > 0) {
    parts.push(
      `Check in ${tierProgress.checkInsNeeded} more ${tierProgress.checkInsNeeded === 1 ? 'day' : 'days'}`
    );
  }

  if (parts.length === 0) {
    return 'Keep using your tools to see which ones help most';
  }

  return parts.join(' and ') + ' to start seeing which ones help most';
}

function getRankAccessibilityLabel(
  rank: number,
  entry: BestToolEntry
): string {
  const deltaWords = scoreDeltaToWords(entry.scoreDelta);
  const hedgedPrefix = entry.isHedged ? 'Early pattern. ' : '';
  const archivedPrefix = entry.isArchived ? 'Archived. ' : '';
  return `${archivedPrefix}${hedgedPrefix}Rank ${rank}. ${entry.cardTitle}. ${entry.descriptorLabel}. Linked to plus ${deltaWords} higher check-in days.`;
}

// --- Component ---

export function BestToolsSection({
  bestTools,
  tier,
  tierProgress,
  selectedPeriod,
  onToolPress,
  onExploreTools,
}: BestToolsSectionProps) {
  const showEmpty = shouldShowEmptyState(tier, bestTools);
  const isPreliminary = tier === 'preliminary';
  const isNarrowPeriodIssue = (tier === 'preliminary' || tier === 'confident') && bestTools.length === 0;

  return (
    <View style={styles.container} testID="best-tools-section">
      {/* Section header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Best Tools for You
        </Text>
        {!showEmpty && (
          <InsightTooltip
            explanation={BEST_TOOLS_TOOLTIP}
            isPreliminary={isPreliminary}
          />
        )}
      </View>

      {showEmpty ? (
        <EmptyState
          tierProgress={tierProgress}
          isNarrowPeriodIssue={isNarrowPeriodIssue}
          onExploreTools={onExploreTools}
        />
      ) : (
        <RankedList
          bestTools={bestTools}
          isPreliminary={isPreliminary}
          onToolPress={onToolPress}
        />
      )}
    </View>
  );
}

// --- Empty State Sub-Component ---

interface EmptyStateProps {
  tierProgress: TierProgress | null;
  isNarrowPeriodIssue: boolean;
  onExploreTools?: () => void;
}

function EmptyState({ tierProgress, isNarrowPeriodIssue, onExploreTools }: EmptyStateProps) {
  if (isNarrowPeriodIssue) {
    return (
      <View style={styles.emptyContainer} testID="best-tools-empty-state">
        <Text style={styles.emptyText}>
          Not enough activity in this time range to rank tools. Try a longer period.
        </Text>
      </View>
    );
  }

  const progressText = getProgressText(tierProgress);

  return (
    <View style={styles.emptyContainer} testID="best-tools-empty-state">
      <Text style={styles.emptyIcon}>{'📊'}</Text>
      <Text style={styles.emptyTitle}>Building your ranking</Text>
      <Text style={styles.emptyText}>{progressText}</Text>
      {onExploreTools && (
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={onExploreTools}
          accessibilityRole="link"
          accessibilityLabel="Explore your tools. Navigate to your wallet."
          testID="best-tools-explore-cta"
        >
          <Text style={styles.exploreButtonText}>Explore your tools →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Ranked List Sub-Component ---

interface RankedListProps {
  bestTools: BestToolEntry[];
  isPreliminary: boolean;
  onToolPress?: (cardId: string) => void;
}

function RankedList({ bestTools, isPreliminary, onToolPress }: RankedListProps) {
  return (
    <View style={styles.rankedListContainer} testID="best-tools-ranked-list">
      {/* Early pattern badge at Preliminary tier */}
      {isPreliminary && (
        <View style={styles.earlyPatternBadge} testID="early-pattern-badge">
          <Text style={styles.earlyPatternText}>Early pattern</Text>
        </View>
      )}

      {bestTools.map((entry, index) => {
        const rank = index + 1;
        const accessibilityLabel = getRankAccessibilityLabel(rank, entry);

        return (
          <TouchableOpacity
            key={entry.cardId}
            style={styles.toolEntry}
            onPress={() => onToolPress?.(entry.cardId)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            testID={`best-tool-entry-${rank}`}
            disabled={!onToolPress}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankNumber}>{rank}</Text>
            </View>
            <View style={styles.toolInfo}>
              <View style={styles.toolTitleRow}>
                <Text style={styles.toolTitle} numberOfLines={1}>
                  {entry.cardTitle}
                </Text>
                {entry.isArchived && (
                  <View style={styles.archivedBadge} testID={`best-tool-archived-badge-${rank}`}>
                    <Text style={styles.archivedBadgeText}>Archived</Text>
                  </View>
                )}
              </View>
              <Text style={styles.descriptorLabel} numberOfLines={2}>
                {entry.descriptorLabel}
              </Text>
            </View>
            {onToolPress && (
              <Text style={styles.chevron} accessibilityElementsHidden>
                {'\u203A'}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
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
  },
  // --- Empty state ---
  emptyContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 24,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  exploreButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7DE9',
  },
  // --- Ranked list ---
  rankedListContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  earlyPatternBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  earlyPatternText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  toolEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 44,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  toolInfo: {
    flex: 1,
    marginRight: 8,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  archivedBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  archivedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  descriptorLabel: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 22,
    color: '#9CA3AF',
    fontWeight: '300',
  },
});
