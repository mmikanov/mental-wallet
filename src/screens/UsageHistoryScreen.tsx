/**
 * UsageHistoryScreen — Displays a scrollable list of completions
 * for a specific card, newest first, with swipe-to-delete.
 *
 * Validates: Requirements 11.1, 11.2, 11.3
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
import { createCompletionService } from '../services/completionService';
import { createCardService } from '../services/cardService';
import type { Completion, Card, Control, ControlValue } from '../types/index';

type Props = NativeStackScreenProps<RootStackParamList, 'UsageHistory'>;

const PAGE_SIZE = 20;

export default function UsageHistoryScreen({ route, navigation }: Props) {
  const { cardId } = route.params;
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const completionService = createCompletionService();
  const cardService = createCardService();

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    try {
      const [cardData, completionData] = await Promise.all([
        cardService.getById(cardId),
        completionService.getByCard(cardId, { page: 1, pageSize: PAGE_SIZE }),
      ]);
      setCard(cardData);
      setCompletions(completionData);
      setHasMore(completionData.length === PAGE_SIZE);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const moreData = await completionService.getByCard(cardId, {
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setCompletions((prev) => [...prev, ...moreData]);
      setPage(nextPage);
      setHasMore(moreData.length === PAGE_SIZE);
    } catch {
      // Ignore pagination errors
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleDelete(completionId: string) {
    Alert.alert(
      'Delete Entry',
      'Delete this entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await completionService.deleteEntry(completionId);
            setCompletions((prev) => prev.filter((c) => c.id !== completionId));
          },
        },
      ]
    );
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getControlLabel(controlId: string): string {
    if (!card) return '';
    const control = card.controls.find((c) => c.id === controlId);
    if (!control) return '';
    const config = control.config as unknown as Record<string, unknown>;
    return (config.label as string) || (config.title as string) || control.type;
  }

  function formatControlValue(value: ControlValue): string {
    if (value.controlType === 'mood_slider') {
      return `${value.value}/10`;
    }
    if (value.controlType === 'checkbox') {
      return value.value === 'true' ? '✓' : '✗';
    }
    if (value.controlType === 'datetime_stamp') {
      return formatTimestamp(value.value);
    }
    return value.value || '—';
  }

  const renderCompletionItem = useCallback(
    ({ item }: { item: Completion }) => (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryTimestamp}>{formatTimestamp(item.completedAt)}</Text>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            accessibilityLabel="Delete entry"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
        {item.values.length > 0 && (
          <View style={styles.valuesContainer}>
            {item.values.map((val) => (
              <View key={val.id} style={styles.valueRow}>
                <Text style={styles.valueLabel}>{getControlLabel(val.controlId)}</Text>
                <Text style={styles.valueText}>{formatControlValue(val)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    ),
    [card]
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Usage History</Text>
          {card && <Text style={styles.headerSubtitle}>{card.title}</Text>}
        </View>
      </View>

      {completions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No completions yet</Text>
          <Text style={styles.emptyMessage}>
            Start using this tool to build your usage history. Each time you complete it, your entry will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={completions}
          keyExtractor={(item) => item.id}
          renderItem={renderCompletionItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator size="small" color="#4A90D9" style={styles.footerLoader} />
            ) : null
          }
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
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  entryCard: {
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
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTimestamp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  deleteButton: {
    fontSize: 14,
    color: '#E53935',
    fontWeight: '500',
    minWidth: 44,
    minHeight: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 44,
  },
  valuesContainer: {
    marginTop: 4,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  valueLabel: {
    fontSize: 13,
    color: '#666666',
    flex: 1,
    marginRight: 8,
  },
  valueText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
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
  footerLoader: {
    paddingVertical: 16,
  },
});
