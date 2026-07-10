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
  Pressable,
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
import { logEvent } from '@/services/analyticsEventLogger';
import { getDatabase } from '@/data/database';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { useWalletStore } from '@/stores/walletStore';
import { useAdminStore } from '@/stores/adminStore';
import { createLibraryCard, createStaticOverride, getCardById as getAdminCardById } from '@/services/adminCardService';
import Step1Shell from '@/components/creator/Step1Shell';
import Step2Controls from '@/components/creator/Step2Controls';
import Step3Preview from '@/components/creator/Step3Preview';
import Step4Rationale from '@/components/creator/Step4Rationale';
import type { RationaleFormData } from '@/components/creator/RationaleFormSection';
import type { RationaleMetadata } from '@/types/rationale';

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
  const adminEditCardId = route.params?.adminEditCardId;
  const adminEditSource = route.params?.adminEditSource;
  const isEditMode = !!cardId;
  const isAdminEdit = !!adminEditCardId;

  const [currentStep, setCurrentStep] = useState(1);
  const [shell, setShell] = useState<CardShell>(INITIAL_SHELL);
  const [controls, setControls] = useState<Control[]>([]);
  const [categoryId, setCategoryId] = useState('grounding-calming');
  const [selectedEmotionTags, setSelectedEmotionTags] = useState<EmotionType[]>([]);
  const [isLoading, setIsLoading] = useState(isEditMode || isAdminEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [rationaleData, setRationaleData] = useState<RationaleFormData>({
    approach: '',
    inANutshell: '',
    howItWorks: '',
    evidenceLevel: '',
    researchSummary: ['', ''],
    learnMoreLinks: [],
  });

  // Ref to always have the latest rationale data in callbacks (avoids stale closure)
  const rationaleDataRef = useRef(rationaleData);
  rationaleDataRef.current = rationaleData;

  // Tracks the effective card ID for admin edit mode (set after static override creation or admin card load)
  const [adminEditEffectiveId, setAdminEditEffectiveId] = useState<string | null>(null);

  // Track initial state for unsaved changes detection
  const initialShellRef = useRef<CardShell>(INITIAL_SHELL);
  const initialControlsRef = useRef<Control[]>([]);
  const initialCategoryRef = useRef<string>('grounding-calming');
  const hasBeenSavedRef = useRef(false);

  // Triple-tap gesture state for admin mode activation
  const tapCountRef = useRef(0);
  const firstTapTimeRef = useRef(0);
  const toggleAdmin = useAdminStore((s) => s.toggleAdmin);
  const resetAdmin = useAdminStore((s) => s.resetAdmin);
  const isAdminMode = useAdminStore((s) => s.isAdminMode);

  const TRIPLE_TAP_WINDOW_MS = 500;

  const handleHeaderTitlePress = useCallback(() => {
    const now = Date.now();

    if (tapCountRef.current === 0 || now - firstTapTimeRef.current > TRIPLE_TAP_WINDOW_MS) {
      // First tap or taps outside window — reset counter
      tapCountRef.current = 1;
      firstTapTimeRef.current = now;
    } else {
      // Within window — increment
      tapCountRef.current += 1;
      if (tapCountRef.current >= 3) {
        toggleAdmin();
        tapCountRef.current = 0;
        firstTapTimeRef.current = 0;
      }
    }
  }, [toggleAdmin]);

  // Reset admin mode on screen blur (navigating away)
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      resetAdmin();
    });
    return unsubscribe;
  }, [navigation, resetAdmin]);

  const loadCards = useWalletStore((s) => s.loadCards);

  // Load existing card data in edit mode
  useEffect(() => {
    if (isEditMode && cardId) {
      loadExistingCard(cardId);
    }
  }, [cardId, isEditMode]);

  // Admin edit mode initialization
  useEffect(() => {
    if (!adminEditCardId || !adminEditSource) return;

    // Activate admin mode automatically when entering via admin edit params
    useAdminStore.getState().activateAdmin();

    loadAdminEditCard(adminEditCardId, adminEditSource);
  }, [adminEditCardId, adminEditSource]);

  async function loadAdminEditCard(editCardId: string, source: 'admin' | 'static') {
    try {
      if (source === 'static') {
        // Look up the card from CURATED_LIBRARY by ID
        const curatedCard = CURATED_LIBRARY.find((c) => c.id === editCardId);
        if (!curatedCard) {
          Alert.alert('Error', 'Card not found in library.');
          setIsLoading(false);
          return;
        }

        // Clone the static card to DB via createStaticOverride
        // This may fail if the override already exists — in that case, just load the existing one
        try {
          await createStaticOverride(curatedCard);
        } catch {
          // Override may already exist (double-edit case) — continue to load it
        }

        // Now load the card from DB (it exists as a static override)
        const card = await getAdminCardById(editCardId);
        if (!card) {
          Alert.alert('Error', 'Card not found. It may have been deleted.');
          setIsLoading(false);
          return;
        }

        populateFromCard(card);
        setAdminEditEffectiveId(card.id);

        // Load rationale data from DB
        await loadRationaleForCard(editCardId, curatedCard);

        // Load emotion tags: prefer DB tags, fall back to static definition
        try {
          const dbTags = await getTagsForCard(editCardId);
          if (dbTags.length > 0) {
            setSelectedEmotionTags(dbTags.map((t) => t.emotion));
          } else if (curatedCard.emotionTags) {
            setSelectedEmotionTags(curatedCard.emotionTags);
          }
        } catch {
          // Fall back to static definition tags
          if (curatedCard.emotionTags) {
            setSelectedEmotionTags(curatedCard.emotionTags);
          }
        }
      } else {
        // source === 'admin': Load existing admin card from DB
        const card = await getAdminCardById(editCardId);
        if (!card) {
          Alert.alert('Error', 'Card not found. It may have been deleted.');
          setIsLoading(false);
          return;
        }

        populateFromCard(card);
        setAdminEditEffectiveId(card.id);

        // Load rationale data from DB
        await loadRationaleForCard(editCardId);

        // Load emotion tags from DB
        try {
          const dbTags = await getTagsForCard(editCardId);
          setSelectedEmotionTags(dbTags.map((t) => t.emotion));
        } catch {
          // Non-blocking: tags are optional
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load card data.');
    } finally {
      setIsLoading(false);
    }
  }

  function populateFromCard(card: import('@/types/index').Card) {
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
  }

  async function loadRationaleForCard(cardId: string, curatedCard?: import('@/data/curatedLibrary').CuratedCardDefinition) {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{
        rationale_approach: string | null;
        rationale_in_a_nutshell: string | null;
        rationale_how_it_works: string | null;
        rationale_evidence_level: string | null;
        rationale_research_summary: string | null;
        rationale_learn_more_links: string | null;
      }>(
        `SELECT rationale_approach, rationale_in_a_nutshell, rationale_how_it_works,
                rationale_evidence_level, rationale_research_summary, rationale_learn_more_links
         FROM cards WHERE id = ?`,
        [cardId]
      );

      if (row && row.rationale_approach) {
        setRationaleData({
          approach: (row.rationale_approach || '') as RationaleFormData['approach'],
          inANutshell: row.rationale_in_a_nutshell || '',
          howItWorks: row.rationale_how_it_works || '',
          evidenceLevel: (row.rationale_evidence_level || '') as RationaleFormData['evidenceLevel'],
          researchSummary: row.rationale_research_summary
            ? JSON.parse(row.rationale_research_summary)
            : ['', ''],
          learnMoreLinks: row.rationale_learn_more_links
            ? JSON.parse(row.rationale_learn_more_links)
            : [],
        });
      } else if (curatedCard?.rationale) {
        // Fall back to static curated card rationale
        setRationaleData({
          approach: curatedCard.rationale.approach,
          inANutshell: curatedCard.rationale.inANutshell,
          howItWorks: curatedCard.rationale.howItWorks,
          evidenceLevel: curatedCard.rationale.evidenceLevel,
          researchSummary: [...curatedCard.rationale.researchSummary],
          learnMoreLinks: curatedCard.rationale.learnMoreLinks
            ? [...curatedCard.rationale.learnMoreLinks]
            : [],
        });
      }
    } catch {
      // Non-blocking: rationale is optional for editing
    }
  }

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

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard changes?',
        'Your unsaved changes will be lost.',
        [
          { text: 'Keep Editing', style: 'cancel' },
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
  }, [navigation, shell, controls, categoryId]);

  const handleNext = useCallback(() => {
    setCurrentStep((s) => s + 1);
  }, []);

  // Ref to always call the latest performSave (avoids stale closure in handleSave)
  const performSaveRef = useRef<(promoteToLibrary: boolean) => Promise<void>>(async () => {});

  /**
   * Save the card — create or update depending on mode.
   * In create mode: creates card with "my_tool" badge at top of stack.
   * In admin mode: creates admin library card via adminCardService.
   * In admin edit mode: updates existing admin/override card via standard update path.
   * In edit mode: updates card shell + replaces controls, preserves usage history.
   */
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // If editing a personal tool with admin mode active, ask if they want to promote it to library
    if (isEditMode && cardId && isAdminMode && !isAdminEdit) {
      // Check if this is a my_tool card (not already a library card)
      const service = createCardService();
      const existingCard = await service.getById(cardId);
      if (existingCard && existingCard.originBadge === 'my_tool') {
        Alert.alert(
          'Promote to Library?',
          'This is a personal tool. Would you like to save it as a library tool instead?',
          [
            {
              text: 'Keep as Personal',
              style: 'cancel',
              onPress: () => performSaveRef.current(false),
            },
            {
              text: 'Save to Library',
              onPress: () => performSaveRef.current(true),
            },
          ]
        );
        return;
      }
    }

    performSaveRef.current(false);
  }, [isSaving, isEditMode, isAdminEdit, isAdminMode, cardId]);

  const performSave = useCallback(async (promoteToLibrary: boolean) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const service = createCardService();

      // Determine the effective ID for update — either from admin edit or normal edit
      const effectiveEditId = adminEditEffectiveId || cardId;
      const isEffectiveEdit = isAdminEdit ? !!adminEditEffectiveId : isEditMode;

      if (promoteToLibrary && cardId) {
        // Promote: create a new library card from the current state, then delete the personal card
        const controlsData = controls.map((c, i) => ({
          type: c.type,
          position: i,
          config: c.config,
          isRequired: c.isRequired,
        }));

        await createLibraryCard(shell, controlsData, categoryId, selectedEmotionTags);

        // Delete the original personal card from the wallet
        await service.delete(cardId);

        hasBeenSavedRef.current = true;
        Alert.alert('Success', 'Tool promoted to library', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        setIsSaving(false);
        await loadCards();
        return;
      }

      if (isEffectiveEdit && effectiveEditId) {
        // Edit mode (normal or admin edit): update shell fields + replace controls
        await service.update(effectiveEditId, {
          title: shell.title,
          description: shell.description,
          iconType: shell.iconType,
          iconValue: shell.iconValue,
          backgroundType: shell.backgroundType,
          backgroundValue: shell.backgroundValue,
          categoryId,
        });

        // Remove any stale background overlay so the direct value takes precedence
        await removeOverlay(effectiveEditId);

        // Replace controls: delete old, insert new
        const db = await getDatabase();
        const now = new Date().toISOString();

        await db.execAsync('BEGIN TRANSACTION');
        try {
          // Delete existing controls for this card
          await db.runAsync('DELETE FROM controls WHERE card_id = ?', [effectiveEditId]);

          // Insert updated controls
          for (let i = 0; i < controls.length; i++) {
            const control = controls[i];
            const controlId = Crypto.randomUUID();
            await db.runAsync(
              `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                controlId,
                effectiveEditId,
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

        // Persist rationale fields if admin editing and rationale data is filled
        if ((isAdminMode || isAdminEdit) && rationaleDataRef.current.approach && rationaleDataRef.current.evidenceLevel) {
          const rationaleDb = await getDatabase();
          await rationaleDb.runAsync(
            `UPDATE cards SET
              rationale_approach = ?,
              rationale_in_a_nutshell = ?,
              rationale_how_it_works = ?,
              rationale_evidence_level = ?,
              rationale_research_summary = ?,
              rationale_learn_more_links = ?
            WHERE id = ?`,
            [
              rationaleDataRef.current.approach,
              rationaleDataRef.current.inANutshell || null,
              rationaleDataRef.current.howItWorks || null,
              rationaleDataRef.current.evidenceLevel,
              JSON.stringify(rationaleDataRef.current.researchSummary.filter((s) => s.trim().length > 0)),
              rationaleDataRef.current.learnMoreLinks.filter((l) => l.title.trim() && l.url.trim()).length > 0
                ? JSON.stringify(rationaleDataRef.current.learnMoreLinks.filter((l) => l.title.trim() && l.url.trim()))
                : null,
              effectiveEditId,
            ]
          );
        }

        // Persist emotion tags in background (Req 9.6)
        if (selectedEmotionTags.length > 0) {
          setTagsForCard(effectiveEditId, selectedEmotionTags).catch(() => {});
        } else {
          clearTagsForCard(effectiveEditId).catch(() => {});
        }
      } else if (isAdminMode) {
        // Admin mode: create library card via adminCardService
        const controlsData = controls.map((c, i) => ({
          type: c.type,
          position: i,
          config: c.config,
          isRequired: c.isRequired,
        }));

        // Build rationale if all required fields are filled
        const rationale: RationaleMetadata | undefined =
          rationaleDataRef.current.approach && rationaleDataRef.current.inANutshell && rationaleDataRef.current.howItWorks && rationaleDataRef.current.evidenceLevel
            ? {
                approach: rationaleDataRef.current.approach as RationaleMetadata['approach'],
                inANutshell: rationaleDataRef.current.inANutshell,
                howItWorks: rationaleDataRef.current.howItWorks,
                evidenceLevel: rationaleDataRef.current.evidenceLevel as RationaleMetadata['evidenceLevel'],
                researchSummary: rationaleDataRef.current.researchSummary.filter((s) => s.trim().length > 0) as RationaleMetadata['researchSummary'],
                learnMoreLinks: rationaleDataRef.current.learnMoreLinks.filter((l) => l.title.trim() && l.url.trim()).length > 0
                  ? rationaleDataRef.current.learnMoreLinks.filter((l) => l.title.trim() && l.url.trim())
                  : undefined,
              }
            : undefined;

        await createLibraryCard(shell, controlsData, categoryId, selectedEmotionTags, undefined, undefined, rationale);

        // Show confirmation and navigate back
        hasBeenSavedRef.current = true;
        Alert.alert('Success', 'Library tool created', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        setIsSaving(false);
        return;
      } else {
        // Create mode: create new card with "my_tool" badge
        const controlsData = controls.map((c, i) => ({
          type: c.type,
          position: i,
          config: c.config,
          isRequired: c.isRequired,
        }));

        const createdCard = await service.create(shell, controlsData, 'my_tool' as OriginBadge);

        // Log tool_created analytics event
        void logEvent('tool_created', {
          card_id: createdCard.id,
          card_category: createdCard.categoryId,
          origin_badge: 'my_tool',
        });

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
        isAdminMode || isAdminEdit
          ? 'Failed to save library tool. Please try again.'
          : isEditMode
            ? 'Failed to update card.'
            : 'Failed to create card.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isEditMode, isAdminEdit, isAdminMode, adminEditEffectiveId, cardId, shell, controls, categoryId, selectedEmotionTags, loadCards, navigation]);

  // Keep ref in sync with latest performSave
  performSaveRef.current = performSave;

  const totalSteps = isAdminMode ? 4 : 3;

  // Clamp step when admin mode is toggled off while on step 4
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [isAdminMode, totalSteps, currentStep]);

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
        {currentStep > 1 ? (
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
        <Pressable onPress={handleHeaderTitlePress}>
          <Text style={styles.headerTitle}>
            {isAdminEdit ? 'Edit Library Tool' : isEditMode ? 'Edit Tool' : 'Create Tool'} — Step {currentStep}/{totalSteps}
          </Text>
        </Pressable>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
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

      {/* Admin mode indicator banner */}
      {isAdminMode && (
        <View style={styles.adminBanner}>
          <Text style={styles.adminBannerText}>Admin: Library Tool</Text>
        </View>
      )}

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
          onSave={isAdminMode ? handleNext : handleSave}
          isSaving={isSaving}
          saveLabel={isAdminMode ? 'Next: Rationale' : undefined}
          selectedEmotionTags={selectedEmotionTags}
          onEmotionTagsChange={setSelectedEmotionTags}
        />
      )}
      {currentStep === 4 && isAdminMode && (
        <Step4Rationale
          data={rationaleData}
          onChange={setRationaleData}
          onSave={handleSave}
          isSaving={isSaving}
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
  cancelButtonText: {
    color: '#FF3B30',
    textAlign: 'right',
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
  adminBanner: {
    backgroundColor: '#FFF3CD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
    alignItems: 'center',
  },
  adminBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
});
