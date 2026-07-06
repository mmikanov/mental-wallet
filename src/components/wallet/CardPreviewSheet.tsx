/**
 * CardPreviewSheet — Bottom-sheet modal presenting a full card preview
 * from the Library Browser before adding to the wallet.
 *
 * Shows the card shell (icon, title, description, background) and
 * a read-only layout of its controls, plus an action footer.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.9
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { ButtonState } from '@/screens/libraryBrowserHelpers';
import type { Control } from '@/types/index';
import ControlRenderer from '@/components/controls/ControlRenderer';
import { isLightBackground } from '@/utils/cardColors';
import { renderCardIcon } from '@/utils/renderCardIcon';
import { SEED_CATEGORIES } from '@/data/seeds';

export type LibraryCardButtonState = ButtonState;

export interface CardPreviewSheetProps {
  card: CuratedCardDefinition;
  visible: boolean;
  onDismiss: () => void;
  buttonState: LibraryCardButtonState;
  onAddToWallet: (card: CuratedCardDefinition) => Promise<void>;
  onRestore: (card: CuratedCardDefinition) => Promise<void>;
}

export default function CardPreviewSheet({
  card,
  visible,
  onDismiss,
  buttonState,
  onAddToWallet,
  onRestore,
}: CardPreviewSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bgColor =
    card.backgroundType === 'color'
      ? card.backgroundValue || '#FFFFFF'
      : '#FFFFFF';

  const isLight = isLightBackground(bgColor);
  const textColor = isLight ? '#1C1C1E' : '#FFFFFF';
  const subtitleColor = isLight ? '#4B5563' : 'rgba(255,255,255,0.7)';

  // Map curated control definitions to Control[] for ControlRenderer
  const controls: Control[] = card.controls.map((ctrl, idx) => ({
    id: `preview-ctrl-${idx}`,
    cardId: card.id,
    type: ctrl.type,
    position: ctrl.position,
    config: ctrl.config,
    isRequired: ctrl.isRequired,
  }));

  const handleAction = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (buttonState.action === 'add') {
        await onAddToWallet(card);
      } else if (buttonState.action === 'restore') {
        await onRestore(card);
      }
      // Auto-dismiss on success
      onDismiss();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [buttonState.action, card, onAddToWallet, onRestore, onDismiss]);

  const handleDismiss = useCallback(() => {
    setError(null);
    setLoading(false);
    onDismiss();
  }, [onDismiss]);

  const getActionLabel = (): string => {
    if (loading) {
      return buttonState.action === 'restore' ? 'Restoring...' : 'Adding...';
    }
    return buttonState.label;
  };

  const isActionDisabled = buttonState.disabled || loading;

  // Look up category info
  const category = SEED_CATEGORIES.find((c) => c.id === card.categoryId);

  const cardShellContent = (
    <View style={styles.cardShellContent}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        {renderCardIcon({
          iconType: card.iconType,
          iconValue: card.iconValue,
          size: 48,
          fallbackEmoji: card.iconValue || '📋',
        })}
      </View>

      {/* Title */}
      <Text
        style={[styles.title, { color: textColor }]}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {card.title}
      </Text>

      {/* Category */}
      {category && (
        <View style={[styles.categoryTag, { backgroundColor: category.colorHex + '20' }]}>
          <Text style={[styles.categoryTagText, { color: category.colorHex }]}>
            {category.name}
          </Text>
        </View>
      )}

      {/* Description */}
      <Text style={[styles.description, { color: subtitleColor }]} numberOfLines={4}>
        {card.description}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleDismiss}
      transparent={Platform.OS === 'android'}
    >
      <View
        style={[
          styles.container,
          Platform.OS === 'android' && styles.androidOverlay,
        ]}
      >
        {/* Dismiss handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Shell */}
          <View style={[styles.cardShell, { backgroundColor: bgColor }]}>
            {cardShellContent}
          </View>

          {/* Controls (read-only) */}
          <View style={styles.controlsContainer}>
            <ControlRenderer
              controls={controls}
              values={{}}
              onChange={() => {}}
              readOnly={true}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Error message */}
          {error && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          )}

          {/* Action button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              buttonState.action === 'none' && styles.actionButtonDisabled,
              buttonState.action === 'restore' && styles.actionButtonRestore,
            ]}
            onPress={handleAction}
            disabled={isActionDisabled}
            accessibilityRole="button"
            accessibilityLabel={getActionLabel()}
            accessibilityState={{ disabled: isActionDisabled }}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                testID="loading-indicator"
              />
            ) : null}
            <Text
              style={[
                styles.actionButtonText,
                buttonState.action === 'none' && styles.actionButtonTextDisabled,
              ]}
            >
              {getActionLabel()}
            </Text>
          </TouchableOpacity>

          {/* Dismiss button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss preview"
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  androidOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D5DB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  cardShell: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardShellContent: {
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  iconContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlsContainer: {
    paddingBottom: 16,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
  },
  actionButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  actionButtonRestore: {
    backgroundColor: '#5BA88B',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    color: '#9CA3AF',
  },
  dismissButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
});
