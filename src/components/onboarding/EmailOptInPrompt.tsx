/**
 * EmailOptInPrompt — a one-time, non-modal banner inviting the user to opt into
 * email tips/reminders after they've felt value (their Nth tool completion).
 *
 * Privacy-preserving: the app collects NO email. "Subscribe" links out to the
 * website subscribe page (handled by the parent); the app only records that the
 * prompt was seen so it never shows again (Settings remains the always-available
 * path). Modeled on OnboardingBanner (fade in/out, accessibilityRole="alert").
 *
 * The parent owns visibility and persistence: it calls onSubscribe (open the
 * subscribe page + mark seen) or onDismiss (mark seen).
 *
 * Validates: spec 1.0.4-email-optin-and-cta-upgrade Req 1.4, 1.5.
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

export interface EmailOptInPromptProps {
  visible: boolean;
  onSubscribe: () => void;
  onDismiss: () => void;
}

export default function EmailOptInPrompt({ visible, onSubscribe, onDismiss }: EmailOptInPromptProps) {
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
      accessibilityLabel="Want occasional tips and optional reminders by email? Change or stop anytime."
    >
      <View style={styles.headerRow}>
        <Text style={styles.icon} accessibilityElementsHidden>
          ✉️
        </Text>
        <Text style={styles.text}>
          Want occasional tips and optional reminders by email? Change or stop anytime.
        </Text>
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissButton}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.dismissIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={onSubscribe}
        style={styles.subscribeButton}
        accessibilityRole="button"
        accessibilityLabel="Subscribe to email updates"
      >
        <Text style={styles.subscribeText}>Subscribe</Text>
      </TouchableOpacity>
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
  headerRow: {
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
  subscribeButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  subscribeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
