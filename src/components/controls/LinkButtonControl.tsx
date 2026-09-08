/**
 * LinkButtonControl — Opens a URL when tapped, shows a styled button with label.
 *
 * Uses Linking.openURL. On failure, attempts fallbackUrl if configured,
 * otherwise shows an error message.
 *
 * Logs activation (success/failure) for tracking purposes.
 * This is a display/action-only control — no user input stored.
 * The "value" tracks whether the link was activated ("opened" or "").
 *
 * Validates: Requirements 6.1, 6.4, 6.5, 6.6, 6.7
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, StyleSheet } from 'react-native';
import type { Control, LinkButtonConfig } from '@/types/index';
import type { ExternalAppConfig } from '@/types/externalApp';
import { resolveStoreFallbackUrl } from '@/services/deepLinkService';
import { logEvent } from '@/services/analyticsEventLogger';

interface LinkButtonControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
  /**
   * For curated third-party "app" cards: the external app's config. When present,
   * the store fallback is resolved per-platform (Google Play on Android, App Store
   * on iOS) instead of using the control's hardcoded fallback URL — which is always
   * an Apple App Store link. Absent for user-created link buttons, which keep their
   * literal fallbackUrl unchanged.
   */
  externalApp?: ExternalAppConfig;
}

/**
 * Attempts to open a URL via the system handler.
 * For custom URL schemes (non-http/https), skips canOpenURL check and tries
 * openURL directly — this works on iOS without LSApplicationQueriesSchemes
 * whitelisting, allowing user-defined deep links to any app.
 * Returns true if successful, false otherwise.
 */
export async function tryOpenUrl(url: string): Promise<boolean> {
  try {
    const isCustomScheme = !url.startsWith('http://') && !url.startsWith('https://');

    if (isCustomScheme) {
      // Skip canOpenURL for custom schemes — openURL works without whitelisting
      await Linking.openURL(url);
      return true;
    }

    // For http/https URLs, check first (avoids opening Safari unnecessarily)
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function LinkButtonControl({
  control,
  value,
  onChange,
  externalApp,
}: LinkButtonControlProps) {
  const config = control.config as LinkButtonConfig;
  const [opening, setOpening] = useState(false);

  const handlePress = useCallback(async () => {
    if (opening) return;
    setOpening(true);

    console.log(`[LinkButton] Activation attempt: "${config.label}" → ${config.targetUrl}`);

    const targetOpened = await tryOpenUrl(config.targetUrl);

    if (targetOpened) {
      console.log(`[LinkButton] Success: opened target URL ${config.targetUrl}`);
      void logEvent('external_resource_opened', {
        resource_url: config.targetUrl,
        resource_name: config.label,
      });
      onChange('opened');
      setOpening(false);
      return;
    }

    // Target failed — pick a fallback. For curated third-party app cards, resolve
    // the store URL per-platform (Google Play on Android, App Store on iOS) so an
    // Android user isn't sent to the Apple App Store. For user-created link buttons
    // (no externalApp), use the control's literal fallbackUrl unchanged.
    const fallbackUrl = externalApp
      ? resolveStoreFallbackUrl(externalApp) ?? config.fallbackUrl
      : config.fallbackUrl;

    if (fallbackUrl) {
      console.log(`[LinkButton] Target failed, attempting fallback: ${fallbackUrl}`);
      const fallbackOpened = await tryOpenUrl(fallbackUrl);

      if (fallbackOpened) {
        console.log(`[LinkButton] Success: opened fallback URL ${fallbackUrl}`);
        void logEvent('external_resource_opened', {
          resource_url: fallbackUrl,
          resource_name: config.label,
        });
        onChange('opened');
        setOpening(false);
        return;
      }
    }

    // Both target and fallback failed (or no fallback configured)
    console.log(`[LinkButton] Failure: could not open URL for "${config.label}"`);
    Alert.alert(
      'Unable to open',
      "Couldn't open this app. It may not be installed. You can edit this tool to change the link."
    );
    setOpening(false);
  }, [config.targetUrl, config.fallbackUrl, config.label, opening, onChange, externalApp]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={opening}
        accessibilityRole="link"
        accessibilityLabel={config.label}
        accessibilityHint="Opens an external link"
      >
        <Text style={styles.buttonText}>{config.label}</Text>
        <Text style={styles.externalIcon}>↗</Text>
      </TouchableOpacity>
      {value === 'opened' && (
        <Text style={styles.openedHint}>Link opened</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0284C7',
  },
  externalIcon: {
    fontSize: 16,
    color: '#0284C7',
    marginLeft: 6,
  },
  openedHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
});
