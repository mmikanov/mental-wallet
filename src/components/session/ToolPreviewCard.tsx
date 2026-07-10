/**
 * ToolPreviewCard — Compact card preview showing icon, title, and truncated description.
 *
 * Displays a tappable card row that navigates to the full card expansion.
 * For library-sourced tools, shows an "Add to wallet" option after the user
 * returns from viewing the tool.
 *
 * Validates: Requirements 2.6, 7.1, 10.1, 10.4, 10.5
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RationaleEntryPoint } from '@/components/rationale/RationaleEntryPoint';
import { RationaleSheet } from '@/components/rationale/RationaleSheet';
import type { RationaleMetadata } from '@/types/rationale';

export interface ToolPreviewCardProps {
  cardId: string;
  title: string;
  description: string;
  iconValue: string;
  source: 'wallet' | 'library';
  onPress: (cardId: string) => void;
  showAddToWallet?: boolean;
  onAddToWallet?: (cardId: string) => void;
  isAddedToWallet?: boolean;
  /** The in-a-nutshell text for the rationale entry point */
  rationaleInANutshell?: string;
  /** Full rationale metadata for the rationale sheet */
  rationale?: RationaleMetadata;
  /** Whether the card's emotion tags include distress emotions */
  isDistressRelated?: boolean;
  /** Navigation handler for crisis resources */
  onCrisisResourcesPress?: () => void;
}

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 * If the string is <= maxLength, return as-is.
 */
export function truncateDescription(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export default function ToolPreviewCard({
  cardId,
  title,
  description,
  iconValue,
  source,
  onPress,
  showAddToWallet = false,
  onAddToWallet,
  isAddedToWallet = false,
  rationaleInANutshell,
  rationale,
  isDistressRelated = false,
  onCrisisResourcesPress,
}: ToolPreviewCardProps) {
  const [rationaleSheetVisible, setRationaleSheetVisible] = useState(false);
  const sourceLabel = source === 'wallet' ? 'from your wallet' : 'from library';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.cardRow}
        onPress={() => onPress(cardId)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${sourceLabel}`}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>{iconValue}</Text>
        <View style={styles.textStack}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {truncateDescription(description)}
            {rationale && (
              <RationaleEntryPoint
                inANutshell={rationaleInANutshell}
                onPress={() => setRationaleSheetVisible(true)}
              />
            )}
          </Text>
        </View>
      </TouchableOpacity>

      {showAddToWallet && source === 'library' && (
        <View style={styles.addToWalletRow}>
          {isAddedToWallet ? (
            <Text style={styles.addedText}>Added ✓</Text>
          ) : (
            <TouchableOpacity
              onPress={() => onAddToWallet?.(cardId)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${title} to wallet`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.addToWalletText}>Add to wallet</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {rationale && (
        <RationaleSheet
          visible={rationaleSheetVisible}
          rationale={rationale}
          cardTitle={title}
          isDistressRelated={isDistressRelated}
          onDismiss={() => setRationaleSheetVisible(false)}
          onCrisisResourcesPress={onCrisisResourcesPress ?? (() => {})}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textStack: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  addToWalletRow: {
    marginTop: 8,
  },
  addToWalletText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
  },
  addedText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
});
