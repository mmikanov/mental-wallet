/**
 * CollapsedStack — Apple Wallet-style collapsed cards at the bottom when one card is focused.
 *
 * Shows remaining cards as a super-tight stack where only thin edges (6px each)
 * are visible — just enough to show the card's background color. Only the TOP card
 * in the stack shows its top portion (~50px) with icon and title visible.
 *
 * Tapping the entire collapsed stack dismisses the focused card and returns
 * to the full stacked view (via onCardSelect which triggers returnToStack).
 *
 * Validates: Requirements 2.4, 2.5, 2.6, 3.2
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Card } from '@/types/index';
import { isLightBackground } from '@/utils/cardColors';

export interface CollapsedStackProps {
  cards: Card[];
  categoryColors: Record<string, string>;
  onCardSelect: (id: string) => void;
  onUncollapse?: () => void;
}

/** Thin edge height for deeply stacked cards */
const EDGE_HEIGHT = 6;
/** Height of the top card in the collapsed stack (partially visible) */
const TOP_CARD_HEIGHT = 52;

export default function CollapsedStack({
  cards,
  categoryColors,
  onCardSelect,
  onUncollapse,
}: CollapsedStackProps) {
  if (cards.length === 0) return null;

  const topCard = cards[0];
  const edgeCards = cards.slice(1);

  const topBgColor =
    topCard.backgroundType === 'color'
      ? topCard.backgroundValue || '#F3F4F6'
      : topCard.backgroundType === 'gradient'
        ? topCard.backgroundValue?.split(',')[0] || '#F3F4F6'
        : '#F3F4F6';

  const isLight = isLightBackground(topBgColor);
  const textColor = isLight ? '#1C1C1E' : '#FFFFFF';

  const handlePress = () => {
    if (onUncollapse) {
      onUncollapse();
    } else {
      onCardSelect(topCard.id);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${cards.length} other cards. Tap to show all cards.`}
    >
      {/* Edge cards — just thin colored lines */}
      {edgeCards.map((card, index) => {
        const bgColor =
          card.backgroundType === 'color'
            ? card.backgroundValue || '#E5E5EA'
            : card.backgroundType === 'gradient'
              ? card.backgroundValue?.split(',')[0] || '#E5E5EA'
              : '#E5E5EA';

        return (
          <View
            key={card.id}
            style={[
              styles.edge,
              { backgroundColor: bgColor },
              { zIndex: edgeCards.length - index },
            ]}
          />
        );
      })}

      {/* Top card — shows icon + title */}
      <View style={[styles.topCard, { backgroundColor: topBgColor }]}>
        <Text style={styles.topCardIcon}>
          {topCard.iconType === 'emoji' ? topCard.iconValue : '📋'}
        </Text>
        <Text
          style={[styles.topCardTitle, { color: textColor }]}
          numberOfLines={1}
        >
          {topCard.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  edge: {
    height: EDGE_HEIGHT,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topCard: {
    height: TOP_CARD_HEIGHT,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  topCardIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  topCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
