/**
 * Step3Preview — Full interactive preview of the card as it will appear in the Wallet.
 *
 * Renders the card shell (background, icon, title, description, category pill,
 * "My tool" origin badge) and all controls interactively so the user can verify
 * behavior before saving.
 *
 * Validates: Requirements 7.6, 7.8
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import type { CardShell, Control, EmotionType } from '@/types/index';
import { isLightBackground } from '@/utils/cardColors';
import ControlRenderer from '@/components/controls/ControlRenderer';
import OriginBadge from '@/components/wallet/OriginBadge';
import PrimaryActionButton from '@/components/wallet/PrimaryActionButton';

interface Step3PreviewProps {
  shell: CardShell;
  controls: Control[];
  categoryId: string;
  onSave: () => void;
  isSaving?: boolean;
  selectedEmotionTags: EmotionType[];
  onEmotionTagsChange: (tags: EmotionType[]) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'grounding-calming': '#4A90D9',
  'cognitive-reframing': '#E8A838',
  'body-sensory': '#E06B6B',
  'daily-checkin-journaling': '#5BA88B',
  'self-compassion-reminders': '#9B59B6',
  'lightweight-connection': '#F39C7A',
};

const CATEGORY_LABELS: Record<string, string> = {
  'grounding-calming': 'Grounding & Calming',
  'cognitive-reframing': 'Cognitive Reframing',
  'body-sensory': 'Body & Sensory',
  'daily-checkin-journaling': 'Daily Check-In',
  'self-compassion-reminders': 'Self-Compassion',
  'lightweight-connection': 'Connection',
};

const EMOTION_CHIPS: { value: EmotionType; label: string }[] = [
  { value: 'stressed', label: 'Stressed' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'numb', label: 'Numb' },
];

export default function Step3Preview({
  shell,
  controls,
  categoryId,
  onSave,
  isSaving = false,
  selectedEmotionTags,
  onEmotionTagsChange,
}: Step3PreviewProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleControlChange = (controlId: string, value: string) => {
    setValues((prev) => ({ ...prev, [controlId]: value }));
  };

  const handleEmotionToggle = (emotion: EmotionType) => {
    if (selectedEmotionTags.includes(emotion)) {
      onEmotionTagsChange(selectedEmotionTags.filter((e) => e !== emotion));
    } else {
      if (selectedEmotionTags.length < 6) {
        onEmotionTagsChange([...selectedEmotionTags, emotion]);
      }
    }
  };

  const categoryColor = CATEGORY_COLORS[categoryId] || '#4A90D9';
  const categoryLabel = CATEGORY_LABELS[categoryId] || categoryId;

  const backgroundStyle = shell.backgroundType === 'color' && shell.backgroundValue
    ? { backgroundColor: shell.backgroundValue }
    : shell.backgroundType === 'gradient' && shell.backgroundValue
    ? { backgroundColor: shell.backgroundValue.split(',')[0] || '#F5F5F5' }
    : { backgroundColor: '#F5F5F5' };

  const isImageBackground = shell.backgroundType === 'image' && shell.backgroundValue;

  // Determine text color based on background brightness
  const bgForContrast = shell.backgroundType === 'color' && shell.backgroundValue
    ? shell.backgroundValue
    : '#F5F5F5';
  const isLight = isImageBackground ? false : isLightBackground(bgForContrast);
  const textColor = isLight ? '#1F2937' : '#FFFFFF';
  const subtitleColor = isLight ? '#4B5563' : 'rgba(255,255,255,0.8)';

  const cardContent = (
    <>
      {/* Origin Badge */}
      <OriginBadge origin="my_tool" />

      {/* Icon + Title */}
      <View style={styles.titleRow}>
        {shell.iconValue ? (
          <Text style={styles.icon}>{shell.iconValue}</Text>
        ) : null}
        <Text style={[styles.title, { color: textColor }, isImageBackground && styles.titleOnImage]} numberOfLines={2}>
          {shell.title || 'Untitled'}
        </Text>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: subtitleColor }, isImageBackground && styles.descriptionOnImage]} numberOfLines={3}>
        {shell.description || 'No description'}
      </Text>

      {/* Category pill */}
      <View style={[styles.categoryPill, { backgroundColor: categoryColor + '20' }]}>
        <Text style={[styles.categoryText, { color: categoryColor }]}>
          {categoryLabel}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Controls (interactive) */}
      <ControlRenderer
        controls={controls}
        values={values}
        onChange={handleControlChange}
      />

      {/* Primary Action Button */}
      <View style={styles.actionButtonWrapper}>
        <PrimaryActionButton
          controls={controls}
          onPress={() => {
            // In preview mode, just demonstrate the button works
          }}
        />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Card Preview Shell */}
        {isImageBackground ? (
          <ImageBackground
            source={{ uri: shell.backgroundValue }}
            style={styles.cardShell}
            imageStyle={{ borderRadius: 16 }}
          >
            <View style={styles.imageOverlay}>
              {cardContent}
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.cardShell, backgroundStyle]}>
            {cardContent}
          </View>
        )}
      </ScrollView>

      {/* Emotion Tagging Section (Req 9.1) */}
      <View style={styles.emotionSection}>
        <Text style={styles.emotionHeading}>When does this tool help?</Text>
        <Text style={styles.emotionSubtext}>
          Optional — tag with emotions so this tool appears in your sessions
        </Text>
        <View style={styles.emotionChipsRow}>
          {EMOTION_CHIPS.map((chip) => {
            const isSelected = selectedEmotionTags.includes(chip.value);
            return (
              <TouchableOpacity
                key={chip.value}
                style={[
                  styles.emotionChip,
                  isSelected && styles.emotionChipSelected,
                ]}
                onPress={() => handleEmotionToggle(chip.value)}
                accessibilityRole="button"
                accessibilityLabel={chip.label}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.emotionChipText,
                    isSelected && styles.emotionChipTextSelected,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Save Button (outside the card preview) */}
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
    padding: 16,
    paddingBottom: 24,
  },
  cardShell: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageOverlay: {
    padding: 20,
    borderRadius: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  titleOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 20,
  },
  descriptionOnImage: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  actionButtonWrapper: {
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#5BA88B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emotionSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  emotionHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  emotionSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 12,
  },
  emotionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  emotionChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  emotionChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  emotionChipTextSelected: {
    color: '#FFFFFF',
  },
});
