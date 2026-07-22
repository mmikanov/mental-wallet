/**
 * EngagementMessage — Displays a tier-appropriate weekly activity
 * reinforcement message within the wallet-level Insights screen.
 *
 * Styled differently per tier:
 *   - Nascent: simple, plain text
 *   - Preliminary: slightly more prominent
 *   - Confident: full card with emphasis
 *
 * Validates: Requirements 5.7
 */

import React from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import type { EngagementMessage as EngagementMessageType } from '@/utils/engagementMessaging';
import type { InsightTier } from '@/services/tierEvaluator';

// --- Props ---

export interface EngagementMessageProps {
  message: EngagementMessageType;
}

// --- Styles ---

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  // Nascent: simple, plain
  containerNascent: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textNascent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    flex: 1,
  },
  // Preliminary: slightly more prominent
  containerPreliminary: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#D6E8FA',
  },
  textPreliminary: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A3A5C',
    fontWeight: '500',
    flex: 1,
  },
  // Confident: full card with emphasis
  containerConfident: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  textConfident: {
    fontSize: 15,
    lineHeight: 22,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
});

// --- Tier-based style map ---

interface TierVisualConfig {
  container: ViewStyle;
  text: TextStyle;
  icon: string;
}

const TIER_VISUALS: Record<InsightTier, TierVisualConfig> = {
  below_nascent: {
    container: styles.containerNascent,
    text: styles.textNascent,
    icon: '✨',
  },
  nascent: {
    container: styles.containerNascent,
    text: styles.textNascent,
    icon: '✨',
  },
  preliminary: {
    container: styles.containerPreliminary,
    text: styles.textPreliminary,
    icon: '🏃',
  },
  confident: {
    container: styles.containerConfident,
    text: styles.textConfident,
    icon: '🏃',
  },
};

// --- Component ---

export function EngagementMessage({ message }: EngagementMessageProps) {
  const visual = TIER_VISUALS[message.tier] ?? TIER_VISUALS.nascent;

  return (
    <View
      style={[styles.base, visual.container]}
      accessibilityRole="text"
      accessibilityLabel={message.text}
    >
      <Text style={styles.icon}>{visual.icon}</Text>
      <Text style={visual.text}>{message.text}</Text>
    </View>
  );
}
