/**
 * CheckinStore — Zustand store managing the guided emotion check-in flow state.
 *
 * Handles the 4-step question flow, transition locking to prevent double-advance,
 * and back-navigation that clears forward answers.
 *
 * Validates: Requirements 2.6, 2.8, 2.13, 2.14
 */

import { create } from 'zustand';
import { deriveFeeling } from '@/services/mappingEngine';
import type { CheckinAnswers, BodyEnergyLevel, Pleasantness, ThoughtPattern, SocialContext } from '@/types/checkin';
import type { EmotionType } from '@/types';

export interface CheckinStore {
  // State
  isActive: boolean;
  currentStep: 1 | 2 | 3 | 4;
  answers: CheckinAnswers;
  topFeelings: EmotionType[];
  isTransitioning: boolean;

  // Actions
  startCheckin: () => void;
  selectAnswer: (step: number, value: string) => void;
  goBack: () => void;
  dismiss: () => void;
  complete: () => void;
  reset: () => void;
}

const INITIAL_ANSWERS: CheckinAnswers = {
  bodyEnergy: null,
  pleasantness: null,
  thoughtPattern: null,
  context: null,
};

export const useCheckinStore = create<CheckinStore>((set, get) => ({
  isActive: false,
  currentStep: 1,
  answers: { ...INITIAL_ANSWERS },
  topFeelings: [],
  isTransitioning: false,

  startCheckin() {
    set({
      isActive: true,
      currentStep: 1,
      answers: { ...INITIAL_ANSWERS },
      topFeelings: [],
      isTransitioning: false,
    });
  },

  selectAnswer(step: number, value: string) {
    const { isTransitioning } = get();

    // Transition locking: ignore taps while transitioning (Req 2.13)
    if (isTransitioning) return;

    // Build updated answers based on step number
    const { answers } = get();
    const updatedAnswers = { ...answers };

    switch (step) {
      case 1:
        updatedAnswers.bodyEnergy = value as BodyEnergyLevel;
        break;
      case 2:
        updatedAnswers.pleasantness = value as Pleasantness;
        break;
      case 3:
        updatedAnswers.thoughtPattern = value as ThoughtPattern;
        break;
      case 4:
        updatedAnswers.context = value as SocialContext;
        break;
      default:
        return;
    }

    // Set transitioning state and update answers
    set({ answers: updatedAnswers, isTransitioning: true });

    if (step < 4) {
      // Advance to next step
      set({ currentStep: (step + 1) as 1 | 2 | 3 | 4 });
    } else {
      // Step 4: auto-complete the check-in
      get().complete();
    }
  },

  goBack() {
    const { currentStep, answers } = get();

    // Can't go back from step 1
    if (currentStep <= 1) return;

    const newStep = (currentStep - 1) as 1 | 2 | 3 | 4;

    // Clear all answers for steps AFTER the new current step (Req 2.14)
    const clearedAnswers = { ...answers };

    if (newStep < 4) clearedAnswers.context = null;
    if (newStep < 3) clearedAnswers.thoughtPattern = null;
    if (newStep < 2) clearedAnswers.pleasantness = null;

    set({
      currentStep: newStep,
      answers: clearedAnswers,
      isTransitioning: false,
    });
  },

  dismiss() {
    set({
      isActive: false,
      currentStep: 1,
      answers: { ...INITIAL_ANSWERS },
      topFeelings: [],
      isTransitioning: false,
    });
  },

  complete() {
    const { answers } = get();

    // All 4 answers must be present to derive a feeling
    if (!answers.bodyEnergy || !answers.pleasantness || !answers.thoughtPattern || !answers.context) {
      return;
    }

    const result = deriveFeeling({
      bodyEnergy: answers.bodyEnergy,
      pleasantness: answers.pleasantness,
      thoughtPattern: answers.thoughtPattern,
      context: answers.context,
    });

    // Keep isActive true — the result screen is shown within the flow
    set({
      topFeelings: result.topFeelings,
    });
  },

  reset() {
    set({
      isActive: false,
      currentStep: 1,
      answers: { ...INITIAL_ANSWERS },
      topFeelings: [],
      isTransitioning: false,
    });
  },
}));
