/**
 * ReorderMode — Vertical list layout for reordering cards in the wallet.
 *
 * Entered on long-press (≥500ms) when ≥2 cards exist.
 * Shows cards with up/down arrow buttons and drag handle icon.
 * "Done" persists new order; tap outside discards changes.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { Card } from '@/types/index';

export interface ReorderModeProps {
  cards: Card[];
  categoryColors: Record<string, string>;
  onCommit: (newOrder: string[]) => void;
  onCancel: () => void;
}

export default function ReorderMode({
  cards,
  categoryColors,
  onCommit,
  onCancel,
}: ReorderModeProps) {
  // Local mutable order (array of card IDs) — changes only committed on "Done"
  const [orderedIds, setOrderedIds] = useState<string[]>(
    () => cards.map((c) => c.id)
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const orderedCards = orderedIds
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is Card => c !== undefined);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setDraggedIndex(index - 1);
    // Clear visual elevation after a brief moment
    setTimeout(() => setDraggedIndex(null), 300);
  }, []);

  const moveDown = useCallback(
    (index: number) => {
      if (index >= orderedIds.length - 1) return;
      setOrderedIds((prev) => {
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      });
      setDraggedIndex(index + 1);
      setTimeout(() => setDraggedIndex(null), 300);
    },
    [orderedIds.length]
  );

  const handleDone = useCallback(() => {
    onCommit(orderedIds);
  }, [onCommit, orderedIds]);

  const handleOutsideTap = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const renderItem = useCallback(
    ({ item, index }: { item: Card; index: number }) => {
      const isFirst = index === 0;
      const isLast = index === orderedCards.length - 1;
      const isDragged = draggedIndex === index;
      const categoryColor = categoryColors[item.categoryId] || '#9CA3AF';

      return (
        <View
          style={[
            styles.cardRow,
            isDragged && styles.cardRowElevated,
          ]}
          accessibilityLabel={`${item.title}, position ${index + 1} of ${orderedCards.length}`}
        >
          {/* Drag handle icon (visual indicator) */}
          <View style={styles.dragHandle} accessibilityLabel="Drag handle">
            <Text style={styles.dragHandleIcon}>☰</Text>
          </View>

          {/* Category color tag */}
          <View
            style={[styles.categoryTag, { backgroundColor: categoryColor }]}
          />

          {/* Card icon */}
          <Text style={styles.icon}>
            {item.iconType === 'emoji' ? item.iconValue : '📋'}
          </Text>

          {/* Card title */}
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {item.title}
          </Text>

          {/* Move up button */}
          <TouchableOpacity
            style={[styles.arrowButton, isFirst && styles.arrowButtonDisabled]}
            onPress={() => moveUp(index)}
            disabled={isFirst}
            accessibilityLabel={`Move ${item.title} up`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isFirst }}
          >
            <Text
              style={[
                styles.arrowText,
                isFirst && styles.arrowTextDisabled,
              ]}
            >
              ▲
            </Text>
          </TouchableOpacity>

          {/* Move down button */}
          <TouchableOpacity
            style={[styles.arrowButton, isLast && styles.arrowButtonDisabled]}
            onPress={() => moveDown(index)}
            disabled={isLast}
            accessibilityLabel={`Move ${item.title} down`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLast }}
          >
            <Text
              style={[
                styles.arrowText,
                isLast && styles.arrowTextDisabled,
              ]}
            >
              ▼
            </Text>
          </TouchableOpacity>
        </View>
      );
    },
    [orderedCards.length, draggedIndex, categoryColors, moveUp, moveDown]
  );

  const keyExtractor = useCallback((item: Card) => item.id, []);

  return (
    <Pressable style={styles.backdrop} onPress={handleOutsideTap}>
      <Pressable style={styles.container} onPress={() => {}}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reorder Cards</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            accessibilityLabel="Done reordering"
            accessibilityRole="button"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Card list */}
        <FlatList
          data={orderedCards}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
    minHeight: 56,
  },
  cardRowElevated: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    marginRight: 10,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandleIcon: {
    fontSize: 18,
    color: '#8E8E93',
  },
  categoryTag: {
    width: 4,
    height: 28,
    borderRadius: 2,
    marginRight: 10,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  arrowButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 16,
    color: '#007AFF',
  },
  arrowTextDisabled: {
    color: '#C7C7CC',
  },
});
