/**
 * ReminderDisplayRow — Displays a bell icon and formatted reminder label.
 *
 * Shows the reminder time and frequency (e.g., "🔔 09:00 · Daily")
 * when the reminder is active. Renders nothing when reminder is null
 * or isActive is false.
 *
 * Positioned in FocusedCardView between StatsRow and the expand arrow.
 *
 * Validates: Requirements 2.1, 2.2, 2.7
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import type { Reminder } from '@/types';
import { formatReminderLabel } from '@/utils/formatReminderLabel';

interface ReminderDisplayRowProps {
  reminder: Reminder | null;
  textColor: string;
}

export default function ReminderDisplayRow({ reminder, textColor }: ReminderDisplayRowProps) {
  if (!reminder || !reminder.isActive) {
    return null;
  }

  const label = formatReminderLabel(reminder);

  return (
    <View style={styles.container} accessibilityLabel={`Reminder: ${label}`}>
      <Text style={[styles.icon, { color: textColor }]}>🔔</Text>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
});
