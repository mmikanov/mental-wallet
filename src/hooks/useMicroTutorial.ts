/**
 * useMicroTutorial — State machine hook for the onboarding tooltip sequence.
 *
 * Manages the micro-tutorial flow: idle → tooltip on frontmost card → tooltip on action button → complete.
 * On reaching `complete`, persists tutorial completion via the onboarding store.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';

export type TutorialStep =
  | 'idle'
  | 'tooltip_frontmost_card'
  | 'tooltip_action_button'
  | 'complete';

export interface UseMicroTutorialReturn {
  currentStep: TutorialStep;
  isActive: boolean;
  tooltipText: string;
  targetRef: 'frontmost_card' | 'action_button' | null;
  advance: () => void;
  skip: () => void;
  start: () => void;
}

const TOOLTIP_TEXTS: Record<TutorialStep, string> = {
  idle: '',
  tooltip_frontmost_card: 'Here\'s an example tool to get started. Tap the card to try it out.',
  tooltip_action_button: 'Try it out! Tap here to complete the exercise.',
  complete: '',
};

const TARGET_REFS: Record<TutorialStep, 'frontmost_card' | 'action_button' | null> = {
  idle: null,
  tooltip_frontmost_card: 'frontmost_card',
  tooltip_action_button: 'action_button',
  complete: null,
};

export function useMicroTutorial(): UseMicroTutorialReturn {
  const [currentStep, setCurrentStep] = useState<TutorialStep>('idle');
  const completeTutorial = useOnboardingStore((s) => s.completeTutorial);

  const start = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 'idle') return 'tooltip_frontmost_card';
      return prev;
    });
  }, []);

  const advance = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 'tooltip_frontmost_card') {
        return 'tooltip_action_button';
      }
      if (prev === 'tooltip_action_button') {
        completeTutorial();
        return 'complete';
      }
      return prev;
    });
  }, [completeTutorial]);

  const skip = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev !== 'idle' && prev !== 'complete') {
        completeTutorial();
        return 'complete';
      }
      return prev;
    });
  }, [completeTutorial]);

  const isActive =
    currentStep === 'tooltip_frontmost_card' ||
    currentStep === 'tooltip_action_button';

  return {
    currentStep,
    isActive,
    tooltipText: TOOLTIP_TEXTS[currentStep],
    targetRef: TARGET_REFS[currentStep],
    advance,
    skip,
    start,
  };
}
