/**
 * CheckinQuestionScreen — Renders a single question in the guided check-in flow.
 *
 * Displays a decorative icon (hidden from screen readers), a question prompt,
 * and a vertical list of tappable option buttons. On selection, the chosen option
 * animates (scale + color highlight for 300ms) before calling onSelect.
 *
 * All options have 44pt min height, announce their label, role (button), and
 * selection state to assistive technology. Text meets WCAG 2.1 AA contrast (4.5:1).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.11, 2.15, 8.1, 8.2, 8.5
 */

import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

export interface CheckinQuestionScreenProps {
  icon: string;
  prompt: string;
  options: { value: string; label: string }[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const ANIMATION_DURATION = 300;
const HIGHLIGHT_COLOR = '#EDE9FE'; // Light purple highlight (4.5:1 contrast with dark text)
const DEFAULT_BG = '#FFFFFF';

export default function CheckinQuestionScreen({
  icon,
  prompt,
  options,
  selectedValue,
  onSelect,
  disabled = false,
}: CheckinQuestionScreenProps) {
  return (
    <View style={styles.container}>
      {/* Decorative icon — hidden from screen readers */}
      <View
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
        style={styles.iconContainer}
      >
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {/* Question prompt */}
      <Text
        style={styles.prompt}
        accessibilityRole="header"
      >
        {prompt}
      </Text>

      {/* Option buttons */}
      <ScrollView
        style={styles.optionsScroll}
        contentContainerStyle={styles.optionsList}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => (
          <OptionButton
            key={option.value}
            value={option.value}
            label={option.label}
            isSelected={option.value === selectedValue}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Individual option button with Reanimated highlight animation.
 */
interface OptionButtonProps {
  value: string;
  label: string;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (value: string) => void;
}

function OptionButton({ value, label, isSelected, disabled, onSelect }: OptionButtonProps) {
  const scale = useSharedValue(1);
  const bgProgress = useSharedValue(0);
  const isAnimating = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: bgProgress.value > 0.5 ? HIGHLIGHT_COLOR : DEFAULT_BG,
  }));

  const handleAnimationComplete = useCallback(() => {
    isAnimating.current = false;
    onSelect(value);
  }, [onSelect, value]);

  const handlePress = useCallback(() => {
    if (disabled || isAnimating.current) return;

    isAnimating.current = true;

    // Scale animation: 1 → 1.03 → 1 over 300ms
    scale.value = withSequence(
      withTiming(1.03, { duration: ANIMATION_DURATION / 2, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: ANIMATION_DURATION / 2, easing: Easing.in(Easing.ease) })
    );

    // Background highlight: on for 300ms then off, then fire callback
    bgProgress.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(1, { duration: ANIMATION_DURATION }),
      withTiming(0, { duration: 0, easing: Easing.linear }, (finished) => {
        if (finished) {
          runOnJS(handleAnimationComplete)();
        }
      })
    );
  }, [disabled, scale, bgProgress, handleAnimationComplete]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View style={[styles.optionButton, isSelected && styles.optionSelected, animatedStyle]}>
        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  prompt: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E', // 4.5:1+ contrast on white background
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 28,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsList: {
    gap: 10,
    paddingBottom: 16,
  },
  optionButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: DEFAULT_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#EDE9FE',
  },
  optionLabel: {
    fontSize: 16,
    color: '#1F2937', // ~14.7:1 contrast ratio on white
    fontWeight: '500',
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: '#5B21B6', // Dark purple — 4.5:1+ contrast on #EDE9FE
    fontWeight: '600',
  },
});
