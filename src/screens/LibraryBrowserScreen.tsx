/**
 * LibraryBrowserScreen — Browse curated library cards grouped by category.
 *
 * Features:
 * - Header with "Library" title and close (X) button
 * - Horizontal category filter pills (All + each category)
 * - Cards grouped by category with section headers
 * - Each card shows: icon, title, description, category tag, "Library" badge
 * - "Add to wallet" button per card
 * - Duplicate detection: blocks adding a card that already exists in wallet
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
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
import { useWalletStore } from '@/stores/walletStore';
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
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [addingCardId, setAddingCardId] = useState<string | null>(null);

  // Build category lookup
  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; colorHex: string }> = {};
    for (const cat of SEED_CATEGORIES) {
      map[cat.id] = { name: cat.name, colorHex: cat.colorHex };
    }
    return map;
  }, []);

  // Build sections grouped by category (in category display order)
  const sections: CategorySection[] = useMemo(() => {
    const filteredCards =
      selectedCategory === ALL_FILTER
        ? CURATED_LIBRARY
        : CURATED_LIBRARY.filter((c) => c.categoryId === selectedCategory);

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
  }, [selectedCategory]);

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
          card.categoryId
        );

        // Reload wallet
        await loadCards();

        Alert.alert('Added', `"${card.title}" has been added to your wallet.`);
      } catch (error) {
        Alert.alert('Error', 'Failed to add card to wallet. Please try again.');
      } finally {
        setAddingCardId(null);
      }
    },
    [cards, loadCards]
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
      const isAlreadyInWallet = cards.some(
        (c) => c.title === item.title && c.originBadge === 'library'
      );

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
              style={[
                styles.addButton,
                isAlreadyInWallet && styles.addButtonDisabled,
              ]}
              onPress={() => handleAddToWallet(item)}
              disabled={isAdding || isAlreadyInWallet}
              accessibilityRole="button"
              accessibilityLabel={
                isAlreadyInWallet
                  ? `${item.title} already in wallet`
                  : `Add ${item.title} to wallet`
              }
            >
              <Text
                style={[
                  styles.addButtonText,
                  isAlreadyInWallet && styles.addButtonTextDisabled,
                ]}
              >
                {isAlreadyInWallet
                  ? 'In wallet'
                  : isAdding
                    ? 'Adding...'
                    : 'Add to wallet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [categoryMap, addingCardId, cards, handleAddToWallet]
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

      {/* Card list grouped by category */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        {sections.map((section) => (
          <View key={section.title}>
            {renderSectionHeader({ section })}
            {section.data.map((item) => (
              <View key={item.id}>
                {renderItem({ item, index: 0, section, separators: {} as any })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
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
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#8E8E93',
  },
});
