/**
 * Deep link configuration for notification taps.
 *
 * When a `card_reminder` notification is tapped, the app navigates
 * to the Wallet screen with the associated card focused.
 *
 * Validates: Requirements 12.4
 */

import type { LinkingOptions } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['mentalwallet://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Wallet: 'wallet',
        },
      },
      Archive: 'archive',
      Settings: 'settings',
    },
  },
  /**
   * Handles notification taps by extracting the card_reminder payload
   * and returning a deep link URL that routes to the Wallet with the focused card.
   */
  async getInitialURL() {
    // Check if the app was opened from a notification
    const response = await Notifications.getLastNotificationResponseAsync();
    const data = response?.notification.request.content.data;

    if (data?.type === 'card_reminder' && data?.cardId) {
      return `mentalwallet://wallet?focusCardId=${data.cardId}`;
    }

    return null;
  },
  subscribe(listener) {
    // Listen for notification taps while the app is running
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'card_reminder' && data?.cardId) {
          listener(`mentalwallet://wallet?focusCardId=${data.cardId}`);
        }
      }
    );

    return () => subscription.remove();
  },
};
