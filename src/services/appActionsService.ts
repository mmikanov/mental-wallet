import * as StoreReview from 'expo-store-review';
import { Share, Platform, Alert, Linking } from 'react-native';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_FEEDBACK_EMAIL, getStoreUrl, getAppVersion } from '@/config/appInfo';

export async function requestAppReview(): Promise<void> {
  const isAvailable = await StoreReview.isAvailableAsync();
  if (isAvailable) {
    await StoreReview.requestReview();
  } else {
    const storeUrl = StoreReview.storeUrl();
    if (storeUrl) {
      await Linking.openURL(storeUrl);
    } else {
      await Linking.openURL(getStoreUrl());
    }
  }
}

export async function shareApp(): Promise<void> {
  const url = getStoreUrl();
  const message = `I've been using ${APP_NAME} to build better coping habits. Check it out: ${url}`;
  await Share.share({ message, url });
}

export async function contactSupport(): Promise<void> {
  const subject = encodeURIComponent(`${APP_NAME} — Support Request`);
  const body = encodeURIComponent(buildEmailBody('support'));
  const mailto = `mailto:${APP_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  try {
    const canOpen = await Linking.canOpenURL(mailto);
    if (canOpen) {
      await Linking.openURL(mailto);
      return;
    }
  } catch {
    // Fall through to alert
  }
  Alert.alert('No Email App', `Send your request to:\n${APP_SUPPORT_EMAIL}`, [{ text: 'OK' }]);
}

export async function sendFeedback(): Promise<void> {
  const subject = encodeURIComponent(`${APP_NAME} — Feedback`);
  const body = encodeURIComponent(buildEmailBody('feedback'));
  const mailto = `mailto:${APP_FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;

  try {
    const canOpen = await Linking.canOpenURL(mailto);
    if (canOpen) {
      await Linking.openURL(mailto);
      return;
    }
  } catch {
    // Fall through to alert
  }
  Alert.alert('No Email App', `Send your feedback to:\n${APP_FEEDBACK_EMAIL}`, [{ text: 'OK' }]);
}

function buildEmailBody(type: 'support' | 'feedback'): string {
  const version = getAppVersion();
  const os = `${Platform.OS} ${Platform.Version}`;

  const greeting = type === 'feedback'
    ? "What's on your mind? We'd love to hear your ideas, suggestions, or anything else.\n\n\n"
    : "\n\n\n";

  return `${greeting}---\nApp: ${version}\nOS: ${os}\n`;
}
