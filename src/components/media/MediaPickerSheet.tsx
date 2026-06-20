/**
 * MediaPickerSheet — Bottom sheet presenting capture/upload options for
 * the Upload Media control. Filters options based on accepted media types.
 *
 * Validates: Requirements 2.3
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { MediaFileType } from '@/types/index';

interface MediaPickerSheetProps {
  acceptedTypes: MediaFileType[];
  onMediaSelected: (uri: string, fileType: MediaFileType) => void;
  onCancel: () => void;
}

export default function MediaPickerSheet({
  acceptedTypes,
  onMediaSelected,
  onCancel,
}: MediaPickerSheetProps) {
  const supportsImage = acceptedTypes.includes('image');
  const supportsVideo = acceptedTypes.includes('video');
  const supportsAudio = acceptedTypes.includes('audio');

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to select media.');
      return;
    }

    const mediaTypes: ('images' | 'videos')[] = [];
    if (supportsImage) mediaTypes.push('images');
    if (supportsVideo) mediaTypes.push('videos');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypes.length > 0 ? mediaTypes : ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const fileType: MediaFileType = asset.type === 'video' ? 'video' : 'image';
      onMediaSelected(asset.uri, fileType);
    }
  }, [supportsImage, supportsVideo, onMediaSelected]);

  const captureWithCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to capture media.');
      return;
    }

    const mediaTypes: ('images' | 'videos')[] = [];
    if (supportsImage) mediaTypes.push('images');
    if (supportsVideo) mediaTypes.push('videos');

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mediaTypes.length > 0 ? mediaTypes : ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const fileType: MediaFileType = asset.type === 'video' ? 'video' : 'image';
      onMediaSelected(asset.uri, fileType);
    }
  }, [supportsImage, supportsVideo, onMediaSelected]);

  const recordAudio = useCallback(() => {
    // TODO: Integrate expo-av Audio.Recording for audio capture
    Alert.alert(
      'Audio Recording',
      'Audio recording will be available with expo-av integration.'
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Media</Text>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelButton}
          accessibilityRole="button"
          accessibilityLabel="Cancel media selection"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.options}>
        {(supportsImage || supportsVideo) && (
          <TouchableOpacity
            style={styles.optionButton}
            onPress={pickFromLibrary}
            accessibilityRole="button"
            accessibilityLabel="Choose from library"
          >
            <Text style={styles.optionIcon}>📁</Text>
            <Text style={styles.optionText}>Choose from Library</Text>
          </TouchableOpacity>
        )}

        {(supportsImage || supportsVideo) && (
          <TouchableOpacity
            style={styles.optionButton}
            onPress={captureWithCamera}
            accessibilityRole="button"
            accessibilityLabel="Capture with camera"
          >
            <Text style={styles.optionIcon}>📷</Text>
            <Text style={styles.optionText}>Camera</Text>
          </TouchableOpacity>
        )}

        {supportsAudio && (
          <TouchableOpacity
            style={styles.optionButton}
            onPress={recordAudio}
            accessibilityRole="button"
            accessibilityLabel="Record audio"
          >
            <Text style={styles.optionIcon}>🎙️</Text>
            <Text style={styles.optionText}>Record Audio</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cancelButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  options: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
});
