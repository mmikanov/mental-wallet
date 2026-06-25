/**
 * WalletHeader — "My Wallet" title with a kebab menu (3 dots).
 *
 * Kebab menu options: Archive, Settings (linking to respective screens).
 *
 * Validates: Requirements 1.4
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';

export interface WalletHeaderProps {
  onArchivePress: () => void;
  onSettingsPress: () => void;
  onAddToolPress?: () => void;
  onCreateToolPress?: () => void;
}

export default function WalletHeader({
  onArchivePress,
  onSettingsPress,
  onAddToolPress,
  onCreateToolPress,
}: WalletHeaderProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  function handleMenuOption(action: () => void) {
    setMenuVisible(false);
    action();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Wallet</Text>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Wallet menu"
        accessibilityHint="Opens menu with Archive and Settings options"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.menuIcon}>⋮</Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            {onAddToolPress && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuOption(onAddToolPress)}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Add Tool"
                >
                  <Text style={styles.menuItemText}>Add Tool</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />
              </>
            )}

            {onCreateToolPress && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuOption(onCreateToolPress)}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Create Tool"
                >
                  <Text style={styles.menuItemText}>Create Tool</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />
              </>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuOption(onArchivePress)}
              accessibilityRole="menuitem"
              accessibilityLabel="Archive"
            >
              <Text style={styles.menuItemText}>Archive</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuOption(onSettingsPress)}
              accessibilityRole="menuitem"
              accessibilityLabel="Settings"
            >
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 24,
    color: '#1C1C1E',
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
  },
});
