/**
 * TooltipOverlay — Full-screen overlay with spotlight cutout and tooltip bubble.
 *
 * Renders a semi-transparent backdrop with a transparent "hole" around a target
 * element using the multiple-rect approach (4 dark bars around the target).
 * Positions a tooltip bubble with directional arrow above or below the target.
 *
 * Validates: Requirements 5.1, 5.4, 9.5
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPOTLIGHT_PADDING = 8;
const BACKDROP_OPACITY = 0.5;
const FADE_DURATION = 250;
const ARROW_SIZE = 8;

export interface TooltipOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Layout measurements of the target element to spotlight */
  targetLayout: { x: number; y: number; width: number; height: number } | null;
  /** Tooltip text content */
  text: string;
  /** Position of tooltip relative to target */
  position: 'above' | 'below';
  /** Label for the skip action */
  skipLabel?: string;
  /** Called when user taps the spotlighted area */
  onTargetPress?: () => void;
  /** Called when user taps skip */
  onSkip?: () => void;
}

export default function TooltipOverlay({
  visible,
  targetLayout,
  text,
  position,
  skipLabel = 'Skip tips',
  onTargetPress,
  onSkip,
}: TooltipOverlayProps) {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: FADE_DURATION,
      easing: Easing.inOut(Easing.ease),
    });
  }, [visible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0 ? 'box-none' : 'none',
  }));

  if (!targetLayout) return null;

  // Spotlight bounds with padding
  const spotLeft = targetLayout.x - SPOTLIGHT_PADDING;
  const spotTop = targetLayout.y - SPOTLIGHT_PADDING;
  const spotWidth = targetLayout.width + SPOTLIGHT_PADDING * 2;
  const spotHeight = targetLayout.height + SPOTLIGHT_PADDING * 2;
  const spotRight = spotLeft + spotWidth;
  const spotBottom = spotTop + spotHeight;

  // Tooltip positioning
  const tooltipTop =
    position === 'below' ? spotBottom + ARROW_SIZE + 4 : undefined;
  const tooltipBottom =
    position === 'above'
      ? SCREEN_HEIGHT - spotTop + ARROW_SIZE + 4
      : undefined;

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      {/* Top bar */}
      <View
        style={[styles.backdrop, { top: 0, left: 0, right: 0, height: spotTop }]}
        pointerEvents="none"
      />
      {/* Bottom bar */}
      <View
        style={[
          styles.backdrop,
          { top: spotBottom, left: 0, right: 0, bottom: 0 },
        ]}
        pointerEvents="none"
      />
      {/* Left bar */}
      <View
        style={[
          styles.backdrop,
          { top: spotTop, left: 0, width: spotLeft, height: spotHeight },
        ]}
        pointerEvents="none"
      />
      {/* Right bar */}
      <View
        style={[
          styles.backdrop,
          {
            top: spotTop,
            left: spotRight,
            right: 0,
            height: spotHeight,
          },
        ]}
        pointerEvents="none"
      />

      {/* Spotlight pressable area */}
      <TouchableOpacity
        style={[
          styles.spotlight,
          { top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight },
        ]}
        onPress={onTargetPress}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel="Highlighted area. Tap to continue."
      />

      {/* Tooltip bubble */}
      <View
        style={[
          styles.tooltip,
          {
            top: tooltipTop,
            bottom: tooltipBottom,
            left: 16,
            right: 16,
          },
        ]}
      >
        {/* Arrow */}
        <View
          style={[
            styles.arrow,
            position === 'below' ? styles.arrowUp : styles.arrowDown,
            { left: Math.max(16, spotLeft + spotWidth / 2 - 16 - ARROW_SIZE) },
          ]}
        />

        <Text
          style={styles.tooltipText}
          accessibilityLabel={text}
          accessibilityRole="text"
        >
          {text}
        </Text>

        <TouchableOpacity
          onPress={onSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>{skipLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    backgroundColor: `rgba(0, 0, 0, ${BACKDROP_OPACITY})`,
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 8,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  arrow: {
    position: 'absolute',
    width: ARROW_SIZE * 2,
    height: ARROW_SIZE * 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  arrowUp: {
    top: -ARROW_SIZE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  arrowDown: {
    bottom: -ARROW_SIZE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  tooltipText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1C1C1E',
    marginBottom: 10,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '500',
  },
});
