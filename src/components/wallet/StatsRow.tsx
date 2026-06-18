/**
 * StatsRow — Displays card usage statistics in a compact row.
 *
 * Shows: total uses, current streak, and last used (relative time).
 * Formats last used as "today", "yesterday", "X days ago", or a date string.
 *
 * Uses accessibilityLiveRegion="polite" so screen readers announce stat updates
 * after a completion without interrupting the current announcement.
 *
 * Validates: Requirements 13.4, 17.3
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface StatsRowProps {
  totalUses: number;
  currentStreak: number;
  lastUsedAt: string | null;
}

/**
 * Formats lastUsedAt to a human-readable relative time string.
 */
function formatLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) return 'Never used';

  const lastDate = new Date(lastUsedAt);
  const now = new Date();

  // Compare calendar days in local timezone
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = today.getTime() - lastDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  // For older dates, show month and day
  return lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StatsRow({ totalUses, currentStreak, lastUsedAt }: StatsRowProps) {
  const lastUsedText = formatLastUsed(lastUsedAt);

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${totalUses} uses, ${currentStreak}-day streak, Last used ${lastUsedText}`}
      accessibilityLiveRegion="polite"
      accessibilityRole="summary"
    >
      <View style={styles.stat}>
        <Text style={styles.statValue}>{totalUses}</Text>
        <Text style={styles.statLabel}>uses</Text>
      </View>
      <View style={styles.separator} />
      <View style={styles.stat}>
        <Text style={styles.statValue}>{currentStreak}</Text>
        <Text style={styles.statLabel}>day streak</Text>
      </View>
      <View style={styles.separator} />
      <View style={styles.stat}>
        <Text style={styles.statLabel}>Last used</Text>
        <Text style={styles.statValue}>{lastUsedText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
});

export { formatLastUsed };
