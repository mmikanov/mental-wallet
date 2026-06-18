/**
 * OriginBadge — Small pill/tag showing the card's origin source.
 *
 * Displays "Library", "Community", or "My tool" with color coding:
 * - Library: blue
 * - Community: green
 * - My tool: purple
 *
 * Validates: Requirements 9.1
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
