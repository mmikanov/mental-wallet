/**
 * Central app identity constants.
 * Change the app name here and it propagates everywhere in the UI.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_NAME = 'Mental Wallet';
export const APP_CONTACT_EMAIL = 'mentalhealthwallet@productsforgood.co';
export const APP_SUPPORT_EMAIL = 'mentalhealthwallet@productsforgood.co';
export const APP_FEEDBACK_EMAIL = 'mentalhealthwallet@productsforgood.co';

export const APP_STORE_URL = 'https://apps.apple.com/app/mental-wallet/id<TBD>';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mentalwallet.app';

export const PRIVACY_POLICY_URL = 'https://mentalhealthwallet.productsforgood.co/privacy';
export const TERMS_OF_SERVICE_URL = 'https://mentalhealthwallet.productsforgood.co/terms';

export function getStoreUrl(): string {
  return Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
}

export function getAppVersion(): string {
  const version = Constants.expoConfig?.version;
  const buildNumber = Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : Constants.expoConfig?.android?.versionCode?.toString();
  
  if (!version) return 'Version (dev)';
  if (buildNumber) return `Version ${version} (${buildNumber})`;
  return `Version ${version}`;
}
