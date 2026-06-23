/**
 * Step1Shell — Card shell fields editor (Step 1 of card creation).
 *
 * Provides:
 * - Title TextInput with char counter (max 80)
 * - Description TextInput with char counter (max 300)
 * - Emoji icon picker (grid of wellness-themed emojis)
 * - Background color picker (10 preset colors + custom hex)
 * - Category picker (pill selector from 6 seeded categories)
 * - Inline validation errors on "Next" tap
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 5.6, 5.7
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { validateShell } from '@/services/cardService';
import { SEED_CATEGORIES } from '@/data/seeds';
import BackgroundCustomizerSheet from '@/components/wallet/BackgroundCustomizerSheet';
import type { BackgroundType, CardShell, ValidationError } from '@/types/index';

interface Step1ShellProps {
  shell: CardShell;
  onShellChange: (shell: CardShell) => void;
  categoryId: string;
  onCategoryChange: (id: string) => void;
  onNext: () => void;
}

const EMOJI_OPTIONS = [
  '🧘', '💭', '🌊', '🌿', '💪', '📝', '✨', '💙', '🎯', '🏋️',
  '🧠', '😌', '🕊️', '🌈', '🙏', '❤️', '🌸', '⭐', '🔥', '🎵',
  '📚', '🌻', '☀️', '🍃', '💫', '🦋', '🌙', '🫧', '🤗', '💐',
];

const PRESET_COLORS = [
  { hex: '#4A90D9', name: 'Blue' },
  { hex: '#5BA88B', name: 'Green' },
  { hex: '#E88D67', name: 'Orange' },
  { hex: '#D4A5C9', name: 'Pink' },
  { hex: '#8B7EC8', name: 'Purple' },
  { hex: '#E6C84C', name: 'Yellow' },
  { hex: '#6B9EC4', name: 'Teal' },
  { hex: '#FF6B6B', name: 'Red' },
  { hex: '#4ECDC4', name: 'Mint' },
  { hex: '#F5F5F5', name: 'Light Gray' },
];

export default function Step1Shell({
  shell,
  onShellChange,
  categoryId,
  onCategoryChange,
  onNext,
}: Step1ShellProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [customHex, setCustomHex] = useState('');
  const [showBackgroundSheet, setShowBackgroundSheet] = useState(false);

  function getFieldError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleNext() {
    const result = validateShell(shell);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onNext();
  }

  function updateShell(updates: Partial<CardShell>) {
    const updated = { ...shell, ...updates };
    onShellChange(updated);
    // Clear errors for the changed field
    if (errors.length > 0) {
      const changedFields = Object.keys(updates);
      setErrors((prev) => prev.filter((e) => !changedFields.includes(e.field)));
    }
  }

  function selectEmoji(emoji: string) {
    updateShell({ iconType: 'emoji', iconValue: emoji });
    setShowEmojiPicker(false);
  }

  function selectColor(hex: string) {
    updateShell({ backgroundType: 'color', backgroundValue: hex });
  }

  function applyCustomHex() {
    const hex = customHex.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      selectColor(hex);
      setCustomHex('');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={[styles.textInput, getFieldError('title') && styles.inputError]}
          value={shell.title}
          onChangeText={(text) => updateShell({ title: text })}
          placeholder="Enter card title"
          maxLength={80}
          accessibilityLabel="Card title"
        />
        <View style={styles.fieldMeta}>
          <Text style={styles.charCount}>{shell.title.length}/80</Text>
          {getFieldError('title') && (
            <Text style={styles.errorText}>{getFieldError('title')}</Text>
          )}
        </View>
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, getFieldError('description') && styles.inputError]}
          value={shell.description}
          onChangeText={(text) => updateShell({ description: text })}
          placeholder="Describe what this tool does"
          maxLength={300}
          multiline
          numberOfLines={3}
          accessibilityLabel="Card description"
        />
        <View style={styles.fieldMeta}>
          <Text style={styles.charCount}>{shell.description.length}/300</Text>
          {getFieldError('description') && (
            <Text style={styles.errorText}>{getFieldError('description')}</Text>
          )}
        </View>
      </View>

      {/* Icon Picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Icon *</Text>
        <TouchableOpacity
          style={[styles.pickerButton, getFieldError('iconValue') && styles.inputError]}
          onPress={() => setShowEmojiPicker(true)}
          accessibilityLabel="Select icon"
          accessibilityRole="button"
        >
          <Text style={styles.pickerButtonText}>
            {shell.iconValue ? `${shell.iconValue}  Selected` : 'Tap to choose an icon'}
          </Text>
        </TouchableOpacity>
        {getFieldError('iconValue') && (
          <Text style={styles.errorText}>{getFieldError('iconValue')}</Text>
        )}
      </View>

      {/* Background Color Picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Background *</Text>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((color) => (
            <TouchableOpacity
              key={color.hex}
              style={[
                styles.colorSwatch,
                { backgroundColor: color.hex },
                shell.backgroundType === 'color' && shell.backgroundValue === color.hex && styles.colorSwatchSelected,
              ]}
              onPress={() => selectColor(color.hex)}
              accessibilityLabel={`Select ${color.name} background`}
              accessibilityRole="button"
            />
          ))}
        </View>
        {/* Custom hex input */}
        <View style={styles.customHexRow}>
          <TextInput
            style={styles.customHexInput}
            value={customHex}
            onChangeText={setCustomHex}
            placeholder="#AABBCC"
            maxLength={7}
            autoCapitalize="characters"
            accessibilityLabel="Custom hex color"
          />
          <TouchableOpacity
            style={styles.customHexButton}
            onPress={applyCustomHex}
            accessibilityLabel="Apply custom color"
          >
            <Text style={styles.customHexButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
        {/* Upload background image button */}
        <TouchableOpacity
          style={styles.imageUploadButton}
          onPress={() => setShowBackgroundSheet(true)}
          accessibilityLabel="Upload background image"
          accessibilityRole="button"
        >
          <Text style={styles.imageUploadText}>
            {shell.backgroundType === 'image' ? '🖼️ Image selected — tap to change' : '🖼️ Upload background image'}
          </Text>
        </TouchableOpacity>
        {shell.backgroundValue ? (
          <View style={styles.selectedColorPreview}>
            {shell.backgroundType === 'color' ? (
              <>
                <View style={[styles.previewSwatch, { backgroundColor: shell.backgroundValue }]} />
                <Text style={styles.selectedColorText}>{shell.backgroundValue}</Text>
              </>
            ) : (
              <Text style={styles.selectedColorText}>
                Custom image background: {shell.backgroundValue.split('/').pop()}
              </Text>
            )}
          </View>
        ) : null}
        {getFieldError('backgroundValue') && (
          <Text style={styles.errorText}>{getFieldError('backgroundValue')}</Text>
        )}
      </View>

      {/* Category Picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryPills}>
          {SEED_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryPill,
                { borderColor: cat.colorHex },
                categoryId === cat.id && { backgroundColor: cat.colorHex },
              ]}
              onPress={() => onCategoryChange(cat.id)}
              accessibilityLabel={`Select ${cat.name} category`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.categoryPillText,
                  categoryId === cat.id && styles.categoryPillTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleNext}
        accessibilityLabel="Proceed to step 2"
        accessibilityRole="button"
      >
        <Text style={styles.nextButtonText}>Next →</Text>
      </TouchableOpacity>

      {/* Emoji Picker Modal */}
      <Modal visible={showEmojiPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose an Icon</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={EMOJI_OPTIONS}
              numColumns={6}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.emojiGrid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.emojiItem,
                    shell.iconValue === item && styles.emojiItemSelected,
                  ]}
                  onPress={() => selectEmoji(item)}
                  accessibilityLabel={`Select emoji ${item}`}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Background Customizer Sheet */}
      <BackgroundCustomizerSheet
        visible={showBackgroundSheet}
        currentBackgroundType={shell.backgroundType}
        currentBackgroundValue={shell.backgroundValue}
        imageOnly
        onApply={(bgType: BackgroundType, bgValue: string) => {
          updateShell({ backgroundType: bgType, backgroundValue: bgValue });
        }}
        onClose={() => setShowBackgroundSheet(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF4444',
    borderWidth: 2,
  },
  fieldMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
  },
  errorText: {
    fontSize: 12,
    color: '#FF4444',
    marginTop: 4,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#333333',
    borderWidth: 3,
  },
  customHexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  customHexInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  customHexButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  customHexButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  imageUploadButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  imageUploadText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  selectedColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  previewSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedColorText: {
    fontSize: 13,
    color: '#666666',
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryPillText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },
  categoryPillTextSelected: {
    color: '#FFFFFF',
  },
  nextButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalClose: {
    fontSize: 22,
    color: '#666666',
    padding: 4,
  },
  emojiGrid: {
    paddingBottom: 20,
  },
  emojiItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    margin: 4,
    borderRadius: 8,
  },
  emojiItemSelected: {
    backgroundColor: '#E8F4FD',
    borderWidth: 2,
    borderColor: '#4A90D9',
  },
  emojiText: {
    fontSize: 28,
  },
});
