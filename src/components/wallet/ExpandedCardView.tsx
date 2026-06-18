/**
 * ExpandedCardView — Full expanded card view showing controls, submit button,
 * and collapse affordance. Used as the vertically expanded content area.
 *
 * This is the scrollable expanded card area that:
 * - Renders all controls via ControlRenderer
 * - Preserves input data when collapsing or switching cards
 * - Shows validation errors inline
 * - Handles submission and success feedback
 * - Provides collapse button to return to focused state
 *
 * In the current architecture, FocusedCardView conditionally renders ExpandedContent
 * when isExpanded=true. This component wraps ExpandedContent with additional
 * standalone styling for use outside FocusedCardView if needed.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import ExpandedContent from './ExpandedContent';
import type { Card } from '@/types/index';

interface ExpandedCardViewProps {
  card: Card;
}

/**
 * ExpandedCardView renders the scrollable expanded content area for a card.
 * It wraps ExpandedContent with scroll capabilities and proper spacing.
 */
export default function ExpandedCardView({ card }: ExpandedCardViewProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ExpandedContent card={card} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingBottom: 32,
  },
});
