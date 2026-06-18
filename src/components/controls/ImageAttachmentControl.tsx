/**
 * ImageAttachmentControl — Upload image from photo library or camera (max 20MB, JPEG/PNG).
 *
 * Uses expo-image-picker. Shows a thumbnail preview after selection.
 * Stores the local file URI as the value.
 *
 * Validates: Requirements 6.1
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Control, ImageAttachmentConfig } from '@/types/index';

interface ImageAttachmentControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export default function ImageAttachmentControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: ImageAttachmentControlProps) {
  const config = control.config as ImageAttachmentConfig;

  const pickImage = useCallback(
    async (source: 'library' | 'camera') => {
      if (readOnly) return;

      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission needed',
            'Camera access is required to take photos.'
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission needed',
            'Photo library access is required to select images.'
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];

        // Check file size if available
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
          Alert.alert(
            'File too large',
            'Please select an image under 20MB (JPEG or PNG).'
          );
          return;
        }

        onChange(asset.uri);
      }
    },
    [readOnly, onChange]
  );

  const showPicker = useCallback(() => {
    Alert.alert('Add Image', 'Choose image source', [
      { text: 'Photo Library', onPress: () => pickImage('library') },
      { text: 'Camera', onPress: () => pickImage('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage]);

  const handleRemove = useCallback(() => {
    if (!readOnly) {
      onChange('');
    }
  }, [readOnly, onChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.label}
        {control.isRequired && <Text style={styles.required}> *</Text>}
      </Text>

      {value ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: value }} style={styles.preview} />
          {!readOnly && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove image"
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, error ? styles.uploadButtonError : null]}
          onPress={showPicker}
          disabled={readOnly}
          accessibilityRole="button"
          accessibilityLabel={`Upload image for ${config.label}`}
        >
          <Text style={styles.uploadIcon}>📷</Text>
          <Text style={styles.uploadText}>Tap to add image</Text>
          <Text style={styles.uploadHint}>JPEG or PNG, max 20MB</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  uploadButtonError: {
    borderColor: '#EF4444',
  },
  uploadIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  uploadHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});
