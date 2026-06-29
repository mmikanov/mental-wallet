/**
 * ContextChips — Multi-select context chips for emotion session refinement.
 *
 * Displays a set of contextual situation chips that the user can toggle
 * to refine tool recommendations. Multiple chips can be selected simultaneously.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.6
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ContextType } from '@/types/index';

export interface ContextChipsProps {
  selectedContexts: ContextType[];
  onToggleContext: (context: ContextType) => void;
}

const CONTEXT_OPTIONS: { type: ContextType; label: string }[] = [
  { type: 'at_work', label: 'At work/school' },
  { type: 'with_family', label: 'With family' },
  { type: 'with_friends', label: 'With friends/social' },
  { type: 'alone_at_home', label: 'Alone at home' },
  { type: 'not_sure', label: "I'm not sure" },
];

export default function ContextChips({
  selectedContexts,
  onToggleContext,
}: ContextChipsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Where are you right now?</Text>
      <View style={styles.chipsRow}>
        {CONTEXT_OPTIONS.map(({ type, label }) => {
          const isSelected = selectedContexts.includes(type);
          return (
            <Pressable
              key={type}
              style={[
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
              ]}
              onPress={() => onToggleContext(type)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#7C3AED',
  },
  chipTextUnselected: {
    color: '#374151',
  },
});
