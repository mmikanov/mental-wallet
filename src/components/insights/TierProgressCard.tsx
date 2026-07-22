/**
 * TierProgressCard — Shows the user's progress toward the next insight tier,
 * what unlocks at the next level, and an engagement CTA linking to the wallet.
 *
 * Displays progress bars for each dimension (check-ins, tool uses, distinct tools)
 * where additional data is still needed. Conditionally renders unlock descriptions
 * and CTA messaging based on current tier.
 *
 * Validates: Requirements 3.5, 5.10, 6.9
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { TierProgress } from '@/services/tierEvaluator';
import { TIER_THRESHOLDS } from '@/services/tierEvaluator';

// --- Props ---

export interface TierProgressCardProps {
  tierProgress: TierProgress;
  onNavigateToWallet?: () => void;
}

// --- Unlock descriptions per tier transition ---

const UNLOCK_TEXT: Record<string, string> = {
  nascent_to_preliminary:
    'Unlock early patterns and your first Best Tools ranking',
  preliminary_to_confident:
    'Unlock full insights, the dual-axis chart, and confident tool rankings',
};

// --- CTA messaging per tier ---

function getCtaText(tier: TierProgress['currentTier']): string | null {
  switch (tier) {
    case 'below_nascent':
    case 'nascent':
      return 'Keep practicing';
    case 'preliminary':
      return 'Almost there — keep going';
    case 'confident':
      return null;
  }
}

function getUnlockText(tierProgress: TierProgress): string | null {
  const { currentTier, nextTier } = tierProgress;
  if (!nextTier || currentTier === 'confident') return null;
  const key = `${currentTier}_to_${nextTier}`;
  // For below_nascent → nascent, provide a custom message
  if (currentTier === 'below_nascent') {
    return 'Start seeing your patterns and engagement trends';
  }
  return UNLOCK_TEXT[key] ?? null;
}

// --- Progress bar sub-component ---

interface ProgressRowProps {
  label: string;
  current: number;
  target: number;
}

function ProgressRow({ label, current, target }: ProgressRowProps) {
  const progress = Math.min(current / target, 1);
  const accessibleLabel = `${label}: ${current} of ${target}`;

  return (
    <View style={styles.progressRow} accessible accessibilityLabel={accessibleLabel}>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {current}/{target} {label}
      </Text>
    </View>
  );
}

// --- Main Component ---

export function TierProgressCard({ tierProgress, onNavigateToWallet }: TierProgressCardProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { currentTier, nextTier, checkInsNeeded, toolUsesNeeded, distinctToolsNeeded } = tierProgress;

  // Don't render if user is at confident tier (nothing to unlock)
  if (currentTier === 'confident') {
    return (
      <View style={styles.container} accessible accessibilityRole="text">
        <Text style={styles.completeText}>
          You've unlocked everything! Full insights are available.
        </Text>
      </View>
    );
  }

  // If no next tier (shouldn't happen if not confident), bail
  if (!nextTier) return null;

  const unlockText = getUnlockText(tierProgress);
  const ctaText = getCtaText(currentTier);

  // Determine thresholds for the next tier to show progress bars
  const nextThresholds = TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS];

  const handleNavigateToWallet = () => {
    if (onNavigateToWallet) {
      onNavigateToWallet();
    } else {
      navigation.navigate('MainTabs');
    }
  };

  return (
    <View style={styles.container} accessible accessibilityRole="summary">
      {/* Unlock description */}
      {unlockText && (
        <View style={styles.unlockRow}>
          <Text style={styles.unlockIcon}>{'🔓'}</Text>
          <Text style={styles.unlockText}>{unlockText}</Text>
        </View>
      )}

      {/* Progress indicators — only show dimensions where needed > 0 */}
      <View style={styles.progressSection}>
        {checkInsNeeded > 0 && nextThresholds && (
          <ProgressRow
            label="check-ins"
            current={nextThresholds.checkIns - checkInsNeeded}
            target={nextThresholds.checkIns}
          />
        )}
        {toolUsesNeeded > 0 && nextThresholds && (
          <ProgressRow
            label="tool uses"
            current={nextThresholds.toolUses - toolUsesNeeded}
            target={nextThresholds.toolUses}
          />
        )}
        {distinctToolsNeeded > 0 && nextThresholds && (
          <ProgressRow
            label="different tools"
            current={nextThresholds.distinctTools - distinctToolsNeeded}
            target={nextThresholds.distinctTools}
          />
        )}
      </View>

      {/* Remaining items summary */}
      <View style={styles.remainingSection}>
        {checkInsNeeded > 0 && (
          <Text style={styles.remainingText}>
            Check in {checkInsNeeded} more {checkInsNeeded === 1 ? 'day' : 'days'}
          </Text>
        )}
        {toolUsesNeeded > 0 && (
          <Text style={styles.remainingText}>
            Use tools {toolUsesNeeded} more {toolUsesNeeded === 1 ? 'time' : 'times'}
          </Text>
        )}
        {distinctToolsNeeded > 0 && (
          <Text style={styles.remainingText}>
            Try {distinctToolsNeeded} more different {distinctToolsNeeded === 1 ? 'tool' : 'tools'}
          </Text>
        )}
      </View>

      {/* Engagement CTA */}
      {ctaText && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleNavigateToWallet}
          accessibilityRole="link"
          accessibilityLabel={`${ctaText}. Navigate to your wallet.`}
        >
          <Text style={styles.ctaText}>{ctaText} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  unlockIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  progressSection: {
    marginBottom: 8,
  },
  progressRow: {
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2B7DE9',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  remainingSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  remainingText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  completeText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    textAlign: 'center',
  },
  ctaButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7DE9',
  },
});
