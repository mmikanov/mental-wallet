/**
 * CardKebabMenu — Bottom-sheet style menu for card contextual actions.
 *
 * Renders menu items based on the card's originBadge:
 * - "my_tool": Edit, Duplicate tool, View usage history, Set reminder, Archive card
 * - "library" / "community": Duplicate tool, View usage history, Set reminder, Archive card
 *
 * Handles the read-only protection (Req 9.5): if a library/community card
 * somehow triggers edit, shows a read-only alert offering "Duplicate tool".
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.5, 10.1, 10.2, 10.3, 10.4
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Pressable,
} from 'react-native';
import type { Card } from '@/types/index';

export interface CardKebabMenuProps {
  visible: boolean;
  card: Card;
  onClose: () => void;
  onEdit: (cardId: string) => void;
  onDuplicate: (cardId: string) => void;
  onViewUsageHistory: (cardId: string) => void;
  onSetReminder: (cardId: string) => void;
  onArchive: (cardId: string) => void;
  onCustomizeBackground?: (cardId: string) => void;
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  destructive?: boolean;
}

/**
 * Shows a read-only alert for Library/Community cards with a Duplicate option.
 * Implements Requirement 9.5.
 */
export function showReadOnlyAlert(
  cardId: string,
  onDuplicate: (cardId: string) => void
): void {
  Alert.alert(
    'Read-only card',
    'This card is read-only. Would you like to duplicate it to create an editable copy?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Duplicate', onPress: () => onDuplicate(cardId) },
    ]
  );
}

export default function CardKebabMenu({
  visible,
  card,
  onClose,
  onEdit,
  onDuplicate,
  onViewUsageHistory,
  onSetReminder,
  onArchive,
  onCustomizeBackground,
}: CardKebabMenuProps) {
  const isEditable = card.originBadge === 'my_tool';

  const handleEdit = () => {
    onClose();
    if (isEditable) {
      onEdit(card.id);
    } else {
      // Req 9.5: Show read-only message + offer Duplicate
      showReadOnlyAlert(card.id, onDuplicate);
    }
  };

  const handleDuplicate = () => {
    onClose();
    onDuplicate(card.id);
  };

  const handleViewUsageHistory = () => {
    onClose();
    onViewUsageHistory(card.id);
  };

  const handleSetReminder = () => {
    onClose();
    onSetReminder(card.id);
  };

  const handleArchive = () => {
    onClose();
    Alert.alert(
      'Archive card',
      `Are you sure you want to archive "${card.title}"? You can restore it later from the Archive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => onArchive(card.id),
        },
      ]
    );
  };

  const handleCustomizeBackground = () => {
    onClose();
    onCustomizeBackground?.(card.id);
  };

  // Build menu items based on origin badge (Req 10.1, 10.2, 10.4)
  const menuItems: MenuItem[] = [];

  if (isEditable) {
    menuItems.push({ label: 'Edit', icon: '✏️', action: handleEdit });
  }

  menuItems.push({ label: 'Duplicate tool', icon: '📋', action: handleDuplicate });
  menuItems.push({ label: 'View usage history', icon: '📊', action: handleViewUsageHistory });
  menuItems.push({ label: 'Set reminder', icon: '⏰', action: handleSetReminder });

  // Customize background — only for Library/Community cards with the flag enabled
  if (!isEditable && card.allowBackgroundCustomization && onCustomizeBackground) {
    menuItems.push({ label: 'Customize background', icon: '🎨', action: handleCustomizeBackground });
  }

  menuItems.push({
    label: 'Archive card',
    icon: '📦',
    action: handleArchive,
    destructive: true,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Card actions
          </Text>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={item.action}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text
                style={[
                  styles.menuLabel,
                  item.destructive && styles.destructiveLabel,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    minHeight: 48,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  destructiveLabel: {
    color: '#DC2626',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    minHeight: 48,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
