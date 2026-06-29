/**
 * SessionLauncherContent — Container component for the expanded Session Launcher Card.
 *
 * Bridges the Zustand sessionStore to the pure UI components (EmotionPicker,
 * ContextChips, TimeChips, SessionView). Handles the dismiss affordance
 * ("Not right now") and manages transitions between picker state and
 * recommendations state.
 *
 * Validates: Requirements 4.7, 4.8, 4.9, 6.1, 12.2, 12.3
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSessionStore } from '@/stores/sessionStore';
import { createCardService } from '@/services/cardService';
import { setTagsForCard, setContextTags, setTimeTags } from '@/services/emotionTagService';
import { useWalletStore } from '@/stores/walletStore';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import EmotionPicker from '@/components/session/EmotionPicker';
import ContextChips from '@/components/session/ContextChips';
import TimeChips from '@/components/session/TimeChips';
import ToolPreviewCard from '@/components/session/ToolPreviewCard';
import LibraryToolPreview from '@/components/session/LibraryToolPreview';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

export interface SessionLauncherContentProps {
  onDismiss: () => void;
  onNavigateToTool: (cardId: string) => void;
}

export default function SessionLauncherContent({
  onDismiss,
  onNavigateToTool,
}: SessionLauncherContentProps) {
  const {
    selectedEmotion,
    selectedContexts,
    selectedTime,
    recommendations,
    selectEmotion,
    deselectEmotion,
    toggleContext,
    selectTime,
    fetchRecommendations,
    openTool,
    recordToolAdded,
    endSession,
    dismissWithoutSession,
  } = useSessionStore();

  // Track which library tools have been added to wallet during this session
  const [addedToWalletIds, setAddedToWalletIds] = useState<Set<string>>(new Set());

  // Library tool preview state (Bug 5 fix)
  const [previewingCard, setPreviewingCard] = useState<CuratedCardDefinition | null>(null);

  // Mapping from library card IDs to their new wallet card IDs after adding
  const [addedToWalletMapping, setAddedToWalletMapping] = useState<Map<string, string>>(new Map());

  // Ref for auto-scrolling to recommendations
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to recommendations when they appear (Bug 3)
  useEffect(() => {
    if (recommendations) {
      // Small delay to let the layout render before scrolling
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [recommendations]);

  const handleDismiss = useCallback(() => {
    dismissWithoutSession();
    onDismiss();
  }, [dismissWithoutSession, onDismiss]);

  const handleSelectEmotion = useCallback(
    (emotion: EmotionType) => {
      selectEmotion(emotion);
    },
    [selectEmotion]
  );

  const handleDeselectEmotion = useCallback(() => {
    deselectEmotion();
  }, [deselectEmotion]);

  const handleToggleContext = useCallback(
    (context: ContextType) => {
      toggleContext(context);
    },
    [toggleContext]
  );

  const handleSelectTime = useCallback(
    (time: TimeType | null) => {
      selectTime(time);
    },
    [selectTime]
  );

  const handleShowMeTools = useCallback(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleOpenTool = useCallback(
    (cardId: string) => {
      openTool(cardId);

      // Check if this is a library tool (from recommendations)
      const isLibraryTool = recommendations?.libraryTools.some((t) => t.cardId === cardId);

      if (isLibraryTool) {
        // Check if it was already added to wallet (use the ID mapping)
        const walletId = addedToWalletMapping.get(cardId);
        if (walletId) {
          // Already added — navigate to the wallet version
          onNavigateToTool(walletId);
        } else {
          // Not in wallet — show inline preview
          const libraryCard = CURATED_LIBRARY.find((c) => c.id === cardId);
          if (libraryCard) {
            setPreviewingCard(libraryCard);
          }
        }
      } else {
        // Wallet tool — navigate normally
        onNavigateToTool(cardId);
      }
    },
    [openTool, onNavigateToTool, recommendations, addedToWalletMapping]
  );

  const handleEndSession = useCallback(() => {
    endSession();
    onDismiss();
  }, [endSession, onDismiss]);

  const handleClosePreview = useCallback(() => {
    setPreviewingCard(null);
  }, []);

  const handleAddToWallet = useCallback(
    async (cardId: string) => {
      // Find the library card definition
      const libraryCard = CURATED_LIBRARY.find((c) => c.id === cardId);
      if (!libraryCard) return;

      // Duplicate detection: check if already added this session (Req 10.6)
      if (addedToWalletIds.has(cardId)) return;

      // Check if a card with the same title already exists in wallet
      const walletCards = useWalletStore.getState().cards;
      const alreadyInWallet = walletCards.some((c) => c.title === libraryCard.title);
      if (alreadyInWallet) return;

      try {
        const cardService = createCardService();
        const newCard = await cardService.create(
          {
            title: libraryCard.title,
            description: libraryCard.description,
            iconType: libraryCard.iconType,
            iconValue: libraryCard.iconValue,
            backgroundType: libraryCard.backgroundType,
            backgroundValue: libraryCard.backgroundValue,
          },
          libraryCard.controls.map((ctrl) => ({
            type: ctrl.type,
            position: ctrl.position,
            config: ctrl.config,
            isRequired: ctrl.isRequired,
          })),
          'library',
          libraryCard.categoryId,
          libraryCard.id  // sourceLibraryId
        );

        // Persist emotion/context/time tags from library definition (Req 8.3, 10.5)
        if (libraryCard.emotionTags && libraryCard.emotionTags.length > 0) {
          await setTagsForCard(newCard.id, libraryCard.emotionTags);
        }
        if (libraryCard.contextTags && libraryCard.contextTags.length > 0) {
          await setContextTags(newCard.id, libraryCard.contextTags);
        }
        if (libraryCard.timeTags && libraryCard.timeTags.length > 0) {
          await setTimeTags(newCard.id, libraryCard.timeTags);
        }

        setAddedToWalletIds((prev) => new Set([...prev, cardId]));
        setAddedToWalletMapping((prev) => new Map([...prev, [cardId, newCard.id]]));

        // Record that this tool was added to wallet (for session history)
        recordToolAdded(libraryCard.title);

        // Reload wallet store so the new card appears in the wallet view
        await useWalletStore.getState().loadCards();

        // Refresh recommendations so tool moves from "Suggested" to "From your wallet" (Req 10.5)
        fetchRecommendations();
      } catch {
        // Abort on failure — keep tool in "Suggested" section (Req 10.5)
      }
    },
    [addedToWalletIds, fetchRecommendations]
  );

  const showMeToolsEnabled = selectedEmotion !== null;

  // Bug 5 fix: Show library tool preview inline instead of navigating to wallet
  if (previewingCard) {
    return (
      <View style={styles.container}>
        <LibraryToolPreview
          card={previewingCard}
          onClose={handleClosePreview}
          onAddToWallet={handleAddToWallet}
          isAddedToWallet={addedToWalletIds.has(previewingCard.id)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dismiss affordance — neutral language, no guilt (Req 12.2) */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Not right now"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.dismissText}>Not right now</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Emotion Picker */}
        <EmotionPicker
          selectedEmotion={selectedEmotion}
          onSelectEmotion={handleSelectEmotion}
          onDeselectEmotion={handleDeselectEmotion}
        />

        {/* Context Chips */}
        <ContextChips
          selectedContexts={selectedContexts}
          onToggleContext={handleToggleContext}
        />

        {/* Time Chips */}
        <TimeChips
          selectedTime={selectedTime}
          onSelectTime={handleSelectTime}
        />

        {/* Recommendations */}
        {recommendations && (
          <View style={styles.recommendationsContainer}>
            {/* Wallet tools section */}
            {recommendations.walletTools.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>From your wallet</Text>
                {recommendations.walletTools.map((tool) => (
                  <ToolPreviewCard
                    key={tool.cardId}
                    cardId={tool.cardId}
                    title={tool.title}
                    description={tool.description}
                    iconValue={tool.iconValue}
                    source="wallet"
                    onPress={handleOpenTool}
                  />
                ))}
              </View>
            )}

            {/* Library tools section */}
            {recommendations.libraryTools.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Suggested tools to try</Text>
                {recommendations.libraryTools.map((tool) => (
                  <ToolPreviewCard
                    key={tool.cardId}
                    cardId={tool.cardId}
                    title={tool.title}
                    description={tool.description}
                    iconValue={tool.iconValue}
                    source="library"
                    onPress={handleOpenTool}
                    showAddToWallet
                    onAddToWallet={handleAddToWallet}
                    isAddedToWallet={addedToWalletIds.has(tool.cardId)}
                  />
                ))}
              </View>
            )}

            {/* Fallback message */}
            {recommendations.isFallback && (
              <Text style={styles.fallbackMessage}>
                We don&apos;t have a specific match right now. Here are some general
                tools that might help.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom button — always visible without scrolling */}
      {recommendations ? (
        <TouchableOpacity
          style={styles.endSessionButton}
          onPress={handleEndSession}
          accessibilityRole="button"
          accessibilityLabel="End session"
        >
          <Text style={styles.endSessionText}>End session</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.showMeToolsButton,
            !showMeToolsEnabled && styles.showMeToolsButtonDisabled,
          ]}
          onPress={handleShowMeTools}
          disabled={!showMeToolsEnabled}
          accessibilityRole="button"
          accessibilityLabel="Show me tools"
          accessibilityState={{ disabled: !showMeToolsEnabled }}
        >
          <Text
            style={[
              styles.showMeToolsText,
              !showMeToolsEnabled && styles.showMeToolsTextDisabled,
            ]}
          >
            Show me tools
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  dismissButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  dismissText: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  showMeToolsButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  showMeToolsButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  showMeToolsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  showMeToolsTextDisabled: {
    color: '#9CA3AF',
  },
  recommendationsContainer: {
    marginTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  fallbackMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  endSessionButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  endSessionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
