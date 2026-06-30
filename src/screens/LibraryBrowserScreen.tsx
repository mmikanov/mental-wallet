/**
 * LibraryBrowserScreen — Browse curated library cards grouped by category.
 *
 * Features:
 * - Header with "Library" title and close (X) button
 * - Horizontal category filter pills (All + each category)
 * - Cards grouped by category with section headers
 * - Each card shows: icon, title, description, category tag, "Library" badge
 * - Three-state button per card: "Add to wallet" / "In wallet" / "Restore from archive"
 * - Duplicate detection: blocks adding a card that already exists in wallet
 * - Archive detection: offers restore for previously archived library cards
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 2.1, 2.2, 2.3
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { SEED_CATEGORIES } from '@/data/seeds';
import { createCardService } from '@/services/cardService';
import { getDatabase } from '@/data/database';
import { useWalletStore } from '@/stores/walletStore';
import { getLibraryCardButtonState, sortNewestFirst } from './libraryBrowserHelpers';
import type { SortMode } from './libraryBrowserHelpers';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';

const ALL_FILTER = 'all';

interface CategorySection {
  title: string;
  colorHex: string;
  data: CuratedCardDefinition[];
}

export default function LibraryBrowserScreen() {
  const navigation = useNavigation();
  const { cards, loadCards } = useWalletStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [restoringCardId, setRestoringCardId] = useState<string | null>(null);
  const [archivedLibraryCards, setArchivedLibraryCards] = useState<Map<string, string>>(new Map());

  // Load archived library cards from database
  const loadArchivedCards = useCallback(async () => {
    try {
      const db = await getDatabase();
      const map = new Map<string, string>();

      // Query cards with source_library_id
      const bySourceId = await db.getAllAsync<{ source_library_id: string; id: string }>(
        `SELECT source_library_id, id FROM cards WHERE origin_badge = 'library' AND is_archived = 1 AND source_library_id IS NOT NULL`
      );
      for (const row of bySourceId) {
        map.set(row.source_library_id, row.id);
      }

      // Query legacy cards without source_library_id (title fallback)
      const byTitle = await db.getAllAsync<{ title: string; id: string }>(
        `SELECT title, id FROM cards WHERE origin_badge = 'library' AND is_archived = 1 AND source_library_id IS NULL`
      );
      for (const row of byTitle) {
        map.set(row.title, row.id);
      }

      setArchivedLibraryCards(map);
    } catch {
      // If query fails, leave map empty — worst case shows "Add to wallet"
    }
  }, []);

  // Load archived cards on mount
  useEffect(() => {
    loadArchivedCards();
  }, [loadArchivedCards]);

  // Build category lookup
  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; colorHex: string }> = {};
    for (const cat of SEED_CATEGORIES) {
      map[cat.id] = { name: cat.name, colorHex: cat.colorHex };
    }
    return map;
  }, []);

  // Apply category + search filters
  const filteredCards = useMemo(() => {
    // Apply category filter
    const categoryFiltered =
      selectedCategory === ALL_FILTER
        ? CURATED_LIBRARY
        : CURATED_LIBRARY.filter((c) => c.categoryId === selectedCategory);

    // Apply search filter (triggers after 1 character)
    if (searchQuery.length >= 1) {
      return categoryFiltered.filter((c) => {
        const q = searchQuery.toLowerCase();
        const categoryName = categoryMap[c.categoryId]?.name ?? '';
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          categoryName.toLowerCase().includes(q)
        );
      });
    }

    return categoryFiltered;
  }, [selectedCategory, searchQuery, categoryMap]);

  // Build sections grouped by category (in category display order)
  const sections: CategorySection[] = useMemo(() => {
    if (sortMode !== 'category') return [];

    const grouped: Record<string, CuratedCardDefinition[]> = {};
    for (const card of filteredCards) {
      if (!grouped[card.categoryId]) {
        grouped[card.categoryId] = [];
      }
      grouped[card.categoryId].push(card);
    }

    // Sort by category display order
    return SEED_CATEGORIES.filter((cat) => grouped[cat.id])
      .map((cat) => ({
        title: cat.name,
        colorHex: cat.colorHex,
        data: grouped[cat.id],
      }));
  }, [filteredCards, sortMode]);

  // Flat list sorted newest-to-oldest for "Newest First" mode
  const newestFirstCards = useMemo(() => {
    if (sortMode !== 'newest') return [];
    return sortNewestFirst(filteredCards);
  }, [filteredCards, sortMode]);


  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleAddToWallet = useCallback(
    async (card: CuratedCardDefinition) => {
      // Check for duplicate by title
      const existingCard = cards.find(
        (c) => c.title === card.title && c.originBadge === 'library'
      );
      if (existingCard) {
        Alert.alert(
          'Already in wallet',
          'This card is already in your wallet.'
        );
        return;
      }

      setAddingCardId(card.id);

      try {
        const cardService = createCardService();
        await cardService.create(
          {
            title: card.title,
            description: card.description,
            iconType: card.iconType,
            iconValue: card.iconValue,
            backgroundType: card.backgroundType,
            backgroundValue: card.backgroundValue,
          },
          card.controls.map((ctrl) => ({
            type: ctrl.type,
            position: ctrl.position,
            config: ctrl.config,
            isRequired: ctrl.isRequired,
          })),
          'library',
          card.categoryId,
          card.id // Pass sourceLibraryId for future archive lookups
        );

        // Reload wallet
        await loadCards();
        // Refresh archived cards map
        await loadArchivedCards();

        Alert.alert('Added', `"${card.title}" has been added to your wallet.`);
      } catch (error) {
        Alert.alert('Error', 'Failed to add card to wallet. Please try again.');
      } finally {
        setAddingCardId(null);
      }
    },
    [cards, loadCards, loadArchivedCards]
  );

  const handleRestoreFromArchive = useCallback(
    async (card: CuratedCardDefinition) => {
      // Look up archived card ID by sourceLibraryId first, then title fallback
      const archivedCardId = archivedLibraryCards.get(card.id) || archivedLibraryCards.get(card.title);

      if (!archivedCardId) {
        Alert.alert('Error', 'Failed to restore card. Please try again.');
        return;
      }

      setRestoringCardId(card.id);

      try {
        const cardService = createCardService();
        await cardService.restore(archivedCardId);

        // Reload wallet
        await loadCards();
        // Refresh archived cards map (remove restored entry)
        await loadArchivedCards();

        Alert.alert('Restored', `"${card.title}" has been restored to your wallet.`);
      } catch (error) {
        Alert.alert('Error', 'Failed to restore card. Please try again.');
      } finally {
        setRestoringCardId(null);
      }
    },
    [archivedLibraryCards, loadCards, loadArchivedCards]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: CategorySection }) => (
      <View style={styles.sectionHeader}>
        <View
          style={[styles.sectionDot, { backgroundColor: section.colorHex }]}
        />
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: CuratedCardDefinition }) => {
      const category = categoryMap[item.categoryId];
      const isAdding = addingCardId === item.id;
      const isRestoring = restoringCardId === item.id;

      // Use three-state button logic
      const buttonState = getLibraryCardButtonState(
        item.id,
        item.title,
        cards,
        archivedLibraryCards
      );

      const handlePress = () => {
        if (buttonState.action === 'restore') {
          handleRestoreFromArchive(item);
        } else if (buttonState.action === 'add') {
          handleAddToWallet(item);
        }
      };

      const isDisabled = buttonState.disabled || isAdding || isRestoring;

      // Determine button style based on action
      const getButtonStyle = () => {
        if (buttonState.action === 'none') return [styles.addButton, styles.addButtonDisabled];
        if (buttonState.action === 'restore') return [styles.addButton, styles.restoreButton];
        return [styles.addButton];
      };

      const getButtonTextStyle = () => {
        if (buttonState.action === 'none') return [styles.addButtonText, styles.addButtonTextDisabled];
        return [styles.addButtonText];
      };

      const getAccessibilityLabel = () => {
        if (buttonState.action === 'restore') return `Restore ${item.title} from archive`;
        if (buttonState.action === 'none') return `${item.title} already in wallet`;
        return `Add ${item.title} to wallet`;
      };

      const getButtonLabel = () => {
        if (isAdding) return 'Adding...';
        if (isRestoring) return 'Restoring...';
        return buttonState.label;
      };

      return (
        <View style={styles.cardRow}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>{item.iconValue}</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.badges}>
                {category && (
                  <View
                    style={[
                      styles.categoryTag,
                      { backgroundColor: category.colorHex + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.categoryTagText, { color: category.colorHex }]}
                      numberOfLines={1}
                    >
                      {category.name}
                    </Text>
                  </View>
                )}
                <View style={styles.libraryBadge}>
                  <Text style={styles.libraryBadgeText}>Library</Text>
                </View>
              </View>
            </View>
            <Text style={styles.cardDescription} numberOfLines={1}>
              {item.description}
            </Text>
            <TouchableOpacity
              style={getButtonStyle()}
              onPress={handlePress}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={getAccessibilityLabel()}
            >
              <Text style={getButtonTextStyle()}>
                {getButtonLabel()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [categoryMap, addingCardId, restoringCardId, cards, archivedLibraryCards, handleAddToWallet, handleRestoreFromArchive]
  );

  const keyExtractor = useCallback(
    (item: CuratedCardDefinition) => item.id,
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close library"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search library..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search library cards"
          accessibilityHint="Filter cards by title, description, or category"
        />
      </View>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
        bounces={false}
      >
        <TouchableOpacity
          style={[
            styles.filterPill,
            selectedCategory === ALL_FILTER && styles.filterPillActive,
          ]}
          onPress={() => setSelectedCategory(ALL_FILTER)}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCategory === ALL_FILTER }}
          accessibilityLabel="All categories"
        >
          <Text
            style={[
              styles.filterPillText,
              selectedCategory === ALL_FILTER && styles.filterPillTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {SEED_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.filterPill,
              selectedCategory === cat.id && styles.filterPillActive,
              selectedCategory === cat.id && {
                backgroundColor: cat.colorHex,
              },
            ]}
            onPress={() => setSelectedCategory(cat.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === cat.id }}
            accessibilityLabel={`Filter by ${cat.name}`}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedCategory === cat.id && styles.filterPillTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort toggle */}
      <View style={styles.sortToggleContainer}>
        <TouchableOpacity
          style={[
            styles.sortToggleButton,
            sortMode === 'category' && styles.sortToggleButtonActive,
          ]}
          onPress={() => setSortMode('category')}
          accessibilityRole="button"
          accessibilityState={{ selected: sortMode === 'category' }}
          accessibilityLabel="Sort by category"
        >
          <Text
            style={[
              styles.sortToggleText,
              sortMode === 'category' && styles.sortToggleTextActive,
            ]}
          >
            By Category
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortToggleButton,
            sortMode === 'newest' && styles.sortToggleButtonActive,
          ]}
          onPress={() => setSortMode('newest')}
          accessibilityRole="button"
          accessibilityState={{ selected: sortMode === 'newest' }}
          accessibilityLabel="Sort newest first"
        >
          <Text
            style={[
              styles.sortToggleText,
              sortMode === 'newest' && styles.sortToggleTextActive,
            ]}
          >
            Newest First
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card list */}
      {filteredCards.length === 0 ? (
        <View style={styles.emptyState} accessibilityLabel="No matching cards found">
          <Text style={styles.emptyStateIcon}>🔍</Text>
          <Text style={styles.emptyStateTitle}>No matching cards found</Text>
          <Text style={styles.emptyStateMessage}>
            Try adjusting your search or filter to find what you're looking for.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={true}
        >
          {sortMode === 'category'
            ? sections.map((section) => (
                <View key={section.title}>
                  {renderSectionHeader({ section })}
                  {section.data.map((item) => (
                    <View key={item.id}>
                      {renderItem({ item })}
                    </View>
                  ))}
                </View>
              ))
            : newestFirstCards.map((item) => (
                <View key={item.id}>
                  {renderItem({ item })}
                </View>
              ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#636366',
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  searchInput: {
    height: 40,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  filterContainer: {
    height: 52,
    minHeight: 52,
    maxHeight: 52,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
    height: 34,
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#4A90D9',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636366',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  sortToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sortToggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    minHeight: 34,
    justifyContent: 'center',
  },
  sortToggleButtonActive: {
    backgroundColor: '#1C1C1E',
  },
  sortToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },
  sortToggleTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardIconText: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  libraryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
  },
  libraryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#636366',
  },
  cardDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  addButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#4A90D9',
    minHeight: 44,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  restoreButton: {
    backgroundColor: '#E8A838',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});
