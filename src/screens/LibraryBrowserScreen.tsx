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

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SEED_CATEGORIES } from '@/data/seeds';
import { createCardService } from '@/services/cardService';
import { getDatabase } from '@/data/database';
import { useWalletStore } from '@/stores/walletStore';
import { useAdminStore } from '@/stores/adminStore';
import { logEvent } from '@/services/analyticsEventLogger';
import {
  getMergedLibrary,
  getCardById,
  getStaticOverrides,
  deleteAdminCard,
  deleteStaticOverride,
  suppressStaticCard,
} from '@/services/adminCardService';
import { exportToClipboard } from '@/services/exportService';
import { renderCardIcon } from '@/utils/renderCardIcon';
import { getLibraryCardButtonState, sortNewestFirst } from './libraryBrowserHelpers';
import CardPreviewSheet from '@/components/wallet/CardPreviewSheet';
import type { SortMode, ButtonState } from './libraryBrowserHelpers';
import { CURATED_LIBRARY, type CuratedCardDefinition } from '@/data/curatedLibrary';

const ALL_FILTER = 'all';

interface CategorySection {
  title: string;
  colorHex: string;
  data: CuratedCardDefinition[];
}

type LibraryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LibraryBrowserScreen() {
  const navigation = useNavigation<LibraryNavigationProp>();
  const { cards, loadCards } = useWalletStore();
  const isAdminMode = useAdminStore((s) => s.isAdminMode);
  const toggleAdmin = useAdminStore((s) => s.toggleAdmin);
  const resetAdmin = useAdminStore((s) => s.resetAdmin);

  // Triple-tap gesture state for admin mode activation on Library Browser
  const tapCountRef = useRef(0);
  const firstTapTimeRef = useRef(0);
  const TRIPLE_TAP_WINDOW_MS = 500;

  const handleHeaderTitlePress = useCallback(() => {
    const now = Date.now();

    if (tapCountRef.current === 0 || now - firstTapTimeRef.current > TRIPLE_TAP_WINDOW_MS) {
      tapCountRef.current = 1;
      firstTapTimeRef.current = now;
    } else {
      tapCountRef.current += 1;
      if (tapCountRef.current >= 3) {
        toggleAdmin();
        tapCountRef.current = 0;
        firstTapTimeRef.current = 0;
      }
    }
  }, [toggleAdmin]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [restoringCardId, setRestoringCardId] = useState<string | null>(null);
  const [archivedLibraryCards, setArchivedLibraryCards] = useState<Map<string, string>>(new Map());

  // Merged library data source (static + admin + override cards)
  const [libraryCards, setLibraryCards] = useState<CuratedCardDefinition[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  // Preview sheet state
  const [previewCard, setPreviewCard] = useState<CuratedCardDefinition | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Set of static card IDs that have DB overrides (used for delete source detection)
  const [overrideIds, setOverrideIds] = useState<Set<string>>(new Set());

  // Set of override IDs that actually differ from their static original (true drafts)
  const [dirtyOverrideIds, setDirtyOverrideIds] = useState<Set<string>>(new Set());

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

  // Load merged library on screen focus (covers mount + returning from other screens)
  const loadMergedLibrary = useCallback(async () => {
    try {
      setIsLoadingLibrary(true);
      const merged = await getMergedLibrary();
      setLibraryCards(merged);

      // Load override IDs for source-aware deletion
      const overrides = await getStaticOverrides();
      setOverrideIds(new Set(overrides.map((o) => o.id)));

      // Compute dirty overrides: overrides whose content differs from the static original
      const dirty = new Set<string>();
      for (const override of overrides) {
        const staticOriginal = CURATED_LIBRARY.find((c) => c.id === override.id);
        if (!staticOriginal) {
          // No static original found — treat as dirty (shouldn't happen normally)
          dirty.add(override.id);
          continue;
        }
        // Compare shell fields
        const shellDiffers =
          override.title !== staticOriginal.title ||
          override.description !== staticOriginal.description ||
          override.iconValue !== staticOriginal.iconValue ||
          override.backgroundValue !== staticOriginal.backgroundValue ||
          override.categoryId !== staticOriginal.categoryId;

        if (shellDiffers) {
          dirty.add(override.id);
          continue;
        }

        // Compare controls (isRequired, config, type, count)
        if (override.controls.length !== staticOriginal.controls.length) {
          dirty.add(override.id);
          continue;
        }
        let controlsDiffer = false;
        for (let i = 0; i < override.controls.length; i++) {
          const dbCtrl = override.controls[i];
          const staticCtrl = staticOriginal.controls[i];
          if (
            dbCtrl.type !== staticCtrl.type ||
            dbCtrl.position !== staticCtrl.position ||
            dbCtrl.isRequired !== staticCtrl.isRequired ||
            JSON.stringify(dbCtrl.config) !== JSON.stringify(staticCtrl.config)
          ) {
            controlsDiffer = true;
            break;
          }
        }
        if (controlsDiffer) {
          dirty.add(override.id);
        }
      }
      setDirtyOverrideIds(dirty);
    } catch {
      // On failure, leave existing cards in place (or empty on first load)
    } finally {
      setIsLoadingLibrary(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMergedLibrary();
      loadArchivedCards();
    }, [loadMergedLibrary, loadArchivedCards])
  );

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
        ? libraryCards
        : libraryCards.filter((c) => c.categoryId === selectedCategory);

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
  }, [selectedCategory, searchQuery, categoryMap, libraryCards]);

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

  // Preview sheet handlers
  const handleOpenPreview = useCallback((card: CuratedCardDefinition) => {
    setPreviewCard(card);
    setPreviewVisible(true);
  }, []);

  const handleDismissPreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewCard(null);
  }, []);

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
        // Refresh merged library in case of changes
        await loadMergedLibrary();

        void logEvent('tool_added', {
          card_id: card.id,
          card_category: card.categoryId,
          origin_badge: 'library',
        });

        Alert.alert('Added', `"${card.title}" has been added to your wallet.`);
      } catch (error) {
        Alert.alert('Error', 'Failed to add card to wallet. Please try again.');
      } finally {
        setAddingCardId(null);
      }
    },
    [cards, loadCards, loadArchivedCards, loadMergedLibrary]
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
        // Refresh merged library
        await loadMergedLibrary();

        void logEvent('tool_unarchived', {
          card_id: card.id,
          card_category: card.categoryId,
          origin_badge: 'library',
        });

        Alert.alert('Restored', `"${card.title}" has been restored to your wallet.`);
      } catch (error) {
        Alert.alert('Error', 'Failed to restore card. Please try again.');
      } finally {
        setRestoringCardId(null);
      }
    },
    [archivedLibraryCards, loadCards, loadArchivedCards, loadMergedLibrary]
  );

  // Preview sheet action handlers — wrap existing logic for use from the sheet.
  // These avoid showing Alerts (the sheet has its own inline error/success UI).
  const handlePreviewAddToWallet = useCallback(
    async (card: CuratedCardDefinition) => {
      // Check for duplicate by title
      const existingCard = cards.find(
        (c) => c.title === card.title && c.originBadge === 'library'
      );
      if (existingCard) {
        throw new Error('This card is already in your wallet.');
      }

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
        card.id
      );

      // Reload wallet and archived cards map
      await loadCards();
      await loadArchivedCards();
      await loadMergedLibrary();

      void logEvent('tool_added', {
        card_id: card.id,
        card_category: card.categoryId,
        origin_badge: 'library',
      });
    },
    [cards, loadCards, loadArchivedCards, loadMergedLibrary]
  );

  const handlePreviewRestore = useCallback(
    async (card: CuratedCardDefinition) => {
      const archivedCardId = archivedLibraryCards.get(card.id) || archivedLibraryCards.get(card.title);

      if (!archivedCardId) {
        throw new Error('Failed to restore card. Please try again.');
      }

      const cardService = createCardService();
      await cardService.restore(archivedCardId);

      // Reload wallet and archived cards map
      await loadCards();
      await loadArchivedCards();
      await loadMergedLibrary();

      void logEvent('tool_unarchived', {
        card_id: card.id,
        card_category: card.categoryId,
        origin_badge: 'library',
      });
    },
    [archivedLibraryCards, loadCards, loadArchivedCards, loadMergedLibrary]
  );

  // ─── Admin action handlers ─────────────────────────────────────────────────

  /**
   * Determine the deletion source type for a card:
   * - 'admin' if id starts with 'admin-lib-'
   * - 'static-override' if the card's ID is in the overrideIds set
   * - 'static' if it's a plain static card with no override
   */
  const determineCardSource = useCallback(
    (card: CuratedCardDefinition): 'admin' | 'static-override' | 'static' => {
      if (card.id.startsWith('admin-lib-')) return 'admin';
      if (overrideIds.has(card.id)) return 'static-override';
      return 'static';
    },
    [overrideIds]
  );

  /**
   * Determine the source type for a card: 'admin' if id starts with 'admin-lib-', otherwise 'static'.
   * Used for edit navigation (which only distinguishes admin vs static).
   */
  const determineSource = useCallback(
    (card: CuratedCardDefinition): 'admin' | 'static' => {
      return card.id.startsWith('admin-lib-') ? 'admin' : 'static';
    },
    []
  );

  const handleAdminEdit = useCallback(
    (card: CuratedCardDefinition) => {
      navigation.navigate('CardCreator', {
        adminEditCardId: card.id,
        adminEditSource: determineSource(card),
      });
    },
    [navigation, determineSource]
  );

  const handleAdminExport = useCallback(
    async (card: CuratedCardDefinition) => {
      try {
        // Load the full Card object from DB for export
        const fullCard = await getCardById(card.id);
        if (!fullCard) {
          // Card has no DB representation (pure static) — build a minimal Card object
          const syntheticCard = {
            id: card.id,
            title: card.title,
            description: card.description,
            iconType: card.iconType,
            iconValue: card.iconValue,
            backgroundType: card.backgroundType,
            backgroundValue: card.backgroundValue,
            categoryId: card.categoryId,
            originBadge: 'library' as const,
            stackPosition: -1,
            totalUses: 0,
            currentStreak: 0,
            lastUsedAt: null,
            isArchived: false,
            archivedAt: null,
            previousStackPosition: null,
            allowBackgroundCustomization: card.allowBackgroundCustomization,
            sourceLibraryId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            controls: card.controls.map((ctrl, idx) => ({
              id: `synth-${idx}`,
              cardId: card.id,
              type: ctrl.type,
              position: ctrl.position,
              config: ctrl.config,
              isRequired: ctrl.isRequired,
            })),
          };
          await exportToClipboard(syntheticCard as any);
        } else {
          await exportToClipboard(fullCard);
        }
        Alert.alert('Exported', 'Card definition copied to clipboard');
      } catch {
        Alert.alert('Error', 'Failed to copy to clipboard.');
      }
    },
    []
  );

  const handleAdminDelete = useCallback(
    (card: CuratedCardDefinition) => {
      const source = determineCardSource(card);

      // Source-aware confirmation messaging
      let title: string;
      let message: string;

      switch (source) {
        case 'admin':
          title = 'Delete Library Tool';
          message = 'Delete this library tool? This cannot be undone.';
          break;
        case 'static-override':
          title = 'Revert to Original';
          message = 'Revert this library card to its original version?';
          break;
        case 'static':
          title = 'Hide Library Card';
          message = 'Hide this card from the library? It can be restored later.';
          break;
      }

      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: source === 'static-override' ? 'Revert' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              switch (source) {
                case 'admin':
                  await deleteAdminCard(card.id);
                  break;
                case 'static-override':
                  await deleteStaticOverride(card.id);
                  break;
                case 'static':
                  await suppressStaticCard(card.id);
                  break;
              }
              // Refresh library list after deletion
              await loadMergedLibrary();
            } catch {
              Alert.alert('Error', 'Failed to delete card. Please try again.');
            }
          },
        },
      ]);
    },
    [determineCardSource, loadMergedLibrary]
  );

  // Compute the button state for the currently previewed card
  const previewButtonState: ButtonState | null = useMemo(() => {
    if (!previewCard) return null;
    return getLibraryCardButtonState(
      previewCard.id,
      previewCard.title,
      cards,
      archivedLibraryCards
    );
  }, [previewCard, cards, archivedLibraryCards]);

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
        <TouchableOpacity
          style={styles.cardRow}
          onPress={() => handleOpenPreview(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Preview ${item.title}`}
          accessibilityHint="Opens a full card preview"
        >
          <View style={styles.cardIcon}>
            {renderCardIcon({
              iconType: item.iconType,
              iconValue: item.iconValue,
              size: 24,
              fallbackEmoji: item.iconValue || '📋',
            })}
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
                {isAdminMode && (item.id.startsWith('admin-lib-') || dirtyOverrideIds.has(item.id)) && (
                  <View style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>Draft</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.cardDescription}>
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
            {/* Admin mode action buttons */}
            {isAdminMode && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={styles.adminActionButton}
                  onPress={() => handleAdminEdit(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.title}`}
                >
                  <Text style={styles.adminActionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adminActionButton}
                  onPress={() => handleAdminExport(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Export ${item.title}`}
                >
                  <Text style={styles.adminActionButtonText}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminActionButton, styles.adminDeleteButton]}
                  onPress={() => handleAdminDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                >
                  <Text style={[styles.adminActionButtonText, styles.adminDeleteButtonText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {/* Preview hint */}
          <View style={styles.previewHint}>
            <Text style={styles.previewHintIcon}>Preview</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [categoryMap, addingCardId, restoringCardId, cards, archivedLibraryCards, handleAddToWallet, handleRestoreFromArchive, handleOpenPreview, isAdminMode, handleAdminEdit, handleAdminExport, handleAdminDelete]
  );

  const keyExtractor = useCallback(
    (item: CuratedCardDefinition) => item.id,
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleHeaderTitlePress}>
          <Text style={styles.headerTitle}>Library</Text>
        </Pressable>
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
      {isLoadingLibrary ? (
        <View style={styles.loadingState} accessibilityLabel="Loading library">
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      ) : filteredCards.length === 0 ? (
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

      {/* Card Preview Sheet */}
      {previewCard && previewButtonState && (
        <CardPreviewSheet
          card={previewCard}
          visible={previewVisible}
          onDismiss={handleDismissPreview}
          buttonState={previewButtonState}
          onAddToWallet={handlePreviewAddToWallet}
          onRestore={handlePreviewRestore}
        />
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
    alignItems: 'flex-start',
  },
  previewHint: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHintIcon: {
    fontSize: 11,
    color: '#AEAEB2',
    fontWeight: '500',
    letterSpacing: 0.2,
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
  draftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
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
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  adminActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  adminActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
    minHeight: 32,
    justifyContent: 'center',
  },
  adminActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A90D9',
  },
  adminDeleteButton: {
    backgroundColor: '#FFF0F0',
  },
  adminDeleteButtonText: {
    color: '#FF3B30',
  },
});
