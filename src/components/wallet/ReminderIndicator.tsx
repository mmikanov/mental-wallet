/**
 * ReminderIndicator — A non-interactive bell icon badge displayed on stacked cards
 * to indicate an active reminder is configured.
 *
 * Renders at minimum 16×16pt with color adapting for ≥3:1 contrast ratio against
 * both light and dark card backgrounds.
 *
 * Validates: Requirements 3.4, 3.5
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface ReminderIndicatorProps {
  /** When true, uses dark color for light backgrounds; when false, uses light color for dark backgrounds */
  isLight: boolean;
}

/** Dark color for use on light backgrounds */
const DARK_COLOR = '#1C1C1E';
/** Light color for use on dark backgrounds */
const LIGHT_COLOR = '#FFFFFF';

export default function ReminderIndicator({ isLight }: ReminderIndicatorProps) {
  const iconColor = isLight ? DARK_COLOR : LIGHT_COLOR;

  return (
    <View
      style={styles.container}
      accessibilityLabel="Reminder set"
      accessibilityRole="image"
    >
      <Text style={[styles.icon, { color: iconColor }]}>🔔</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 16,
    minHeight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    lineHeight: 18,
  },
});
