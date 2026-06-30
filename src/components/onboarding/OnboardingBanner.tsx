/**
 * OnboardingBanner — Non-modal informational banner displayed on first wallet arrival.
 *
 * Shows "We added a few tools to get you started. You can add your own later."
 * with a dismiss (X) button. Animated entrance using react-native-reanimated.
 * The parent is responsible for calling onboardingStore.dismissBanner() via onDismiss.
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const FADE_DURATION = 250;

export interface OnboardingBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function OnboardingBanner({ visible, onDismiss }: OnboardingBannerProps) {
  const opacity = useSharedValue(visible ? 1 : 0);
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
      opacity.value = withTiming(1, {
        duration: FADE_DURATION,
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      opacity.value = withTiming(
        0,
        { duration: FADE_DURATION, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          if (finished) {
            runOnJS(setShouldRender)(false);
          }
        },
      );
    }
  }, [visible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      accessibilityRole="alert"
      accessibilityLabel="We added a few tools to get you started. You can add your own later."
    >
      <View style={styles.content}>
        <Text style={styles.icon} accessibilityElementsHidden>
          ℹ️
        </Text>
        <Text style={styles.text}>
          We added a few tools to get you started. You can add your own later.
        </Text>
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss banner"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.dismissIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EBF5FF',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C4DDFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#2C3E50',
  },
  dismissButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dismissIcon: {
    fontSize: 16,
    color: '#636366',
    fontWeight: '600',
  },
});
