/**
 * TipsFeedScreen — a browsable feed of the app's curated tips.
 *
 * Thin index: fetches the website's published tips index, renders a searchable /
 * filterable / sortable list of tip cards, and opens a tapped tip's full article in an
 * in-app browser. The app never renders tip bodies (the website is the single content home).
 *
 * Implements: in-app-tips-feed spec (Requirements 1-6).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Tip, TipType } from '@/types/tips';
import { getTips, resolveTipUrl } from '@/services/tipsService';
import { logEvent } from '@/services/analyticsEventLogger';

type Props = NativeStackScreenProps<RootStackParamList, 'Tips'>;

type SortKey = 'newest' | 'title';

const TYPE_FILTERS: { key: TipType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'feature', label: 'Features' },
  { key: 'problem_solving', label: 'Problem solving' },
  { key: 'come_back', label: 'Reminders' },
];

const TYPE_BADGE_LABEL: Record<TipType, string> = {
  feature: 'Feature',
  problem_solving: 'Problem solving',
  come_back: 'Reminder',
};

export default function TipsFeedScreen({ navigation }: Props) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [offlineData, setOfflineData] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TipType | 'all'>('all');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(false);
    try {
      const { tips: loaded, fromCache } = await getTips();
      setTips(loaded);
      setOfflineData(fromCache);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    void logEvent('tips_feed_viewed');
  }, [load]);

  // Union of topics across all tips (for the topic filter chips).
  const allTopics = useMemo(() => {
    const set = new Set<string>();
    for (const t of tips) for (const topic of t.topics) set.add(topic);
    return Array.from(set).sort();
  }, [tips]);

  // Client-side search + filter + sort.
  const visibleTips = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = tips.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (topicFilter && !t.topics.includes(topicFilter)) return false;
      if (q) {
        const hay = `${t.title} ${t.summary} ${t.topics.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = out.slice().sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      return (b.publishedAt || '').localeCompare(a.publishedAt || ''); // newest
    });
    return out;
  }, [tips, query, typeFilter, topicFilter, sortKey]);

  const openTip = useCallback(async (tip: Tip) => {
    const url = resolveTipUrl(tip);
    try {
      void logEvent('tip_opened', { slug: tip.slug });
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: '#4A90D9',
        toolbarColor: '#FFFFFF',
      });
    } catch (err) {
      Alert.alert(
        "Couldn't open tip",
        `Something went wrong opening this tip.\n\n${url}`,
        [{ text: 'OK' }]
      );
    }
  }, []);

  const renderTip = useCallback(
    ({ item }: { item: Tip }) => (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openTip(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.summary}`}
        accessibilityHint="Opens the full tip"
      >
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSummary}>{item.summary}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{TYPE_BADGE_LABEL[item.type]}</Text>
          </View>
          {item.topics.map((topic) => (
            <View key={topic} style={styles.topicChip}>
              <Text style={styles.topicChipText}>{topic}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    ),
    [openTip]
  );

  // --- Header / controls (rendered above the list) ---
  const controls = (
    <View>
      {offlineData && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Showing saved tips. Pull to refresh when online.</Text>
        </View>
      )}
      <TextInput
        style={styles.search}
        placeholder="Search tips..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search tips"
        autoCorrect={false}
        returnKeyType="search"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setTypeFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter: ${f.label}`}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {allTopics.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          <TouchableOpacity
            style={[styles.filterPill, topicFilter === null && styles.filterPillActive]}
            onPress={() => setTopicFilter(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: topicFilter === null }}
            accessibilityLabel="Topic: all"
          >
            <Text style={[styles.filterPillText, topicFilter === null && styles.filterPillTextActive]}>
              All topics
            </Text>
          </TouchableOpacity>
          {allTopics.map((topic) => {
            const active = topicFilter === topic;
            return (
              <TouchableOpacity
                key={topic}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setTopicFilter(active ? null : topic)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Topic: ${topic}`}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{topic}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        <TouchableOpacity
          onPress={() => setSortKey('newest')}
          accessibilityRole="button"
          accessibilityState={{ selected: sortKey === 'newest' }}
        >
          <Text style={[styles.sortOption, sortKey === 'newest' && styles.sortOptionActive]}>Newest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortKey('title')}
          accessibilityRole="button"
          accessibilityState={{ selected: sortKey === 'title' }}
        >
          <Text style={[styles.sortOption, sortKey === 'title' && styles.sortOptionActive]}>Title</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tips</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.loadingText}>Loading tips…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>📡</Text>
          <Text style={styles.stateTitle}>Couldn't load tips</Text>
          <Text style={styles.stateMessage}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load(false)} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleTips}
          keyExtractor={(t) => t.slug}
          renderItem={renderTip}
          ListHeaderComponent={controls}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} tintColor="#4A90D9" />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.stateIcon}>🔍</Text>
              <Text style={styles.stateTitle}>No tips match</Text>
              <Text style={styles.stateMessage}>Try a different search or filter.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backButtonText: { fontSize: 16, color: '#4A90D9', fontWeight: '500' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  headerSpacer: { width: 44 },

  listContent: { padding: 16 },

  offlineBanner: {
    backgroundColor: '#FFF4E5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  offlineText: { fontSize: 13, color: '#A15C00' },

  search: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 10,
  },
  filterRow: { marginBottom: 8 },
  filterRowContent: { gap: 8, paddingRight: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  filterPillActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  filterPillText: { fontSize: 13, color: '#666666' },
  filterPillTextActive: { color: '#FFFFFF', fontWeight: '600' },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2, marginBottom: 12 },
  sortLabel: { fontSize: 13, color: '#888888' },
  sortOption: { fontSize: 13, color: '#666666' },
  sortOptionActive: { color: '#4A90D9', fontWeight: '700' },

  card: {
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  cardSummary: { fontSize: 14, color: '#666666', marginBottom: 12, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  typeBadge: { backgroundColor: '#EAF2FB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: '#4A90D9' },
  topicChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  topicChipText: { fontSize: 11, color: '#888888' },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666666' },
  stateIcon: { fontSize: 40, marginBottom: 12 },
  stateTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  stateMessage: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: '#4A90D9', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
