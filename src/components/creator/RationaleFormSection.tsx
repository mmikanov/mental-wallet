/**
 * RationaleFormSection — Admin-only form for editing rationale metadata on library cards.
 *
 * Displayed in Step 3 (Preview & Save) when admin mode is active.
 * Provides fields for: approach, in-a-nutshell, how-it-works, evidence level,
 * research summary (2-3 bullet points), and optional learn-more links.
 *
 * Validates: Requirements 8.1, 8.4
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { TherapeuticApproach, EvidenceLevel, LearnMoreLink } from '@/types/rationale';

const APPROACHES: TherapeuticApproach[] = [
  'CBT',
  'DBT',
  'ACT',
  'mindfulness-based stress reduction',
  'positive psychology',
  'somatic techniques',
  'grounding',
  'behavioral activation',
  'psychoeducation',
  'self-compassion',
];

/** Display labels for approaches (title case) */
const APPROACH_LABELS: Record<TherapeuticApproach, string> = {
  'CBT': 'CBT',
  'DBT': 'DBT',
  'ACT': 'ACT',
  'mindfulness-based stress reduction': 'Mindfulness-Based Stress Reduction',
  'positive psychology': 'Positive Psychology',
  'somatic techniques': 'Somatic Techniques',
  'grounding': 'Grounding',
  'behavioral activation': 'Behavioral Activation',
  'psychoeducation': 'Psychoeducation',
  'self-compassion': 'Self-Compassion',
};

const EVIDENCE_LEVELS: { value: EvidenceLevel; label: string }[] = [
  { value: 'strong', label: 'Strong' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'emerging', label: 'Emerging' },
  { value: 'not_specifically_studied', label: 'Not specifically studied' },
];

export interface RationaleFormData {
  approach: TherapeuticApproach | '';
  inANutshell: string;
  howItWorks: string;
  evidenceLevel: EvidenceLevel | '';
  researchSummary: string[];
  learnMoreLinks: LearnMoreLink[];
}

interface RationaleFormSectionProps {
  data: RationaleFormData;
  onChange: (data: RationaleFormData) => void;
}

