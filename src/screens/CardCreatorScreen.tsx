/**
 * CardCreatorScreen — Container managing the 3-step card creation/editing flow.
 *
 * Steps:
 *   1. Card Shell (title, description, icon, background, category)
 *   2. Controls editor (add/reorder/configure controls)
 *   3. Preview & Save
 *
 * Receives optional `cardId` route param for edit mode.
 * In edit mode, updates the card preserving usage history.
 *
 * Unsaved changes guard:
 *   - Uses `beforeRemove` navigation listener to intercept navigation away
 *   - Shows confirmation dialog if any field has been modified
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 5.6, 5.7, 6.1, 6.4, 6.8, 9.2
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { CardShell, Control, EmotionType, OriginBadge } from '@/types/index';
import { createCardService } from '@/services/cardService';
import { removeOverlay } from '@/services/backgroundOverlayService';
import { getTagsForCard, setTagsForCard, clearTagsForCard } from '@/services/emotionTagService';
import { getDatabase } from '@/data/database';
import { useWalletStore } from '@/stores/walletStore';
import Step1Shell from '@/components/creator/Step1Shell';
import Step2Controls from '@/components/creator/Step2Controls';
import Step3Preview from '@/components/creator/Step3Preview';

type Props = NativeStackScreenProps<RootStackParamList, 'CardCreator'>;

const INITIAL_SHELL: CardShell = {
  title: '',
  description: '',
  iconType: 'emoji',
  iconValue: '',
  backgroundType: 'color',
  backgroundValue: '',
};

export default function CardCreatorScreen({ navigation, route }: Props) {
  const cardId = route.params?.cardId;
  const isEditMode = !!cardId;

  const [currentStep, setCurrentStep] = useState(1);
  const [shell, setShell] = useState<CardShell>(INITIAL_SHELL);
  const [controls, setControls] = useState<Control[]>([]);
  const [categoryId, setCategoryId] = useState('grounding-calming');
  const [selectedEmotionTags, setSelectedEmotionTags] = useState<EmotionType[]>([]);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  // Track initial state for unsaved changes detection
  const initialShellRef = useRef<CardShell>(INITIAL_SHELL);
  const initialControlsRef = useRef<Control[]>([]);
  const initialCategoryRef = useRef<string>('grounding-calming');
  const hasBeenSavedRef = useRef(false);

  const loadCards = useWalletStore((s) => s.loadCards);

  // Load existing card data in edit mode
  useEffect(() => {
    if (isEditMode && cardId) {
      loadExistingCard(cardId);
    }
  }, [cardId, isEditMode]);

  async function loadExistingCard(id: string) {
    try {
      const service = createCardService();
      const card = await service.getById(id);
      if (card) {
        const loadedShell: CardShell = {
          title: card.title,
          description: card.description,
          iconType: card.iconType,
          iconValue: card.iconValue,
          backgroundType: card.backgroundType,
          backgroundValue: card.backgroundValue,
        };
        setShell(loadedShell);
        setControls(card.controls);
        setCategoryId(card.categoryId);
        // Store initial state for dirty checking
        initialShellRef.current = loadedShell;
        initialControlsRef.current = card.controls;
        initialCategoryRef.current = card.categoryId;

        // Load existing emotion tags (Req 9.4)
        try {
          const emotionTags = await getTagsForCard(id);
          const emotions = emotionTags.map((t) => t.emotion);
          setSelectedEmotionTags(emotions);
        } catch {
          // Non-blocking: emotion tags are optional
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load card data.');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Detects if any field has been modified from the initial state.
   */
  function hasUnsavedChanges(): boolean {
    if (hasBeenSavedRef.current) return false;

    const shellChanged =
      shell.title !== initialShellRef.current.title ||
      shell.description !== initialShellRef.current.description ||
      shell.iconType !== initialShellRef.current.iconType ||
      shell.iconValue !== initialShellRef.current.iconValue ||
      shell.backgroundType !== initialShellRef.current.backgroundType ||
      shell.backgroundValue !== initialShellRef.current.backgroundValue;

    const categoryChanged = categoryId !== initialCategoryRef.current;

    const controlsChanged =
      JSON.stringify(controls) !== JSON.stringify(initialControlsRef.current);

    return shellChanged || categoryChanged || controlsChanged;
  }

  // Unsaved changes guard — disable native gesture to prevent the native-stack
  // desync issue where beforeRemove + e.preventDefault() doesn't work with
  // native-stack modal presentation. Instead, we disable the gesture entirely
  // when there are unsaved changes and handle dismiss via our own Cancel button.
  const isDirty = useMemo(() => hasUnsavedChanges(), [shell, controls, categoryId]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isDirty,
    });
  }, [isDirty, navigation]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) {
      if (hasUnsavedChanges()) {
        Alert.alert(
          'Discard changes?',
          'Your unsaved changes will be lost.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        navigation.goBack();
      }
    } else {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, navigation, shell, controls, categoryId]);

  const handleNext = useCallback(() => {
    setCurrentStep((s) => s + 1);
  }, []);

  /**
   * Save the card — create or update depending on mode.
   * In create mode: creates card with "my_tool" badge at top of stack.
   * In edit mode: updates card shell + replaces controls, preserves usage history.
   */
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const service = createCardService();

      if (isEditMode && cardId) {
        // Edit mode: update shell fields + replace controls
        await service.update(cardId, {
          title: shell.title,
          description: shell.description,
          iconType: shell.iconType,
          iconValue: shell.iconValue,
          backgroundType: shell.backgroundType,
          backgroundValue: shell.backgroundValue,
          categoryId,
        });

        // Remove any stale background overlay so the direct value takes precedence
        await removeOverlay(cardId);

        // Replace controls: delete old, insert new
        const db = await getDatabase();
        const now = new Date().toISOString();

        await db.execAsync('BEGIN TRANSACTION');
        try {
          // Delete existing controls for this card
          await db.runAsync('DELETE FROM controls WHERE card_id = ?', [cardId]);

          // Insert updated controls
          for (let i = 0; i < controls.length; i++) {
            const control = controls[i];
            const controlId = Crypto.randomUUID();
            await db.runAsync(
              `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                controlId,
                cardId,
                control.type,
                i,
                JSON.stringify(control.config),
                control.isRequired ? 1 : 0,
                now,
              ]
            );
          }
          await db.execAsync('COMMIT');
        } catch (error) {
          await db.execAsync('ROLLBACK');
          throw error;
        }

        // Persist emotion tags in background (Req 9.6)
        if (selectedEmotionTags.length > 0) {
          setTagsForCard(cardId, selectedEmotionTags).catch(() => {});
        } else {
          clearTagsForCard(cardId).catch(() => {});
        }
      } else {
        // Create mode: create new card with "my_tool" badge
        const controlsData = controls.map((c, i) => ({
          type: c.type,
          position: i,
          config: c.config,
          isRequired: c.isRequired,
        }));

        const createdCard = await service.create(shell, controlsData, 'my_tool' as OriginBadge);

        // Persist emotion tags in background (Req 9.6)
        if (selectedEmotionTags.length > 0) {
          setTagsForCard(createdCard.id, selectedEmotionTags).catch(() => {});
        }
      }

      // Mark as saved so beforeRemove listener allows navigation
      hasBeenSavedRef.current = true;

      // Reload wallet store with updated data
      await loadCards();

      // Navigate back
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Error',
        isEditMode ? 'Failed to update card.' : 'Failed to create card.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isEditMode, cardId, shell, controls, categoryId, selectedEmotionTags, loadCards, navigation]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>
            {currentStep === 1 ? 'Cancel' : '← Back'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Tool' : 'Create Tool'} — Step {currentStep}/3
        </Text>
        <View style={styles.headerButton} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              step === currentStep && styles.stepDotActive,
              step < currentStep && styles.stepDotComplete,
            ]}
          />
        ))}
      </View>

      {/* Step content */}
      {currentStep === 1 && (
        <Step1Shell
          shell={shell}
          onShellChange={setShell}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          onNext={handleNext}
        />
      )}
      {currentStep === 2 && (
        <Step2Controls
          controls={controls}
          onControlsChange={setControls}
          onNext={handleNext}
        />
      )}
      {currentStep === 3 && (
        <Step3Preview
          shell={shell}
          controls={controls}
          categoryId={categoryId}
          onSave={handleSave}
          isSaving={isSaving}
          selectedEmotionTags={selectedEmotionTags}
          onEmotionTagsChange={setSelectedEmotionTags}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
  },
  stepDotActive: {
    backgroundColor: '#4A90D9',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDotComplete: {
    backgroundColor: '#5BA88B',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: '#666666',
  },
});
