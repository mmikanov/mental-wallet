/**
 * Step4Rationale — Admin-only step for editing rationale metadata on library cards.
 *
 * Provides a full-screen scrollable form for rationale fields,
 * with a fixed Save button at the bottom.
 *
 * Validates: Requirements 8.1, 8.4
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import RationaleFormSection, { type RationaleFormData } from './RationaleFormSection';

interface Step4RationaleProps {
  data: RationaleFormData;
  onChange: (data: RationaleFormData) => void;
  onSave: () => void;
  isSaving?: boolean;
}

export default function Step4Rationale({
  data,
  onChange,
  onSave,
  isSaving = false,
}: Step4RationaleProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <RationaleFormSection data={data} onChange={onChange} />
      </ScrollView>

      {/* Save button pinned to bottom */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Save card"
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
