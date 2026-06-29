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
 * - When highlightSessionCard route param is true, scrolls to and highlights
 *   the Session Launcher Card for 1 second (Req 2.2)
 * - Renders SessionLauncherContent when the session-launcher card is expanded (Req 4.7)
 *
 * Validates: Requirements 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.7, 4.8, 4.10
 */

import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { View, StyleSheet, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import WalletHeader from '@/components/wallet/WalletHeader';
import StackedCardList from '@/components/wallet/StackedCardList';
import EmptyWalletState from '@/components/wallet/EmptyWalletState';
import FocusedCardView from '@/components/wallet/FocusedCardView';
import CollapsedStack from '@/components/wallet/CollapsedStack';
import ReorderMode from '@/components/wallet/ReorderMode';
import CardKebabMenu from '@/components/wallet/CardKebabMenu';
import BackgroundCustomizerSheet from '@/components/wallet/BackgroundCustomizerSheet';
import SessionLauncherContent from '@/components/session/SessionLauncherContent';
import SessionActiveBanner from '@/components/session/SessionActiveBanner';
import { useWalletStore } from '@/stores/walletStore';
import { useSessionStore } from '@/stores/sessionStore';
import { createCardService } from '@/services/cardService';
import { upsertOverlay, removeOverlay } from '@/services/backgroundOverlayService';
import type { BackgroundType } from '@/types/index';
import type { RootStackParamList, MainTabParamList } from '@/navigation/types';

type WalletNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type WalletRouteProp = RouteProp<MainTabParamList, 'Wallet'>;

/** ID of the session launcher card from seed data */
const SESSION_LAUNCHER_CARD_ID = 'session-launcher';

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
  const route = useRoute<WalletRouteProp>();
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

  const isSessionActive = useSessionStore((s) => s.isSessionActive);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [showBackgroundCustomizer, setShowBackgroundCustomizer] = useState(false);

  // Session Launcher Card highlight state (Req 2.2)
  const [isHighlighting, setIsHighlighting] = useState(false);
  const highlightHandled = useRef(false);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Handle highlightSessionCard route param — scroll to and highlight the session launcher card
  useEffect(() => {
    const shouldHighlight = route.params?.highlightSessionCard;
    if (shouldHighlight && cards.length > 0 && !highlightHandled.current) {
      const sessionCard = cards.find((c) => c.id === SESSION_LAUNCHER_CARD_ID);
      if (sessionCard) {
        highlightHandled.current = true;
        // Focus the session launcher card (scrolls to it)
        focusCard(SESSION_LAUNCHER_CARD_ID);
        // Apply 1-second visual highlight
        setIsHighlighting(true);
        const timer = setTimeout(() => {
          setIsHighlighting(false);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [route.params?.highlightSessionCard, cards, focusCard]);

  // TODO: Defer Micro_Tutorial when "emotion" mode chosen during onboarding.
  // The Micro_Tutorial is not yet implemented (onboarding spec dependency).
  // When it lands, check if highlightSessionCard param is true and skip the tutorial
  // on this first wallet visit — trigger it the next time the user lands without an active session.

  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = { ...DEFAULT_CATEGORY_COLORS };
    return colors;
  }, []);

  const focusedCard = useMemo(
    () => (focusedCardId ? cards.find((c) => c.id === focusedCardId) ?? null : null),
    [focusedCardId, cards]
  );

  // Whether the focused card is the session launcher (renders custom content when expanded)
  const isSessionLauncherFocused = focusedCardId === SESSION_LAUNCHER_CARD_ID;

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

  /** Dismiss handler for SessionLauncherContent — returns to the stack view */
  const handleSessionLauncherDismiss = useCallback(() => {
    returnToStack();
  }, [returnToStack]);

  /** Return to the session launcher card from the floating banner */
  const handleReturnToSession = useCallback(() => {
    focusCard(SESSION_LAUNCHER_CARD_ID);
    expandCard();
  }, [focusCard, expandCard]);

  /**
   * Navigate to a tool card from SessionLauncherContent recommendations.
   *
   * Flow (Req 10.1, 10.2, 10.3):
   * 1. SessionLauncherContent calls openTool(cardId) to track usage in the session store.
   * 2. This handler focuses the recommended card, which replaces the session launcher
   *    expansion with the tool's expanded view.
   * 3. When the user dismisses/returns from the tool, tapping the session-launcher card
   *    again re-expands SessionLauncherContent. All session state (selectedEmotion,
   *    selectedContexts, selectedTime, recommendations, toolsUsedInSession) is preserved
   *    automatically because it lives in the Zustand sessionStore — not in component
   *    state that would be lost on unmount.
   *
   * Pre-use mood slider suppression (Req 10.7):
   * During an active session the user has already reported their emotional state via the
   * Emotion_Picker. Other flows can check `isInActiveEmotionSession()` from
   * `@/utils/sessionContext` to skip redundant mood prompts.
   */
  const handleNavigateToTool = useCallback(
    (cardId: string) => {
      focusCard(cardId);
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
        {isSessionActive && focusedCardId !== SESSION_LAUNCHER_CARD_ID && (
          <SessionActiveBanner onReturnToSession={handleReturnToSession} />
        )}
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
              <View style={isHighlighting ? styles.highlightWrapper : undefined}>
                <FocusedCardView
                  card={focusedCard}
                  categoryColor={categoryColors[focusedCard.categoryId] || '#9CA3AF'}
                  isExpanded={isExpanded}
                  onExpand={handleExpand}
                  onDismiss={handleDismiss}
                  onCollapse={collapseCard}
                  onPrimaryAction={handlePrimaryAction}
                  onMenuPress={handleMenuPress}
                  renderExpandedContent={
                    isSessionLauncherFocused
                      ? () => (
                          <SessionLauncherContent
                            onDismiss={handleSessionLauncherDismiss}
                            onNavigateToTool={handleNavigateToTool}
                          />
                        )
                      : undefined
                  }
                />
              </View>
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
  // Visual highlight applied for 1 second when session launcher is scrolled into view (Req 2.2)
  highlightWrapper: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 18,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    marginHorizontal: 2,
  },
});
