/**
 * LibraryToolPreview — Shows a library tool's content for the user to try
 * without needing to add it to their wallet first.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { Control } from '@/types/index';
import ControlRenderer from '@/components/controls/ControlRenderer';
import { RationaleEntryPoint } from '@/components/rationale/RationaleEntryPoint';
import { RationaleSheet } from '@/components/rationale/RationaleSheet';

interface LibraryToolPreviewProps {
  card: CuratedCardDefinition;
  onClose: () => void;
  onAddToWallet: (cardId: string) => void;
  isAddedToWallet: boolean;
}

export default function LibraryToolPreview({
  card,
  onClose,
  onAddToWallet,
  isAddedToWallet,
}: LibraryToolPreviewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [rationaleVisible, setRationaleVisible] = useState(false);

  const isDistressRelated =
    card.emotionTags?.some((tag) =>
      ['anxious', 'angry', 'stressed'].includes(tag)
    ) ?? false;

  const handleControlChange = (controlId: string, value: string) => {
    setValues((prev) => ({ ...prev, [controlId]: value }));
  };

  // Map controls to the format ControlRenderer expects
  const controls: Control[] = card.controls.map((ctrl, i) => ({
    id: `preview-${card.id}-${i}`,
    cardId: card.id,
    type: ctrl.type,
    position: ctrl.position,
    config: ctrl.config,
    isRequired: ctrl.isRequired,
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>← Back to session</Text>
        </TouchableOpacity>
      </View>

      {/* Card content */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Card shell */}
        <View style={[styles.cardShell, { backgroundColor: card.backgroundValue || '#F5F5F5' }]}>
          <Text style={styles.icon}>{card.iconValue}</Text>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.description}>
            {card.description}
            <RationaleEntryPoint
              inANutshell={card.rationale?.inANutshell}
              onPress={() => setRationaleVisible(true)}
            />
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <ControlRenderer
            controls={controls}
            values={values}
            onChange={handleControlChange}
          />
        </View>
      </ScrollView>

      {/* Footer — Add to wallet */}
      <View style={styles.footer}>
        {isAddedToWallet ? (
          <Text style={styles.addedText}>Added to wallet ✓</Text>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAddToWallet(card.id)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${card.title} to wallet`}
          >
            <Text style={styles.addButtonText}>Add to my wallet</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rationale Sheet */}
      {card.rationale && (
        <RationaleSheet
          visible={rationaleVisible}
          rationale={card.rationale}
          cardTitle={card.title}
          isDistressRelated={isDistressRelated}
          onDismiss={() => setRationaleVisible(false)}
          onCrisisResourcesPress={() => setRationaleVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 15,
    color: '#7C3AED',
    fontWeight: '500',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  cardShell: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  controlsContainer: {
    marginTop: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addedText: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '600',
  },
});
