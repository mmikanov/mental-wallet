/**
 * UploadMediaControl — User-facing media upload field for completions.
 * Supports image, video, and audio capture/upload based on creator config.
 *
 * Validates: Requirements 2.1–2.8
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Control, MediaFileType, UploadMediaConfig } from '@/types/index';
import { validateFile, getMaxFileSize } from '@/services/mediaService';

interface UploadMediaControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function UploadMediaControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: UploadMediaControlProps) {
  const config = control.config as UploadMediaConfig;
  const [selectedType, setSelectedType] = useState<MediaFileType | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const supportsImage = config.acceptedTypes.includes('image');
  const supportsVideo = config.acceptedTypes.includes('video');
  const supportsAudio = config.acceptedTypes.includes('audio');

  const handlePickMedia = useCallback(
    async (source: 'library' | 'camera') => {
      if (readOnly) return;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to capture media.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required to select media.');
          return;
        }
      }

      const mediaTypes: ('images' | 'videos')[] = [];
      if (supportsImage) mediaTypes.push('images');
      if (supportsVideo) mediaTypes.push('videos');

      const launchFn =
        source === 'camera'
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;

      const result = await launchFn({
        mediaTypes: mediaTypes.length > 0 ? mediaTypes : ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const fileType: MediaFileType = asset.type === 'video' ? 'video' : 'image';

        // Validate file size
        const maxSize = getMaxFileSize(fileType);
        if (asset.fileSize && asset.fileSize > maxSize) {
          const maxMB = Math.round(maxSize / (1024 * 1024));
          Alert.alert('File too large', `Maximum ${fileType} size is ${maxMB}MB.`);
          return;
        }

        setSelectedType(fileType);
        onChange(asset.uri);
      }
    },
    [readOnly, supportsImage, supportsVideo, onChange]
  );

  const handleRecordAudio = useCallback(() => {
    // TODO: Integrate expo-av Audio.Recording
    Alert.alert('Audio Recording', 'Audio recording requires expo-av integration.');
  }, []);

  const showPickerOptions = useCallback(() => {
    if (readOnly) return;

    const options: { text: string; onPress: () => void }[] = [];

    if (supportsImage || supportsVideo) {
      options.push({ text: 'Photo Library', onPress: () => handlePickMedia('library') });
      options.push({ text: 'Camera', onPress: () => handlePickMedia('camera') });
    }
    if (supportsAudio) {
      options.push({ text: 'Record Audio', onPress: handleRecordAudio });
    }
    options.push({ text: 'Cancel', onPress: () => {} });

    Alert.alert('Add Media', 'Choose media source', options);
  }, [readOnly, supportsImage, supportsVideo, supportsAudio, handlePickMedia, handleRecordAudio]);

  const handleRemove = useCallback(() => {
    if (!readOnly) {
      onChange('');
      setSelectedType(null);
    }
  }, [readOnly, onChange]);

  const getAcceptedTypesLabel = (): string => {
    return config.acceptedTypes.join(', ');
  };

  const getMaxSizeLabel = (): string => {
    const sizes = config.acceptedTypes.map((t) => {
      const mb = Math.round(getMaxFileSize(t) / (1024 * 1024));
      return `${t}: ${mb}MB`;
    });
    return sizes.join(', ');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.label}
        {control.isRequired && <Text style={styles.required}> *</Text>}
      </Text>

      {value ? (
        <View style={styles.previewContainer}>
          {selectedType === 'image' || (!selectedType && value) ? (
            <Image source={{ uri: value }} style={styles.imagePreview} />
          ) : (
            <View style={styles.filePreview}>
              <Text style={styles.fileIcon}>
                {selectedType === 'video' ? '🎬' : '🎵'}
              </Text>
              <Text style={styles.fileName}>
                {selectedType === 'video' ? 'Video selected' : 'Audio selected'}
              </Text>
            </View>
          )}
          {!readOnly && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove media"
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, error ? styles.uploadButtonError : null]}
          onPress={showPickerOptions}
          disabled={readOnly}
          accessibilityRole="button"
          accessibilityLabel={`Upload media for ${config.label}`}
        >
          <Text style={styles.uploadIcon}>
            {supportsAudio ? '🎵' : supportsVideo ? '🎬' : '📷'}
          </Text>
          <Text style={styles.uploadText}>Tap to add media</Text>
          <Text style={styles.uploadHint}>
            Accepts: {getAcceptedTypesLabel()}
          </Text>
          <Text style={styles.uploadHint}>Max: {getMaxSizeLabel()}</Text>
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
    marginTop: 2,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  filePreview: {
    height: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileName: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
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
