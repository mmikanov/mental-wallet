/**
 * BackgroundCustomizerSheet — Bottom sheet for changing card backgrounds.
 * Offers color picker (presets + hex) and image upload (photo library or camera).
 *
 * Used for both "My tool" cards (direct edit) and Library/Community cards (overlay).
 * AI image generation (Requirement 7) will be added as a third option later.
 *
 * Validates: Requirements 4.1–4.5, 5.2–5.9
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { BackgroundType } from '@/types/index';
import { CARD_BACKGROUND_COLORS, isLightBackground } from '@/utils/cardColors';

type BackgroundMode = 'color' | 'image';

interface BackgroundCustomizerSheetProps {
  visible: boolean;
  currentBackgroundType: BackgroundType;
  currentBackgroundValue: string;
  /** Whether the card is Library/Community (shows "Reset to original" option) */
  showResetOption?: boolean;
  /** When true, hides the color picker tab — only shows image upload */
  imageOnly?: boolean;
  onApply: (backgroundType: BackgroundType, backgroundValue: string) => void;
  onReset?: () => void;
  onClose: () => void;
}

const MIN_IMAGE_WIDTH = 750;
const MIN_IMAGE_HEIGHT = 500;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function BackgroundCustomizerSheet({
  visible,
  currentBackgroundType,
  currentBackgroundValue,
  showResetOption = false,
  imageOnly = false,
  onApply,
  onReset,
  onClose,
}: BackgroundCustomizerSheetProps) {
  const [mode, setMode] = useState<BackgroundMode>(
    imageOnly ? 'image' : (currentBackgroundType === 'image' ? 'image' : 'color')
  );
  const [selectedColor, setSelectedColor] = useState(
    currentBackgroundType === 'color' ? currentBackgroundValue : CARD_BACKGROUND_COLORS[0].hex
  );
  const [customHex, setCustomHex] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(
    currentBackgroundType === 'image' ? currentBackgroundValue : null
  );

  const handleColorSelect = useCallback((hex: string) => {
    setSelectedColor(hex);
    setMode('color');
  }, []);

  const handleCustomHexApply = useCallback(() => {
    const hex = customHex.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setSelectedColor(hex);
      setMode('color');
      setCustomHex('');
    } else {
      Alert.alert('Invalid color', 'Please enter a valid hex color (e.g., #FF5733)');
    }
  }, [customHex]);

  const handleImagePick = useCallback(async (source: 'library' | 'camera') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to capture photos.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required to select images.');
        return;
      }
    }

    const launchFn = source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launchFn({
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];

      // Validate file size
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
        Alert.alert('Image too large', 'Background images must be 10MB or less.');
        return;
      }

      // Validate resolution
      if (asset.width && asset.height) {
        if (asset.width < MIN_IMAGE_WIDTH || asset.height < MIN_IMAGE_HEIGHT) {
          Alert.alert(
            'Image too small',
            `Background images must be at least ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT} pixels. Your image is ${asset.width}×${asset.height}.`
          );
          return;
        }
      }

      setSelectedImageUri(asset.uri);
      setMode('image');
    }
  }, []);

  const handleApply = useCallback(() => {
    if (mode === 'color') {
      onApply('color', selectedColor);
    } else if (mode === 'image' && selectedImageUri) {
      onApply('image', selectedImageUri);
    }
    onClose();
  }, [mode, selectedColor, selectedImageUri, onApply, onClose]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset background',
      'This will restore the original background. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            onReset?.();
            onClose();
          },
        },
      ]
    );
  }, [onReset, onClose]);

  const canApply = mode === 'color' || (mode === 'image' && selectedImageUri);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Customize Background
          </Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Mode selector */}
            {!imageOnly && (
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'color' && styles.modeButtonActive]}
                onPress={() => setMode('color')}
                accessibilityRole="button"
                accessibilityLabel="Color background"
              >
                <Text style={[styles.modeText, mode === 'color' && styles.modeTextActive]}>
                  🎨 Color
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'image' && styles.modeButtonActive]}
                onPress={() => setMode('image')}
                accessibilityRole="button"
                accessibilityLabel="Image background"
              >
                <Text style={[styles.modeText, mode === 'image' && styles.modeTextActive]}>
                  🖼️ Image
                </Text>
              </TouchableOpacity>
            </View>
            )}

            {/* Color picker */}
            {mode === 'color' && (
              <View style={styles.section}>
                <View style={styles.colorGrid}>
                  {CARD_BACKGROUND_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.hex}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color.hex },
                        selectedColor === color.hex && styles.colorSwatchSelected,
                      ]}
                      onPress={() => handleColorSelect(color.hex)}
                      accessibilityLabel={`Select ${color.name}`}
                      accessibilityRole="button"
                    />
                  ))}
                </View>
                <View style={styles.customHexRow}>
                  <TextInput
                    style={styles.hexInput}
                    value={customHex}
                    onChangeText={setCustomHex}
                    placeholder="#AABBCC"
                    maxLength={7}
                    autoCapitalize="characters"
                    accessibilityLabel="Custom hex color"
                  />
                  <TouchableOpacity
                    style={styles.hexApplyButton}
                    onPress={handleCustomHexApply}
                    accessibilityRole="button"
                    accessibilityLabel="Apply custom color"
                  >
                    <Text style={styles.hexApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
                {/* Preview */}
                <View style={[styles.preview, { backgroundColor: selectedColor }]}>
                  <Text style={[styles.previewText, { color: isLightBackground(selectedColor) ? '#1C1C1E' : '#FFFFFF' }]}>Preview</Text>
                </View>
              </View>
            )}

            {/* Image picker */}
            {mode === 'image' && (
              <View style={styles.section}>
                <View style={styles.imageButtonRow}>
                  <TouchableOpacity
                    style={styles.imageSourceButton}
                    onPress={() => handleImagePick('library')}
                    accessibilityRole="button"
                    accessibilityLabel="Choose from photo library"
                  >
                    <Text style={styles.imageSourceIcon}>📁</Text>
                    <Text style={styles.imageSourceText}>Photo Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.imageSourceButton}
                    onPress={() => handleImagePick('camera')}
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo"
                  >
                    <Text style={styles.imageSourceIcon}>📷</Text>
                    <Text style={styles.imageSourceText}>Camera</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.imageHint}>
                  Min {MIN_IMAGE_WIDTH}×{MIN_IMAGE_HEIGHT}px, max 10MB
                </Text>
                {selectedImageUri && (
                  <Image
                    source={{ uri: selectedImageUri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                    accessibilityLabel="Selected background image preview"
                  />
                )}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {showResetOption && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                accessibilityRole="button"
                accessibilityLabel="Reset to original background"
              >
                <Text style={styles.resetText}>Reset to original</Text>
              </TouchableOpacity>
            )}
            <View style={styles.primaryActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, !canApply && styles.applyButtonDisabled]}
                onPress={handleApply}
                disabled={!canApply}
                accessibilityRole="button"
                accessibilityLabel="Apply background"
              >
                <Text style={styles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    maxHeight: '80%',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  content: {
    maxHeight: 400,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  modeButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  modeTextActive: {
    color: '#6366F1',
  },
  section: {
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#111827',
    borderWidth: 3,
  },
  customHexRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 44,
  },
  hexApplyButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  hexApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  preview: {
    height: 60,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 13,
    fontWeight: '500',
  },
  imageButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  imageSourceButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    minHeight: 44,
    justifyContent: 'center',
  },
  imageSourceIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  imageSourceText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  imageHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  actions: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  resetButton: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  applyText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
