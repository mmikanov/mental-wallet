/**
 * OriginBadge — Small pill/tag showing the card's origin source.
 *
 * Displays "Library", "Community", "My tool", or "App" with color coding:
 * - Library: blue
 * - Community: green
 * - My tool: purple
 * - App: dark blue (external wellness apps)
 *
 * Validates: Requirements 9.1, External App Tools 1.2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { OriginBadge as OriginBadgeType } from '@/types/index';

interface OriginBadgeProps {
  origin: OriginBadgeType;
}

const BADGE_CONFIG: Record<OriginBadgeType, { label: string; color: string; backgroundColor: string }> = {
  library: { label: 'Library', color: '#1A56DB', backgroundColor: '#DBEAFE' },
  community: { label: 'Community', color: '#047857', backgroundColor: '#D1FAE5' },
  my_tool: { label: 'My tool', color: '#6B21A8', backgroundColor: '#EDE9FE' },
  app: { label: 'App', color: '#1D4ED8', backgroundColor: '#DBEAFE' },
};

export default function OriginBadge({ origin }: OriginBadgeProps) {
  const config = BADGE_CONFIG[origin];

  return (
    <View
      style={[styles.badge, { backgroundColor: config.backgroundColor }]}
      accessibilityLabel={`Origin: ${config.label}`}
      accessibilityRole="text"
    >
      <Text style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
