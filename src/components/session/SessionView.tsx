/**
 * SessionView — Displays the emotion session flow including selection controls,
 * "Show me tools" action, recommendation sections, and "End session" button.
 *
 * Layout:
 * - ScrollView with EmotionPicker, ContextChips, TimeChips, "Show me tools" button,
 *   and recommendation sections (when available)
 * - Fixed "End session" button at the bottom (outside ScrollView, always visible)
 *
 * Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8, 10.3, 11.1
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { EmotionType, ContextType, TimeType } from '@/types/index';
import type { RecommendationResult } from '@/services/recommendationService';
import EmotionPicker from './EmotionPicker';
import ContextChips from './ContextChips';
import TimeChips from './TimeChips';
import ToolPreviewCard from './ToolPreviewCard';

export interface SessionViewProps {
  selectedEmotion: EmotionType | null;
  selectedContexts: ContextType[];
  selectedTime: TimeType | null;
  recommendations: RecommendationResult | null;
  onSelectEmotion: (emotion: EmotionType) => void;
  onDeselectEmotion: () => void;
  onToggleContext: (context: ContextType) => void;
  onSelectTime: (time: TimeType | null) => void;
  onFetchRecommendations: () => void;
  onOpenTool: (cardId: string) => void;
  onEndSession: () => void;
  onAddToWallet?: (cardId: string) => void;
  addedToWalletIds?: string[];
}

export default function SessionView({
  selectedEmotion,
  selectedContexts,
  selectedTime,
  recommendations,
  onSelectEmotion,
  onDeselectEmotion,
  onToggleContext,
  onSelectTime,
  onFetchRecommendations,
  onOpenTool,
  onEndSession,
  onAddToWallet,
  addedToWalletIds = [],
}: SessionViewProps) {
  const isShowMeToolsEnabled = selectedEmotion !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Selection controls — always visible and editable */}
        <EmotionPicker
          selectedEmotion={selectedEmotion}
          onSelectEmotion={onSelectEmotion}
          onDeselectEmotion={onDeselectEmotion}
        />

        <ContextChips
          selectedContexts={selectedContexts}
          onToggleContext={onToggleContext}
        />

        <TimeChips
          selectedTime={selectedTime}
          onSelectTime={onSelectTime}
        />

        {/* "Show me tools" button — enabled only when emotion is selected */}
        <TouchableOpacity
          style={[
            styles.showMeToolsButton,
            !isShowMeToolsEnabled && styles.showMeToolsButtonDisabled,
          ]}
          onPress={onFetchRecommendations}
          disabled={!isShowMeToolsEnabled}
          accessibilityRole="button"
          accessibilityLabel="Show me tools"
          accessibilityState={{ disabled: !isShowMeToolsEnabled }}
        >
          <Text style={styles.showMeToolsText}>Show me tools</Text>
        </TouchableOpacity>

        {/* Recommendations — shown after "Show me tools" is tapped */}
        {recommendations && (
          <View style={styles.recommendationsContainer}>
            {/* Fallback message when no specific matches */}
            {recommendations.isFallback && (
              <Text style={styles.fallbackMessage}>
                We don't have a specific match right now. Here are some general
                tools that might help.
              </Text>
            )}

            {/* "From your wallet" section — omit if 0 tools (Req 7.4) */}
            {recommendations.walletTools.length > 0 && (
              <View>
                <Text style={styles.sectionHeader}>From your wallet</Text>
                {recommendations.walletTools.map((tool) => (
                  <ToolPreviewCard
                    key={tool.cardId}
                    cardId={tool.cardId}
                    title={tool.title}
                    description={tool.description}
                    iconValue={tool.iconValue}
                    source="wallet"
                    onPress={onOpenTool}
                  />
                ))}
              </View>
            )}

            {/* "Suggested tools to try" section — omit if 0 tools (Req 7.5) */}
            {recommendations.libraryTools.length > 0 && (
              <View>
                <Text style={styles.sectionHeader}>Suggested tools to try</Text>
                {recommendations.libraryTools.map((tool) => (
                  <ToolPreviewCard
                    key={tool.cardId}
                    cardId={tool.cardId}
                    title={tool.title}
                    description={tool.description}
                    iconValue={tool.iconValue}
                    source="library"
                    onPress={onOpenTool}
                    showAddToWallet
                    onAddToWallet={onAddToWallet}
                    isAddedToWallet={addedToWalletIds.includes(tool.cardId)}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Fixed "End session" button — always visible without scrolling (Req 11.1) */}
      <TouchableOpacity
        style={styles.endSessionButton}
        onPress={onEndSession}
        accessibilityRole="button"
        accessibilityLabel="End session"
      >
        <Text style={styles.endSessionText}>End session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  showMeToolsButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  showMeToolsButtonDisabled: {
    opacity: 0.5,
  },
  showMeToolsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recommendationsContainer: {
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  fallbackMessage: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  endSessionButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  endSessionText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
