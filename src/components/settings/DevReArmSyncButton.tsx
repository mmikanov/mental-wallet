/**
 * DevReArmSyncButton — Dev-only button that re-arms the Library Card Sync
 * "update available" flow (library-card-sync spec, Req 5).
 *
 * Once a card is updated its stored source_library_version is set current, so it
 * stops showing "Update available". Without a reset the flow can only be tested
 * once per install per card. This button puts every eligible card back into the
 * outdated state and (for the built-in check-in tool) applies a visible content
 * downgrade so re-applying the update produces a real change, not a no-op.
 *
 * All DB work lives in `reArmLibrarySync()` (testable without rendering). This
 * component is a thin, self-contained wrapper mirroring `SeedInsightsButton`:
 * bordered container, header, button, hint, ActivityIndicator busy state, and an
 * Alert on completion/error. After the writes it refreshes the wallet store so
 * the pills reappear immediately.
 *
 * Belt-and-suspenders: it is mounted only inside the `{__DEV__ && ...}` Developer
 * section of SettingsScreen AND returns null when `!__DEV__`, so it can never
 * render in a production build.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { reArmLibrarySync } from '@/services/devReArmLibrarySync';
import { useWalletStore } from '@/stores/walletStore';

export function DevReArmSyncButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleReArm = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await reArmLibrarySync();

      // Refresh wallet cards so the "Update available" pills reappear right away.
      await useWalletStore.getState().loadCards();

      Alert.alert(
        'Update Flow Re-armed',
        `Reset ${result.versionResetCount} card${
          result.versionResetCount === 1 ? '' : 's'
        } to outdated.\n\n` +
          (result.downgradedControlCount > 0
            ? `Downgraded ${result.downgradedControlCount} check-in note field back to single-line — re-applying the update will show a visible change.`
            : 'No check-in note field to downgrade — re-applying may be a no-op refresh for cards whose curated version is not ahead.')
      );
    } catch (error) {
      Alert.alert(
        'Re-arm Failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Belt-and-suspenders guard: never render in a production build even if this
  // component is ever mounted outside the Developer section's __DEV__ gate. Hooks
  // are declared unconditionally above (Rules of Hooks); only the output is gated.
  if (!__DEV__) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🔁 Library Sync Re-arm</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleReArm}
        disabled={isLoading}
        accessibilityLabel="Re-arm library update flow for all eligible cards"
        accessibilityRole="button"
        testID="dev-rearm-sync-button"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Re-arm library update flow (all eligible cards)</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        Resets every library-linked card to the outdated state so the “Update
        available” pill reappears. Re-applying may be a no-op refresh for some
        cards — only cards whose curated version is now ahead will apply changes.
        The built-in check-in note field is downgraded to single-line so its
        re-apply is visible.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  header: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#6B4EFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default DevReArmSyncButton;
