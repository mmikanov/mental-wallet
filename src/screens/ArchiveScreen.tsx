/**
 * ArchiveScreen — Displays archived cards sorted by most recently archived.
 * Allows restore to wallet or permanent deletion with confirmation.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { createCardService } from '../services/cardService';
import { getDatabase } from '../data/database';
import type { Card } from '../types/index';

type Props = NativeStackScreenProps<RootStackParamList, 'Archive'>;

export default function ArchiveScreen({ navigation }: Props) {
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const cardService = createCardService();

  useEffect(() => {
    loadArchivedCards();
  }, []);

  async function loadArchivedCards() {
    setIsLoading(true);
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT
          c.id, c.title, c.description, c.icon_type, c.icon_value,
          c.background_type, c.background_value, c.category_id,
          c.origin_badge, c.stack_position, c.total_uses, c.current_streak,
          c.last_used_at, c.is_archived, c.archived_at, c.previous_stack_position,
          c.created_at, c.updated_at
        FROM cards c
        WHERE c.is_archived = 1
        ORDER BY c.archived_at DESC`
      );

      const cards: Card[] = rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        description: row.description as string,
        iconType: row.icon_type as Card['iconType'],
        iconValue: row.icon_value as string,
        backgroundType: row.background_type as Card['backgroundType'],
        backgroundValue: row.background_value as string,
        categoryId: row.category_id as string,
        originBadge: row.origin_badge as Card['originBadge'],
        stackPosition: row.stack_position as number,
        totalUses: row.total_uses as number,
        currentStreak: row.current_streak as number,
        lastUsedAt: (row.last_used_at as string) || null,
        isArchived: true,
        archivedAt: (row.archived_at as string) || null,
        previousStackPosition: (row.previous_stack_position as number) ?? null,
        controls: [],
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));

      setArchivedCards(cards);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }

  function handleRestore(card: Card) {
    Alert.alert(
      'Restore Card',
      `Restore "${card.title}" to your wallet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await cardService.restore(card.id);
              setArchivedCards((prev) => prev.filter((c) => c.id !== card.id));
            } catch {
              Alert.alert('Error', 'Failed to restore card. Please try again.');
            }
          },
        },
      ]
    );
  }

  /**
   * Delete flow: confirmation prompt → permanent removal.
   * Validates: Requirements 14.4, 14.5, 14.6
   */
  function handleDelete(card: Card) {
    Alert.alert(
      'Delete Card Permanently',
      `This will permanently remove "${card.title}" and all associated data (usage history, statistics, and mood entries). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await cardService.delete(card.id);
              setArchivedCards((prev) => prev.filter((c) => c.id !== card.id));
            } catch {
              Alert.alert('Error', 'Failed to delete card. Please try again.');
            }
          },
        },
      ]
    );
  }

  function formatLastUsed(dateStr: string | null): string {
    if (!dateStr) return 'Never used';
    const date = new Date(dateStr);
    return `Last used: ${date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  function getCategoryLabel(categoryId: string): string {
    const labels: Record<string, string> = {
      'grounding-calming': 'Grounding & Calming',
      'cognitive-reframing': 'Cognitive Reframing',
      'body-sensory': 'Body & Sensory',
      'daily-checkin-journaling': 'Daily Check-In',
      'self-compassion-reminders': 'Self-Compassion',
      'lightweight-connection': 'Connection',
    };
    return labels[categoryId] || categoryId;
  }

  const renderCardItem = useCallback(
    ({ item }: { item: Card }) => (
      <View style={styles.cardItem}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>
            {item.iconType === 'emoji' ? item.iconValue : '📄'}
          </Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.cardMeta}>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>
                  {getCategoryLabel(item.categoryId)}
                </Text>
              </View>
              <Text style={styles.lastUsed}>{formatLastUsed(item.lastUsedAt)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => handleRestore(item)}
            accessibilityLabel={`Restore ${item.title} to wallet`}
            accessibilityRole="button"
          >
            <Text style={styles.restoreButtonText}>Restore to Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteCardButton}
            onPress={() => handleDelete(item)}
            accessibilityLabel={`Delete ${item.title} permanently`}
            accessibilityRole="button"
          >
            <Text style={styles.deleteCardButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archive</Text>
        <View style={styles.headerSpacer} />
      </View>

      {archivedCards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No archived cards</Text>
          <Text style={styles.emptyMessage}>
            Cards you archive from your wallet will appear here. You can restore them any time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedCards}
          keyExtractor={(item) => item.id}
          renderItem={renderCardItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    padding: 16,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryTag: {
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1565C0',
  },
  lastUsed: {
    fontSize: 12,
    color: '#888888',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  restoreButton: {
    flex: 1,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteCardButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E53935',
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteCardButtonText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
