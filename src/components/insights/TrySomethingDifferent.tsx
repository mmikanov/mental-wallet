/**
 * TrySomethingDifferent — Suggests 1–2 unused tools (no completion in last
 * 7 days) with tappable deep links to each tool's focused view.
 *
 * The selection/sorting logic is handled by the service layer. This component
 * receives pre-filtered results and simply renders them. If the tools array
 * is empty (all tools used within last 7 days), the component renders null
 * — the section is hidden entirely.
 *
 * Validates: Requirements 6.10
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// --- Props ---

export interface TrySomethingDifferentProps {
  tools: Array<{
    cardId: string;
    cardTitle: string;
  }>;
  onToolPress?: (cardId: string) => void;
}

// --- Component ---

export function TrySomethingDifferent({ tools, onToolPress }: TrySomethingDifferentProps) {
  // Hide entirely if no unused tools to suggest
  if (tools.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="try-something-different">
      <Text style={styles.sectionTitle}>Try something different</Text>

      {tools.map((tool) => (
        <TouchableOpacity
          key={tool.cardId}
          style={styles.toolRow}
          onPress={() => onToolPress?.(tool.cardId)}
          accessibilityRole="link"
          accessibilityLabel={`${tool.cardTitle}. Open this tool.`}
          testID={`try-different-tool-${tool.cardId}`}
        >
          <Text style={styles.toolName} numberOfLines={1}>
            {tool.cardTitle}
          </Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  toolName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2B7DE9',
    flex: 1,
    marginRight: 12,
  },
  arrow: {
    fontSize: 16,
    color: '#2B7DE9',
    fontWeight: '600',
  },
});
