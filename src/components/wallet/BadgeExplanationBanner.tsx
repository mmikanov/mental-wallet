import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatExplanationMessage } from '@/utils/kpiBadgeUtils';

interface BadgeExplanationBannerProps {
  /** Snapshot of daysElapsed at the moment the card was opened */
  daysElapsedSnapshot: number | null;
  /** Whether the user has just completed a check-in (hides the banner) */
  checkInCompleted: boolean;
  /** Whether the user has ever recorded a KPI check-in */
  hasEverCheckedIn?: boolean;
}

export function BadgeExplanationBanner({ daysElapsedSnapshot, checkInCompleted, hasEverCheckedIn = true }: BadgeExplanationBannerProps) {
  if (daysElapsedSnapshot === null || daysElapsedSnapshot === 0 || checkInCompleted) {
    return null;
  }

  const message = formatExplanationMessage(daysElapsedSnapshot, hasEverCheckedIn);
  if (!message) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    color: '#5D4037',
    textAlign: 'center',
  },
});
