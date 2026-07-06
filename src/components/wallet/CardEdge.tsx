/**
 * CardEdge — Full-width card representation in the Apple Wallet-style stacked layout.
 *
 * Shows: full background color, card icon (emoji) in top-left, bold title,
 * category color as a small dot. The card is 200px tall when fully visible.
 * When partially covered (overlapping), only the top ~60px shows (icon + title row).
 *
 * Provides minimum 44×44pt tap target (WCAG 2.1 AA).
 * Supports onPress (focus) and onLongPress (reorder mode).
 *
 * Validates: Requirements 1.1, 1.2, 17.3
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import type { Card } from '@/types/index';
import { isLightBackground } from '@/utils/cardColors';
import { renderCardIcon } from '@/utils/renderCardIcon';
import ReminderIndicator from './ReminderIndicator';

export interface CardEdgeProps {
  card: Card;
  categoryColor: string;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  /** When true, displays a bell icon indicator for active reminders */
  hasReminder?: boolean;
}

/** Full card height in the stacked view */
const CARD_EDGE_HEIGHT = 200;

export default function CardEdge({
  card,
  categoryColor,
  onPress,
  onLongPress,
  hasReminder = false,
}: CardEdgeProps) {
  const [bgImageFailed, setBgImageFailed] = useState(false);

  const hasBackgroundImage =
    card.backgroundType === 'image' && card.backgroundValue && !bgImageFailed;

  const bgColor =
    card.backgroundType === 'color'
      ? card.backgroundValue || '#FFFFFF'
      : card.backgroundType === 'gradient'
        ? card.backgroundValue?.split(',')[0] || '#FFFFFF'
        : '#FFFFFF';

  const backgroundStyle = { backgroundColor: bgColor };
  const isLight = isLightBackground(bgColor);
  const textColor = isLight ? '#1C1C1E' : '#FFFFFF';
  const subtitleColor = isLight ? '#4B5563' : 'rgba(255,255,255,0.7)';

  const content = (
    <View style={styles.contentContainer}>
      {/* Top row: icon + title + reminder indicator + category dot */}
      <View style={styles.topRow}>
        <View>
          {renderCardIcon({
            iconType: card.iconType,
            iconValue: card.iconValue,
            size: 28,
            fallbackEmoji: card.iconValue || '📋',
          })}
        </View>
        <Text
          style={[styles.title, { color: textColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityLabel={`Card: ${card.title}`}
        >
          {card.title}
        </Text>
        {hasReminder && (
          <View style={styles.reminderIndicator}>
            <ReminderIndicator isLight={isLight} />
          </View>
        )}
        <View
          style={[styles.categoryDot, { backgroundColor: categoryColor }]}
          accessibilityLabel="Category color indicator"
        />
      </View>

      {/* Description (visible when card is fully shown) */}
      <Text
        style={[styles.description, { color: subtitleColor }]}
        numberOfLines={2}
      >
        {card.description}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      style={[styles.container, backgroundStyle]}
      onPress={() => onPress(card.id)}
      onLongPress={() => onLongPress(card.id)}
      delayLongPress={500}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. Tap to focus, long press to reorder.`}
      accessibilityHint="Double tap to view card details"
    >
      <View style={styles.innerClip}>
        {hasBackgroundImage ? (
          <ImageBackground
            source={{ uri: card.backgroundValue }}
            style={styles.imageBackground}
            imageStyle={styles.imageStyle}
            onError={() => setBgImageFailed(true)}
          >
            <View style={styles.imageOverlay}>{content}</View>
          </ImageBackground>
        ) : (
          content
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CARD_EDGE_HEIGHT,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  innerClip: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  reminderIndicator: {
    marginLeft: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  imageBackground: {
    flex: 1,
  },
  imageStyle: {
    borderRadius: 16,
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
  },
});

export { CARD_EDGE_HEIGHT };
