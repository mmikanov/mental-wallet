/**
 * GuidedCheckinFlow — Paginated container managing 4 CheckinQuestionScreen instances
 * and an inline result screen (5th step) for single-winner or tied-feelings display.
 *
 * Renders the full guided check-in flow with:
 * - Header: back arrow (steps 2–4) and close button (X) on all steps including result
 * - CheckinProgressIndicator showing current step (steps 1–4 only, hidden on result)
 * - Animated CheckinQuestionScreen with SlideInRight/SlideOutLeft transitions (250ms)
 * - Result screen: single winner with soft label OR tied feelings with selectable chips
 * - Screen reader focus moved to new question prompt after transition
 * - Contextual icons per step: body/energy, spectrum/mood, mind/thought, location/people
 *
 * Validates: Requirements 2.1, 2.6, 2.7, 2.8, 2.9, 2.10, 2.12, 2.13, 2.15, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.3, 8.3, 8.7
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo, Platform, TouchableOpacity } from 'react-native';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useCheckinStore } from '@/stores/checkinStore';
import { formatSoftLabel, getEmotionDisplayName, EMOTION_OPTIONS } from '@/data/emotionConfig';
import CheckinQuestionScreen from './CheckinQuestionScreen';
import CheckinProgressIndicator from './CheckinProgressIndicator';
import type { CheckinAnswers } from '@/types/checkin';
import type { EmotionType } from '@/types';

export interface GuidedCheckinFlowProps {
  /** Called when X (close) is tapped — returns to emotion picker without selection */
  onDismiss: () => void;
  /** Called when user accepts the derived feeling — pre-selects it on the picker */
  onAccept: (emotion: EmotionType) => void;
}

/**
 * Question data for all 4 steps of the guided check-in.
 */
const CHECKIN_QUESTIONS = [
  {
    step: 1 as const,
    icon: '🫀', // body/energy
    prompt: 'Right now, my body feels…',
    options: [
      { value: 'very_low', label: 'Very low energy' },
      { value: 'low', label: 'Low energy' },
      { value: 'medium', label: 'Medium energy' },
      { value: 'high', label: 'High energy' },
      { value: 'very_high', label: 'Very high energy' },
    ],
  },
  {
    step: 2 as const,
    icon: '🌈', // spectrum/mood
    prompt: 'Overall, this feels…',
    options: [
      { value: 'unpleasant', label: 'Mostly unpleasant' },
      { value: 'mixed', label: 'Mixed' },
      { value: 'pleasant', label: 'Mostly pleasant' },
    ],
  },
  {
    step: 3 as const,
    icon: '🧠', // mind/thought
    prompt: 'My mind is mostly…',
    options: [
      { value: 'racing', label: 'Racing' },
      { value: 'stuck_worries', label: 'Stuck on worries' },
      { value: 'stuck_mistakes', label: 'Stuck on mistakes' },
      { value: 'blank', label: 'Blank' },
      { value: 'numb', label: 'Numb' },
      { value: 'curious_interested', label: 'Curious / interested' },
      { value: 'okay', label: 'Okay / steady' },
    ],
  },
  {
    step: 4 as const,
    icon: '📍', // location/people
    prompt: 'Where are you right now?',
    options: [
      { value: 'alone_at_home', label: 'Alone at home' },
      { value: 'at_work', label: 'At work' },
      { value: 'with_family', label: 'With family' },
      { value: 'with_friends', label: 'With friends' },
    ],
  },
];

/**
 * Returns the currently selected answer value for a given step from the answers object.
 */
function getAnswerForStep(step: number, answers: CheckinAnswers): string | null {
  switch (step) {
    case 1:
      return answers.bodyEnergy;
    case 2:
      return answers.pleasantness;
    case 3:
      return answers.thoughtPattern;
    case 4:
      return answers.context;
    default:
      return null;
  }
}

