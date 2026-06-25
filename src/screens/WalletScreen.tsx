/**
 * WalletScreen — Main screen with Apple Wallet-style card layout.
 *
 * - Calls useWalletStore().loadCards() on mount
 * - Shows EmptyWalletState when 0 cards
 * - Shows StackedCardList when cards exist and no card is focused
 *   (overlapping full-width cards, first card fully visible, rest peek)
 * - Shows FocusedCardView (big card top ~65% screen) + CollapsedStack
 *   (thin strips at bottom) when a card is focused
 * - Dark dimmed background between focused card and collapsed stack
 *
 * Validates: Requirements 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import WalletHeader from '@/components/wallet/WalletHeader';
import StackedCardList from '@/components/wallet/StackedCardList';
import EmptyWalletState from '@/components/wallet/EmptyWalletState';
import FocusedCardView from '@/components/wallet/FocusedCardView';
import CollapsedStack from '@/components/wallet/CollapsedStack';
import ReorderMode from '@/components/wallet/ReorderMode';
import CardKebabMenu from '@/components/wallet/CardKebabMenu';
import BackgroundCustomizerSheet from '@/components/wallet/BackgroundCustomizerSheet';
import { useWalletStore } from '@/stores/walletStore';
import { createCardService } from '@/services/cardService';
import { upsertOverlay, removeOverlay } from '@/services/backgroundOverlayService';
import type { BackgroundType } from '@/types/index';
import type { RootStackParamList } from '@/navigation/types';

type WalletNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Category colors matching the seeded category IDs from the database.
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'grounding-calming': '#6B9EC4',
  'cognitive-reframing': '#8B7EC8',
  'body-sensory': '#E88D67',
  'daily-checkin-journaling': '#5BA88B',
  'self-compassion-reminders': '#D4A5C9',
  'lightweight-connection': '#E6C84C',
};

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WalletScreen() {
  const navigation = useNavigation<WalletNavigationProp>();
  const {
    cards,
    loadCards,
    focusedCardId,
    isExpanded,
    isReorderMode,
    focusCard,
    expandCard,
    collapseCard,
    returnToStack,
    enterReorderMode,
    commitReorder,
    cancelReorder,
  } = useWalletStore();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [showBackgroundCustomizer, setShowBackgroundCustomizer] = useState(false);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = { ...DEFAULT_CATEGORY_COLORS };
    return colors;
  }, []);

  const focusedCard = useMemo(
    () => (focusedCardId ? cards.find((c) => c.id === focusedCardId) ?? null : null),
    [focusedCardId, cards]
  );

  const otherCards = useMemo(
    () => (focusedCardId ? cards.filter((c) => c.id !== focusedCardId) : []),
    [focusedCardId, cards]
  );

  function handleArchivePress() {
    navigation.navigate('Archive');
  }

  function handleSettingsPress() {
    navigation.navigate('Settings');
  }

  function handleAddToolPress() {
    navigation.navigate('LibraryBrowser');
  }

  function handleCreateToolPress() {
    navigation.navigate('CardCreator');
  }

  function handleCardPress(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.create(300, 'easeInEaseOut', 'opacity'));
    focusCard(id);
  }

  function handleCardLongPress(_id: string) {
    enterReorderMode();
  }

  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsDismissing(true);
    // Allow the opacity transition to render, then switch view
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsDismissing(false);
        LayoutAnimation.configureNext({
          duration: 400,
          create: { type: 'easeInEaseOut', property: 'opacity' },
          update: { type: 'spring', springDamping: 0.7 },
        });
        returnToStack();
      }, 150);
    });
  }, [returnToStack]);

  const handleExpand = useCallback(() => {
    expandCard();
  }, [expandCard]);

  const handlePrimaryAction = useCallback(() => {
    expandCard();
  }, [expandCard]);

  const handleMenuPress = useCallback(() => {
    if (focusedCard) {
      setIsMenuVisible(true);
    }
  }, [focusedCard]);

  const handleCloseMenu = useCallback(() => {
    setIsMenuVisible(false);
  }, []);

  const handleEdit = useCallback(
    (cardId: string) => {
      navigation.navigate('CardCreator', { cardId });
    },
    [navigation]
  );

  const handleDuplicate = useCallback(
    async (cardId: string) => {
      try {
        const service = createCardService();
        const duplicated = await service.duplicate(cardId);
        await loadCards();
        Alert.alert('Duplicated', `Created "${duplicated.title}"`);
      } catch {
        Alert.alert('Error', 'Failed to duplicate card. Please try again.');
      }
    },
    [loadCards]
  );

  const handleViewUsageHistory = useCallback(
    (cardId: string) => {
      navigation.navigate('UsageHistory', { cardId });
    },
    [navigation]
  );

  const handleSetReminder = useCallback(
    (cardId: string) => {
      navigation.navigate('ReminderConfig', { cardId });
    },
    [navigation]
  );

  const handleArchive = useCallback(
    async (cardId: string) => {
      try {
        const service = createCardService();
        await service.archive(cardId);
        returnToStack();
        await loadCards();
      } catch {
        Alert.alert('Error', 'Failed to archive card. Please try again.');
      }
    },
    [loadCards, returnToStack]
  );

  const handleCustomizeBackground = useCallback(
    (_cardId: string) => {
      setShowBackgroundCustomizer(true);
    },
    []
  );

  const handleApplyBackground = useCallback(
    async (backgroundType: BackgroundType, backgroundValue: string) => {
      if (!focusedCard) return;
      try {
        if (focusedCard.originBadge === 'my_tool') {
          const service = createCardService();
          await service.update(focusedCard.id, { backgroundType, backgroundValue } as any);
        } else {
          await upsertOverlay(focusedCard.id, backgroundType, backgroundValue);
        }
        await loadCards();
      } catch {
        Alert.alert('Error', 'Failed to update background.');
      }
    },
    [focusedCard, loadCards]
  );

  const handleResetBackground = useCallback(
    async () => {
      if (!focusedCard) return;
      try {
        await removeOverlay(focusedCard.id);
        await loadCards();
      } catch {
        Alert.alert('Error', 'Failed to reset background.');
      }
    },
    [focusedCard, loadCards]
  );

  const handleSwitchCard = useCallback(
    (id: string) => {
      focusCard(id);
    },
    [focusCard]
  );

  const handleCommitReorder = useCallback(
    (newOrder: string[]) => {
      commitReorder(newOrder);
    },
    [commitReorder]
  );

  const handleCancelReorder = useCallback(() => {
    cancelReorder();
  }, [cancelReorder]);

  const hasCards = cards.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WalletHeader
        onArchivePress={handleArchivePress}
        onSettingsPress={handleSettingsPress}
        onAddToolPress={handleAddToolPress}
        onCreateToolPress={handleCreateToolPress}
      />
      <View style={styles.content}>
        {isReorderMode ? (
          <ReorderMode
            cards={cards}
            categoryColors={categoryColors}
            onCommit={handleCommitReorder}
            onCancel={handleCancelReorder}
          />
        ) : focusedCard ? (
          // Focused card state: big card on top + thin strips at bottom
          <View style={[styles.focusedLayout, { opacity: isDismissing ? 0.2 : 1 }]}>
            {/* Focused card area — takes up top portion */}
            <View style={styles.focusedCardArea}>
              <FocusedCardView
                card={focusedCard}
                categoryColor={categoryColors[focusedCard.categoryId] || '#9CA3AF'}
                isExpanded={isExpanded}
                onExpand={handleExpand}
                onDismiss={handleDismiss}
                onCollapse={collapseCard}
                onPrimaryAction={handlePrimaryAction}
                onMenuPress={handleMenuPress}
              />
            </View>
            {/* Dark divider between focused card and collapsed stack */}
            {otherCards.length > 0 && (
              <>
                <View style={styles.darkDivider} />
                <View style={styles.collapsedStackArea}>
                  <CollapsedStack
                    cards={otherCards}
                    categoryColors={categoryColors}
                    onCardSelect={handleSwitchCard}
                    onUncollapse={handleDismiss}
                  />
                </View>
              </>
            )}
          </View>
        ) : hasCards ? (
          <StackedCardList
            cards={cards}
            categoryColors={categoryColors}
            onCardPress={handleCardPress}
            onCardLongPress={handleCardLongPress}
          />
        ) : (
          <EmptyWalletState onAddToolPress={handleAddToolPress} />
        )}
      </View>
      {focusedCard && (
        <CardKebabMenu
          visible={isMenuVisible}
          card={focusedCard}
          onClose={handleCloseMenu}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onViewUsageHistory={handleViewUsageHistory}
          onSetReminder={handleSetReminder}
          onArchive={handleArchive}
          onCustomizeBackground={handleCustomizeBackground}
        />
      )}
      {focusedCard && (
        <BackgroundCustomizerSheet
          visible={showBackgroundCustomizer}
          currentBackgroundType={focusedCard.backgroundType}
          currentBackgroundValue={focusedCard.backgroundValue}
          showResetOption={focusedCard.originBadge !== 'my_tool'}
          onApply={handleApplyBackground}
          onReset={handleResetBackground}
          onClose={() => setShowBackgroundCustomizer(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // Apple-style light gray background
  },
  content: {
    flex: 1,
  },
  focusedLayout: {
    flex: 1,
  },
  focusedCardArea: {
    flex: 1,
  },
  darkDivider: {
    height: 20,
  },
  collapsedStackArea: {
    paddingVertical: 0,
  },
});
