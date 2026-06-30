/**
 * OnboardingNavigator — Nested native-stack navigator for the onboarding flow.
 *
 * Contains the Welcome and IntentSelection screens.
 * - Headers are hidden for a full-screen, immersive onboarding experience.
 * - Back-swipe gesture is disabled on the Welcome screen (Req 1.6)
 *   to prevent users from navigating backward from the entry point.
 *
 * Validates: Requirements 1.6, 2.5
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
import IntentSelectionScreen from '@/screens/onboarding/IntentSelectionScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  IntentSelection: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="IntentSelection" component={IntentSelectionScreen} />
    </Stack.Navigator>
  );
}