export default function GuidedCheckinFlow({ onDismiss, onAccept }: GuidedCheckinFlowProps) {
  const currentStep = useCheckinStore((s) => s.currentStep);
  const answers = useCheckinStore((s) => s.answers);
  const isTransitioning = useCheckinStore((s) => s.isTransitioning);
  const topFeelings = useCheckinStore((s) => s.topFeelings);
  const selectAnswer = useCheckinStore((s) => s.selectAnswer);
  const goBack = useCheckinStore((s) => s.goBack);
  const dismiss = useCheckinStore((s) => s.dismiss);
  const startCheckin = useCheckinStore((s) => s.startCheckin);

  const prevStepRef = useRef(currentStep);
  const showResult = topFeelings.length > 0;
  const isSingleWinner = topFeelings.length === 1;

  // Move screen reader focus to the question prompt after transition (Req 8.3)
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      prevStepRef.current = currentStep;

      // Short delay to allow the entering animation to render before announcing
      const timer = setTimeout(() => {
        if (currentStep <= 4) {
          const question = CHECKIN_QUESTIONS[currentStep - 1];
          AccessibilityInfo.announceForAccessibility(question.prompt);
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Announce result screen when topFeelings appears
  useEffect(() => {
    if (showResult) {
      const timer = setTimeout(() => {
        if (isSingleWinner) {
          AccessibilityInfo.announceForAccessibility(formatSoftLabel(topFeelings[0]));
        } else {
          AccessibilityInfo.announceForAccessibility(
            'This could be a few things — which feels closest?'
          );
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showResult, isSingleWinner, topFeelings]);

  // Mark transition as complete after animation duration
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        useCheckinStore.setState({ isTransitioning: false });
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  const handleDismiss = () => {
    dismiss();
    onDismiss();
  };

  const handleAcceptFeeling = (emotion: EmotionType) => {
    onAccept(emotion);
  };

  const handleTryAgain = () => {
    startCheckin();
  };

  // Show result screen when topFeelings has results (Req 4.1, 4.2)
  if (showResult) {
    return (
      <View style={styles.container}>
        {/* Header with close button only — no back arrow, no progress indicator on result */}
        <View style={styles.header}>
          <View style={styles.headerButtonPlaceholder} />
          <Pressable
            onPress={handleDismiss}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close guided check-in"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        {/* Result content */}
        <View style={styles.resultContainer}>
          {isSingleWinner ? (
            <SingleWinnerResult
              emotion={topFeelings[0]}
              onAccept={handleAcceptFeeling}
              onTryAgain={handleTryAgain}
            />
          ) : (
            <TiedFeelingsResult
              feelings={topFeelings}
              onAccept={handleAcceptFeeling}
              onTryAgain={handleTryAgain}
            />
          )}
        </View>
      </View>
    );
  }

  const question = CHECKIN_QUESTIONS[currentStep - 1];
  const selectedValue = getAnswerForStep(currentStep, answers);

  return (
    <View style={styles.container}>
      {/* Header: Back arrow + Close button */}
      <View style={styles.header}>
        {/* Back arrow — only on steps 2–4 (Req 2.8, 8.7) */}
        {currentStep > 1 ? (
          <Pressable
            onPress={goBack}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Go back to previous question"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.backArrowText}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButtonPlaceholder} />
        )}

        {/* Close button — on all steps (Req 2.9, 8.7) */}
        <Pressable
          onPress={handleDismiss}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Close guided check-in"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Progress indicator — steps 1–4 only (Req 2.7) */}
      <CheckinProgressIndicator currentStep={currentStep} />

      {/* Gentle intro text on step 1 to ease the transition */}
      {currentStep === 1 && (
        <Text style={styles.introText}>
          Okay, let's try to figure it out together.
        </Text>
      )}

      {/* Animated question screen (Req 2.6, 2.12) */}
      <Animated.View
        key={currentStep}
        entering={SlideInRight.duration(250)}
        exiting={SlideOutLeft.duration(250)}
        style={styles.questionContainer}
      >
        <CheckinQuestionScreen
          icon={question.icon}
          prompt={question.prompt}
          options={question.options}
          selectedValue={selectedValue}
          onSelect={(value) => selectAnswer(currentStep, value)}
          disabled={isTransitioning}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Single winner result screen — shows the feeling prominently with emoji,
 * display name, soft label, normalizing message, and action buttons.
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5, 7.3
 */
function SingleWinnerResult({
  emotion,
  onAccept,
  onTryAgain,
}: {
  emotion: EmotionType;
  onAccept: (emotion: EmotionType) => void;
  onTryAgain: () => void;
}) {
  const emotionConfig = EMOTION_OPTIONS.find((o) => o.type === emotion);
  const emoji = emotionConfig?.icon ?? '💭';
  const displayName = getEmotionDisplayName(emotion);

  return (
    <>
      <Text style={styles.resultEmoji}>{emoji}</Text>
      <Text style={styles.resultFeelingLabel}>{displayName}</Text>
      <Text style={styles.resultSoftLabel}>{formatSoftLabel(emotion)}</Text>
      <Text style={styles.resultNormalizing}>
        It's okay if this isn't perfect — we're just using it as a starting point.
      </Text>

      <TouchableOpacity
        style={styles.useButton}
        onPress={() => onAccept(emotion)}
        accessibilityRole="button"
        accessibilityLabel={`Use ${displayName}`}
      >
        <Text style={styles.useButtonText}>Use this feeling</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tryAgainButton}
        onPress={onTryAgain}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.tryAgainButtonText}>Try again</Text>
      </TouchableOpacity>
    </>
  );
}

/**
 * Tied feelings result screen — shows prompt with selectable chips for each
 * tied feeling. User must tap one to proceed. No soft label shown.
 * Validates: Requirements 4.2, 4.4, 4.5, 4.6, 7.3
 */
function TiedFeelingsResult({
  feelings,
  onAccept,
  onTryAgain,
}: {
  feelings: EmotionType[];
  onAccept: (emotion: EmotionType) => void;
  onTryAgain: () => void;
}) {
  return (
    <>
      <Text style={styles.tiedPrompt}>
        This could be a few things — which feels closest?
      </Text>

      <View style={styles.tiedChipsContainer}>
        {feelings.map((emotion) => {
          const emotionConfig = EMOTION_OPTIONS.find((o) => o.type === emotion);
          const emoji = emotionConfig?.icon ?? '💭';
          const displayName = getEmotionDisplayName(emotion);

          return (
            <TouchableOpacity
              key={emotion}
              style={styles.tiedChip}
              onPress={() => onAccept(emotion)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${displayName}`}
            >
              <Text style={styles.tiedChipEmoji}>{emoji}</Text>
              <Text style={styles.tiedChipLabel}>{displayName}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.resultNormalizing}>
        It's okay if this isn't perfect — we're just using it as a starting point.
      </Text>

      <TouchableOpacity
        style={styles.tryAgainButton}
        onPress={onTryAgain}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.tryAgainButtonText}>Try again</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 4,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  backArrowText: {
    fontSize: 22,
    color: '#374151',
    lineHeight: 24,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#374151',
    lineHeight: 20,
  },
  questionContainer: {
    flex: 1,
  },
  introText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
    fontStyle: 'italic',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  resultFeelingLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7C3AED',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultSoftLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  resultNormalizing: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  useButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  useButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tryAgainButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  tryAgainButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  tiedPrompt: {
    fontSize: 18,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
  },
  tiedChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  tiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0FF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  tiedChipEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  tiedChipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C3AED',
  },
});
