/**
 * MediaConfigEditor — Creator-side configuration UI for media controls.
 * Allows selecting display/upload variant, setting label, choosing source.
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.12, 2.1
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type {
  ControlType,
  DisplayMediaConfig,
  MediaFileType,
  MediaSourceType,
  UploadMediaConfig,
} from '@/types/index';
import { classifyUrl, validateFile, getFileTypeFromExtension } from '@/services/mediaService';

type MediaVariant = 'display_media' | 'upload_media';

interface MediaConfigEditorProps {
  initialConfig?: DisplayMediaConfig | UploadMediaConfig;
  initialVariant?: MediaVariant;
  onConfigChange: (type: ControlType, config: DisplayMediaConfig | UploadMediaConfig) => void;
}

export default function MediaConfigEditor({
  initialConfig,
  initialVariant,
  onConfigChange,
}: MediaConfigEditorProps) {
  const [variant, setVariant] = useState<MediaVariant>(initialVariant || 'display_media');
  const [label, setLabel] = useState(
    initialConfig ? initialConfig.label : ''
  );

  // Display media state
  const [sourceMode, setSourceMode] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState(
    initialVariant === 'display_media' && initialConfig
      ? (initialConfig as DisplayMediaConfig).source
      : ''
  );
  const [localFilePath, setLocalFilePath] = useState(
    initialVariant === 'display_media' && initialConfig && (initialConfig as DisplayMediaConfig).mediaSourceType === 'local_file'
      ? (initialConfig as DisplayMediaConfig).source
      : ''
  );
  const [localFileName, setLocalFileName] = useState(
    initialVariant === 'display_media' && initialConfig && (initialConfig as DisplayMediaConfig).mediaSourceType === 'local_file' && (initialConfig as DisplayMediaConfig).source
      ? (initialConfig as DisplayMediaConfig).source.split('/').pop() || ''
      : ''
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<MediaFileType | null>(
    initialVariant === 'display_media' && initialConfig
      ? (initialConfig as DisplayMediaConfig).mediaFileType
      : null
  );

  // Upload media state
  const [acceptedTypes, setAcceptedTypes] = useState<MediaFileType[]>(
    initialVariant === 'upload_media' && initialConfig
      ? (initialConfig as UploadMediaConfig).acceptedTypes
      : ['image', 'video', 'audio']
  );

  const emitConfig = useCallback(
    (updatedVariant?: MediaVariant, updatedLabel?: string) => {
      const v = updatedVariant ?? variant;
      const l = updatedLabel ?? label;

      if (v === 'display_media') {
        const source = sourceMode === 'url' ? urlInput : localFilePath;
        let mediaSourceType: MediaSourceType = 'local_file';
        let platform = null;

        if (sourceMode === 'url' && urlInput) {
          const classification = classifyUrl(urlInput);
          mediaSourceType = classification.sourceType;
          platform = classification.platform;
        }

        const config: DisplayMediaConfig = {
          label: l,
          mediaSourceType,
          mediaFileType: fileType || 'image',
          source,
          platform,
          cachedPath: null,
        };
        onConfigChange('display_media', config);
      } else {
        const config: UploadMediaConfig = {
          label: l,
          acceptedTypes,
        };
        onConfigChange('upload_media', config);
      }
    },
    [variant, label, sourceMode, urlInput, localFilePath, fileType, acceptedTypes, onConfigChange]
  );

  const handleVariantChange = (newVariant: MediaVariant) => {
    setVariant(newVariant);
    // Emit immediately with the new type so the parent updates the control type
    if (newVariant === 'upload_media') {
      const config: UploadMediaConfig = { label, acceptedTypes };
      onConfigChange('upload_media', config);
    } else {
      const source = sourceMode === 'url' ? urlInput : localFilePath;
      let mediaSourceType: MediaSourceType = 'local_file';
      let platform = null;
      if (sourceMode === 'url' && urlInput) {
        const classification = classifyUrl(urlInput);
        mediaSourceType = classification.sourceType;
        platform = classification.platform;
      }
      const config: DisplayMediaConfig = {
        label,
        mediaSourceType,
        mediaFileType: fileType || 'image',
        source,
        platform,
        cachedPath: null,
      };
      onConfigChange('display_media', config);
    }
  };

  const handleLabelChange = (text: string) => {
    setLabel(text);
    emitConfig(undefined, text);
  };

  const handleUrlChange = (text: string) => {
    setUrlInput(text);
    setUrlError(null);

    if (text.trim().length > 0) {
      const classification = classifyUrl(text);
      if (!classification.isValid) {
        setUrlError(classification.error || 'Invalid URL');
      } else {
        setFileType(classification.fileType);
      }
    }
  };

  const handleUrlBlur = () => {
    emitConfig();
  };

  const handlePickFile = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Library access required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const detectedType: MediaFileType = asset.type === 'video' ? 'video' : 'image';
      const name = asset.uri.split('/').pop() || 'file';
      setLocalFilePath(asset.uri);
      setLocalFileName(name);
      setFileType(detectedType);
      // Emit updated config
      const config: DisplayMediaConfig = {
        label,
        mediaSourceType: 'local_file',
        mediaFileType: detectedType,
        source: asset.uri,
        platform: null,
        cachedPath: null,
      };
      onConfigChange('display_media', config);
    }
  };

  const toggleAcceptedType = (type: MediaFileType) => {
    setAcceptedTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      // Must have at least one type
      if (next.length === 0) return prev;
      // Emit config directly with the new value
      const config: UploadMediaConfig = { label, acceptedTypes: next };
      onConfigChange('upload_media', config);
      return next;
    });
  };

  const isUrlPlatform =
    sourceMode === 'url' && urlInput.trim().length > 0 && classifyUrl(urlInput).sourceType === 'platform_url';

  return (
    <View style={styles.container}>
      {/* Variant selector */}
      <Text style={styles.sectionLabel}>Media Type</Text>
      <View style={styles.variantRow}>
        <TouchableOpacity
          style={[styles.variantButton, variant === 'display_media' && styles.variantActive]}
          onPress={() => handleVariantChange('display_media')}
          accessibilityRole="button"
          accessibilityLabel="Display media variant"
        >
          <Text style={[styles.variantText, variant === 'display_media' && styles.variantTextActive]}>
            Display Media
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.variantButton, variant === 'upload_media' && styles.variantActive]}
          onPress={() => handleVariantChange('upload_media')}
          accessibilityRole="button"
          accessibilityLabel="Upload media variant"
        >
          <Text style={[styles.variantText, variant === 'upload_media' && styles.variantTextActive]}>
            Upload Media
          </Text>
        </TouchableOpacity>
      </View>

      {/* Label input */}
      <Text style={styles.sectionLabel}>Label</Text>
      <TextInput
        style={styles.textInput}
        value={label}
        onChangeText={handleLabelChange}
        placeholder={variant === 'display_media' ? 'e.g., Guided Meditation' : 'e.g., Record how you feel'}
        placeholderTextColor="#9CA3AF"
        accessibilityLabel="Media control label"
      />

      {/* Display media configuration */}
      {variant === 'display_media' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Source</Text>
          <View style={styles.variantRow}>
            <TouchableOpacity
              style={[styles.variantButton, sourceMode === 'file' && styles.variantActive]}
              onPress={() => setSourceMode('file')}
              accessibilityRole="button"
            >
              <Text style={[styles.variantText, sourceMode === 'file' && styles.variantTextActive]}>
                Upload File
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.variantButton, sourceMode === 'url' && styles.variantActive]}
              onPress={() => setSourceMode('url')}
              accessibilityRole="button"
            >
              <Text style={[styles.variantText, sourceMode === 'url' && styles.variantTextActive]}>
                URL
              </Text>
            </TouchableOpacity>
          </View>

          {sourceMode === 'file' && (
            <TouchableOpacity
              style={styles.filePickerButton}
              onPress={handlePickFile}
              accessibilityRole="button"
              accessibilityLabel="Pick media file"
            >
              <Text style={styles.filePickerText}>
                {localFilePath ? `✅ File selected: ${localFileName}` : '📁 Choose file'}
              </Text>
              <Text style={styles.filePickerHint}>
                Image (JPEG, PNG, GIF, WebP), Video (MP4, MOV), Audio (MP3, M4A, WAV)
              </Text>
            </TouchableOpacity>
          )}

          {sourceMode === 'url' && (
            <View>
              <TextInput
                style={[styles.textInput, urlError ? styles.textInputError : null]}
                value={urlInput}
                onChangeText={handleUrlChange}
                onBlur={handleUrlBlur}
                placeholder="https://..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Media URL input"
              />
              {urlError && <Text style={styles.errorText}>{urlError}</Text>}
              {isUrlPlatform && (
                <View style={styles.internetWarning}>
                  <Text style={styles.internetWarningText}>⚠️ Requires internet for playback</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Upload media configuration */}
      {variant === 'upload_media' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Accepted Types</Text>
          <View style={styles.checkboxRow}>
            {(['image', 'video', 'audio'] as MediaFileType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.checkbox,
                  acceptedTypes.includes(type) && styles.checkboxActive,
                ]}
                onPress={() => toggleAcceptedType(type)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTypes.includes(type) }}
                accessibilityLabel={`Accept ${type}`}
              >
                <Text
                  style={[
                    styles.checkboxText,
                    acceptedTypes.includes(type) && styles.checkboxTextActive,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  variantRow: {
    flexDirection: 'row',
    gap: 8,
  },
  variantButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  variantActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  variantText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  variantTextActive: {
    color: '#6366F1',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  textInputError: {
    borderColor: '#EF4444',
  },
  filePickerButton: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  filePickerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  filePickerHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  internetWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    padding: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
  },
  internetWarningText: {
    fontSize: 12,
    color: '#92400E',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 8,
  },
  checkbox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  checkboxText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  checkboxTextActive: {
    color: '#6366F1',
  },
});
