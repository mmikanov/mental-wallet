/**
 * DaysSinceBadge — Red notification badge overlaid on the KPI FAB.
 *
 * Displays the number of calendar days since the user's last KPI check-in.
 * Hidden when daysElapsed is null or 0 (checked in today or no records).
 * Animates in with a spring scale-up when transitioning from hidden to visible.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 6.3
 */

import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { getBadgeWidth, getBadgeFontSize, formatBadgeText } from '@/utils/kpiBadgeUtils';

interface DaysSinceBadgeProps {
  daysElapsed: number | null;
}

export function DaysSinceBadge({ daysElapsed }: DaysSinceBadgeProps) {
  const scale = useSharedValue(daysElapsed && daysElapsed >= 1 ? 1 : 0);

  useEffect(() => {
    if (daysElapsed && daysElapsed >= 1) {
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    } else {
      scale.value = 0;
    }
  }, [daysElapsed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (daysElapsed === null || daysElapsed === 0) return null;

  const width = getBadgeWidth(daysElapsed);
  const fontSize = getBadgeFontSize(daysElapsed);
  const text = formatBadgeText(daysElapsed);

  return (
    <Animated.View
      style={[styles.badge, { width, height: 20 }, animatedStyle]}
      pointerEvents="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
    >
      <Animated.Text style={[styles.text, { fontSize }]}>
        {text}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    ...Platform.select({
      ios: { lineHeight: 20 },
      android: { lineHeight: 20 },
    }),
  },
});
