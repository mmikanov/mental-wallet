/**
 * renderCardIcon — Shared utility for rendering card icons across
 * CardEdge, FocusedCardView, and other card display components.
 *
 * Handles:
 * - 'emoji' → renders the emoji character as Text
 * - 'third_party' → renders ThirdPartyIcon with URI and emoji fallback
 * - default → renders 📋 fallback
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import type { IconType } from '@/types/index';
import ThirdPartyIcon from '@/components/wallet/ThirdPartyIcon';

export interface RenderCardIconOptions {
  iconType: IconType;
  iconValue: string;
  size: number;
  fallbackEmoji?: string;
}

/**
 * Renders the appropriate icon element based on iconType.
 *
 * @param iconType - The type of icon to render ('emoji', 'third_party', etc.)
 * @param iconValue - The icon value (emoji character or URI for third_party)
 * @param size - Font size for emoji or pixel size for third-party image
 * @param fallbackEmoji - Emoji to show if third-party image fails (defaults to iconValue or '📋')
 */
export function renderCardIcon({
  iconType,
  iconValue,
  size,
  fallbackEmoji,
}: RenderCardIconOptions): React.ReactNode {
  switch (iconType) {
    case 'emoji':
      return (
        <Text style={[styles.icon, { fontSize: size }]} accessibilityLabel="Card icon">
          {iconValue}
        </Text>
      );
    case 'third_party':
      return (
        <ThirdPartyIcon
          uri={iconValue}
          fallbackEmoji={fallbackEmoji || '📋'}
          size={size}
        />
      );
    default:
      return (
        <Text style={[styles.icon, { fontSize: size }]} accessibilityLabel="Card icon">
          📋
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});