export default function RationaleFormSection({ data, onChange }: RationaleFormSectionProps) {
  const updateField = <K extends keyof RationaleFormData>(key: K, value: RationaleFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const updateResearchItem = (index: number, value: string) => {
    const updated = [...data.researchSummary];
    updated[index] = value;
    onChange({ ...data, researchSummary: updated });
  };

  const addResearchItem = () => {
    if (data.researchSummary.length < 3) {
      onChange({ ...data, researchSummary: [...data.researchSummary, ''] });
    }
  };

  const removeResearchItem = (index: number) => {
    if (data.researchSummary.length > 2) {
      const updated = data.researchSummary.filter((_, i) => i !== index);
      onChange({ ...data, researchSummary: updated });
    }
  };

  const updateLinkTitle = (index: number, title: string) => {
    const updated = [...data.learnMoreLinks];
    updated[index] = { ...updated[index], title };
    onChange({ ...data, learnMoreLinks: updated });
  };

  const updateLinkUrl = (index: number, url: string) => {
    const updated = [...data.learnMoreLinks];
    updated[index] = { ...updated[index], url };
    onChange({ ...data, learnMoreLinks: updated });
  };

  const addLink = () => {
    onChange({ ...data, learnMoreLinks: [...data.learnMoreLinks, { title: '', url: '' }] });
  };

  const removeLink = (index: number) => {
    const updated = data.learnMoreLinks.filter((_, i) => i !== index);
    onChange({ ...data, learnMoreLinks: updated });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Rationale & Evidence</Text>
      <Text style={styles.sectionSubtext}>
        Required for library export. Explains why this tool might help.
      </Text>

      {/* Approach Picker */}
      <Text style={styles.fieldLabel}>Therapeutic Approach</Text>
      <View style={styles.chipRow}>
        {APPROACHES.map((approach) => (
          <TouchableOpacity
            key={approach}
            style={[
              styles.chip,
              data.approach === approach && styles.chipSelected,
            ]}
            onPress={() => updateField('approach', approach)}
            accessibilityRole="button"
            accessibilityState={{ selected: data.approach === approach }}
          >
            <Text
              style={[
                styles.chipText,
                data.approach === approach && styles.chipTextSelected,
              ]}
            >
              {APPROACH_LABELS[approach]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* In a nutshell */}
      <Text style={styles.fieldLabel}>In a nutshell (max 300 chars)</Text>
      <TextInput
        style={styles.textArea}
        value={data.inANutshell}
        onChangeText={(v) => updateField('inANutshell', v)}
        placeholder="1-2 sentences: what this tool is for and when to use it"
        multiline
        maxLength={300}
      />
      <Text style={styles.charCount}>{data.inANutshell.length}/300</Text>

      {/* How it works */}
      <Text style={styles.fieldLabel}>How it works (max 600 chars)</Text>
      <TextInput
        style={[styles.textArea, styles.textAreaLarge]}
        value={data.howItWorks}
        onChangeText={(v) => updateField('howItWorks', v)}
        placeholder="2-4 sentences: the mechanism or framework explaining why this may be effective"
        multiline
        maxLength={600}
      />
      <Text style={styles.charCount}>{data.howItWorks.length}/600</Text>

      {/* Evidence Level */}
      <Text style={styles.fieldLabel}>Evidence Level</Text>
      <View style={styles.chipRow}>
        {EVIDENCE_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.value}
            style={[
              styles.chip,
              data.evidenceLevel === level.value && styles.chipSelected,
            ]}
            onPress={() => updateField('evidenceLevel', level.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: data.evidenceLevel === level.value }}
          >
            <Text
              style={[
                styles.chipText,
                data.evidenceLevel === level.value && styles.chipTextSelected,
              ]}
            >
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Research Summary */}
      <Text style={styles.fieldLabel}>Research Summary (2-3 bullet points, max 200 chars each)</Text>
      {data.researchSummary.map((item, index) => (
        <View key={index} style={styles.bulletInputRow}>
          <Text style={styles.bulletPrefix}>•</Text>
          <TextInput
            style={styles.bulletInput}
            value={item}
            onChangeText={(v) => updateResearchItem(index, v)}
            placeholder={`Research point ${index + 1}`}
            multiline
            maxLength={200}
          />
          {data.researchSummary.length > 2 && (
            <TouchableOpacity
              onPress={() => removeResearchItem(index)}
              style={styles.removeButton}
              accessibilityLabel="Remove bullet"
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {data.researchSummary.length < 3 && (
        <TouchableOpacity onPress={addResearchItem} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add bullet point</Text>
        </TouchableOpacity>
      )}

      {/* Learn More Links (optional) */}
      <Text style={styles.fieldLabel}>Further Reading Links (optional)</Text>
      {data.learnMoreLinks.map((link, index) => (
        <View key={index} style={styles.linkGroup}>
          <TextInput
            style={styles.linkInput}
            value={link.title}
            onChangeText={(v) => updateLinkTitle(index, v)}
            placeholder="Link title (e.g., CBT overview — NHS)"
            maxLength={100}
          />
          <TextInput
            style={styles.linkInput}
            value={link.url}
            onChangeText={(v) => updateLinkUrl(index, v)}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity
            onPress={() => removeLink(index)}
            style={styles.removeButton}
            accessibilityLabel="Remove link"
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={addLink} style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add link</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    minHeight: 100,
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  bulletInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletPrefix: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 8,
    marginTop: 10,
  },
  bulletInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    minHeight: 44,
  },
  linkGroup: {
    marginBottom: 12,
    gap: 6,
  },
  linkInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  removeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  addButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  addButtonText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
  },
});
