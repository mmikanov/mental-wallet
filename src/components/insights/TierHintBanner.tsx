/**
 * TierHintBanner — Dismissible one-time contextual hint shown
 * when a user first reaches each Insight_Tier.
 *
 * Displays tier-specific explanatory text and persists its
 * dismissed state via InsightsStore so it never reappears.
 *
 * Validates: Requirements 11.9, 11.10
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { InsightTier } from '@/services/tierEvaluator';
import { useInsightsStore } from '@/stores/insightsStore';

export interface TierHintBannerProps {
  tier: InsightTier;
}

const TIER_HINT_TEXT: Record<InsightTier, string> = {
  below_nascent: '', // Never shown
  nascent:
    "Welcome! As you check in and practice, we'll start spotting patterns for you.",
  preliminary:
    "You've unlocked early patterns! Keep going — more data means more confident insights.",
  confident:
    'Full insights unlocked! You now have access to your complete toolkit analysis.',
};

export function TierHintBanner({ tier }: TierHintBannerProps) {
  const tierHintsDismissed = useInsightsStore(
    (state) => state.tierHintsDismissed
  );

  // Don't render if already dismissed or if tier has no hint
  if (tierHintsDismissed[tier] || tier === 'below_nascent') {
    return null;
  }

  const text = TIER_HINT_TEXT[tier];

  const handleDismiss = () => {
    useInsightsStore.getState().dismissTierHint(tier);
  };

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={text}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{text}</Text>
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.dismissButton}
        accessibilityRole="button"
        accessibilityLabel="Dismiss hint"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.dismissText}>Got it</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  content: {
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A3A5C',
  },
  dismissButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7DE9',
  },
});
