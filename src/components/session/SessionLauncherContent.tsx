/**
 * SessionLauncherContent — Container component for the expanded Session Launcher Card.
 *
 * Bridges the Zustand sessionStore to the pure UI components (EmotionPicker,
 * ContextChips, TimeChips, SessionView). Handles the dismiss affordance
 * ("Not right now") and manages transitions between picker state and
 * recommendations state.
 *
 * State machine: EMOTION_PICKER → CHECKIN_FLOW → EMOTION_PICKER (with selection)
 *
 * Validates: Requirements 1.6, 2.10, 2.12, 4.1, 4.4, 4.5, 4.7, 4.8, 4.9, 6.1, 12.2, 12.3
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useSessionStore } from '@/stores/sessionStore';
import { createCardService } from '@/services/cardService';
import { setTagsForCard, setContextTags, setTimeTags } from '@/services/emotionTagService';
import { saveCheckinRecord } from '@/services/checkinRecordService';
import { logEvent } from '@/services/analyticsEventLogger';
import { useWalletStore } from '@/stores/walletStore';
import { useCheckinStore } from '@/stores/checkinStore';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { CheckinRecord } from '@/types/checkin';
import EmotionPicker from '@/components/session/EmotionPicker';
import GuidedCheckinFlow from '@/components/session/GuidedCheckinFlow';
import ContextChips from '@/components/session/ContextChips';
import TimeChips from '@/components/session/TimeChips';
import ToolPreviewCard from '@/components/session/ToolPreviewCard';
import LibraryToolPreview from '@/components/session/LibraryToolPreview';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

/** State machine states for the session launcher flow */
type LauncherState = 'EMOTION_PICKER' | 'CHECKIN_FLOW' | 'CONTEXT_SELECTION';

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

  // State machine for the session launcher flow
  const [launcherState, setLauncherState] = useState<LauncherState>('EMOTION_PICKER');

  // Track which library tools have been added to wallet during this session
  const [addedToWalletIds, setAddedToWalletIds] = useState<Set<string>>(new Set());

  // Library tool preview state (Bug 5 fix)
  const [previewingCard, setPreviewingCard] = useState<CuratedCardDefinition | null>(null);

  // Mapping from library card IDs to their new wallet card IDs after adding
  const [addedToWalletMapping, setAddedToWalletMapping] = useState<Map<string, string>>(new Map());

  // Ref for auto-scrolling to recommendations
  const scrollViewRef = useRef<ScrollView>(null);

  // Ref to store measured Y offset of recommendations container
  const recoContainerY = useRef<number>(0);

  // Ref to store the checkin record ID for passing to session creation (Req 9.6)
  const checkinIdRef = useRef<string | null>(null);

  // Reset checkinStore on unmount to prevent stale state (Req 4.5)
  useEffect(() => {
    return () => {
      useCheckinStore.getState().reset();
    };
  }, []);

  // Auto-scroll to recommendations container top when they appear
  useEffect(() => {
    if (recommendations) {
      // Small delay to let the layout render before scrolling
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: recoContainerY.current, animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [recommendations]);

  const handleDismiss = useCallback(() => {
    dismissWithoutSession();
    onDismiss();
  }, [dismissWithoutSession, onDismiss]);

  // Start the guided check-in flow (Req 1.6, 6.5)
  const handleStartCheckin = useCallback(() => {
    // Fire analytics event BEFORE transitioning state (Req 6.5)
    logEvent('guided_checkin_started');
    useCheckinStore.getState().startCheckin();
    setLauncherState('CHECKIN_FLOW');
  }, []);

  // Dismiss the guided check-in flow — reset store and return to picker (Req 2.10, 4.5)
  const handleCheckinDismiss = useCallback(() => {
    useCheckinStore.getState().reset();
    setLauncherState('EMOTION_PICKER');
  }, []);

  // Called when user accepts the derived feeling from the guided check-in
  const handleCheckinAccept = useCallback(
    (emotion: EmotionType) => {
      const { answers, topFeelings } = useCheckinStore.getState();
      const primaryFeeling = topFeelings[0] ?? emotion;
      const wasChanged = emotion !== primaryFeeling;

      // Fire guided_checkin_completed event (Req 6.6)
      logEvent('guided_checkin_completed', {
        derived_feeling: primaryFeeling,
        was_changed: wasChanged ? 1 : 0,
        final_emotion_used: emotion,
      });

      // Generate checkin record ID and save record (Req 6.1, 9.5, 9.7)
      const checkinId = Crypto.randomUUID();
      checkinIdRef.current = checkinId;

      // Capture the social context answer before resetting — we'll pre-fill
      // the context step since the user already answered "Where are you right now?"
      const checkinContext = answers.context;

      if (answers.bodyEnergy && answers.pleasantness && answers.thoughtPattern && answers.context) {
        const record: CheckinRecord = {
          id: checkinId,
          bodyEnergy: answers.bodyEnergy,
          pleasantness: answers.pleasantness,
          thoughtPattern: answers.thoughtPattern,
          context: answers.context,
          derivedFeeling: primaryFeeling,
          wasChanged,
          finalEmotion: emotion,
          recordedAt: new Date().toISOString(),
        };

        // Save record silently — errors are caught inside the service (Req 9.5)
        saveCheckinRecord(record).catch(() => {});
      }

      // Reset the checkin store and select the emotion
      useCheckinStore.getState().reset();
      selectEmotion(emotion, checkinId);

      // Pre-fill the context chip from the check-in's Q4 answer so the user
      // doesn't have to answer "Where are you right now?" again.
      // Clear any previously selected contexts first to avoid stacking answers
      // from multiple check-in attempts.
      if (checkinContext) {
        useSessionStore.setState({
          selectedContexts: [checkinContext as ContextType],
          recommendations: null,
        });
      }

      setLauncherState('EMOTION_PICKER');
    },
    [selectEmotion]
  );

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
      } catch {
        // Abort on failure — keep tool in "Suggested" section (Req 10.5)
      }
    },
    [addedToWalletIds]
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

  // Render the guided check-in flow (Req 2.10, 2.12)
  if (launcherState === 'CHECKIN_FLOW') {
    return (
      <View style={styles.container}>
        <GuidedCheckinFlow
          onDismiss={handleCheckinDismiss}
          onAccept={handleCheckinAccept}
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
          onStartCheckin={handleStartCheckin}
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
          <View
            style={styles.recommendationsContainer}
            onLayout={(e) => { recoContainerY.current = e.nativeEvent.layout.y; }}
          >
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
