/**
 * StackedCardList — Renders cards in an Apple Wallet-style overlapping layout.
 *
 * Layout: Cards stack downward with the first card fully visible at top.
 * Each subsequent card overlaps the previous, showing only its top ~60px
 * (icon + title row visible). Uses ScrollView for the overlap layout
 * (negative margins don't work well with virtualized lists).
 *
 * Each CardEdge has an onPress handler (to focus) and onLongPress (to reorder).
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 17.1
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import CardEdge, { CARD_EDGE_HEIGHT } from './CardEdge';
import type { Card } from '@/types/index';

/** How much of each subsequent card peeks out below */
const VISIBLE_PEEK = 60;
/** Negative margin to create the overlapping effect */
const OVERLAP_MARGIN = -(CARD_EDGE_HEIGHT - VISIBLE_PEEK); // -140px

export interface StackedCardListProps {
  cards: Card[];
  categoryColors: Record<string, string>;
  onCardPress: (id: string) => void;
  onCardLongPress: (id: string) => void;
}

export default function StackedCardList({
  cards,
  categoryColors,
  onCardPress,
  onCardLongPress,
}: StackedCardListProps) {
  // Reverse the order so the first card (top of deck) renders at the BOTTOM
  // of the screen, and cards below it in the stack render above it.
  // This way users see the top edge of each card to identify it.
  const reversedCards = [...cards].reverse();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {reversedCards.map((card, index) => {
        const isLast = index === reversedCards.length - 1; // last rendered = top card in deck
        return (
          <View
            key={card.id}
            style={[
              styles.cardWrapper,
              {
                marginTop: index === 0 ? 0 : OVERLAP_MARGIN,
                zIndex: index, // higher index = rendered later = on top visually
              },
            ]}
          >
            <CardEdge
              card={card}
              categoryColor={categoryColors[card.categoryId] || '#8E8E93'}
              onPress={onCardPress}
              onLongPress={onCardLongPress}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  cardWrapper: {
    // Each wrapper lets the shadow & card render on top of the one below
  },
});
