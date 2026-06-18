/**
 * Step2Controls — Controls builder (Step 2 of card creation).
 *
 * Provides:
 * - Ordered list of added controls with reorder (up/down) and delete
 * - "Add block" button showing available control types (modal)
 * - Type-specific config UI for each control
 * - Max 10 controls enforced
 *
 * Validates: Requirements 7.5, 7.7, 6.1, 6.4, 6.8
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import type { Control, ControlType, ControlConfig } from '@/types/index';

interface Step2ControlsProps {
  controls: Control[];
  onControlsChange: (controls: Control[]) => void;
  onNext: () => void;
}

const MAX_CONTROLS = 10;

const CONTROL_TYPES: { type: ControlType; label: string; icon: string }[] = [
  { type: 'static_text', label: 'Static Text', icon: '📄' },
  { type: 'text_input', label: 'Text Input', icon: '✏️' },
  { type: 'text_area', label: 'Text Area', icon: '📝' },
  { type: 'mood_slider', label: 'Mood Slider', icon: '🎚️' },
  { type: 'choice_buttons', label: 'Choice Buttons', icon: '🔘' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
  { type: 'counter', label: 'Counter', icon: '🔢' },
  { type: 'datetime_stamp', label: 'Date/Time Stamp', icon: '📅' },
  { type: 'image_attachment', label: 'Image Attachment', icon: '📷' },
  { type: 'link_button', label: 'Link Button', icon: '🔗' },
];

function getDefaultConfig(type: ControlType): ControlConfig {
  switch (type) {
    case 'static_text':
      return { title: '', body: '', fontSize: 'medium' as const };
    case 'text_input':
      return { label: '', placeholder: '', maxLength: 200 };
    case 'text_area':
      return { label: '', placeholder: '' };
    case 'mood_slider':
      return { label: '', minLabel: '', maxLabel: '' };
    case 'choice_buttons':
      return { label: '', options: [{ text: '' }] };
    case 'checkbox':
      return { label: '' };
    case 'counter':
      return { label: '', min: 0, max: 100 };
    case 'datetime_stamp':
      return { displayMode: 'visible' as const };
    case 'image_attachment':
      return { label: '' };
    case 'link_button':
      return { label: '', targetUrl: '', fallbackUrl: '' };
  }
}

/**
 * Gets the user-facing display name for a control based on its config label/title.
 * Falls back to the type label if no name has been set.
 */
function getControlDisplayName(control: Control): string {
  const config = control.config as Record<string, unknown>;
  const label = config.label as string | undefined;
  const title = config.title as string | undefined;
  const body = config.body as string | undefined;

  if (label && label.trim()) return label;
  if (title && title.trim()) return title;
  if (control.type === 'static_text' && body && body.trim()) {
    return body.length > 30 ? body.substring(0, 30) + '...' : body;
  }
  return CONTROL_TYPES.find((t) => t.type === control.type)?.label ?? control.type;
}

/**
 * Validates link button URLs (https://, http://, or custom scheme with "://")
 */
function isValidLinkUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return true;
  const schemeIndex = trimmed.indexOf('://');
  return schemeIndex > 0;
}

export default function Step2Controls({
  controls,
  onControlsChange,
  onNext,
}: Step2ControlsProps) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function addControl(type: ControlType) {
    if (controls.length >= MAX_CONTROLS) {
      Alert.alert('Limit reached', 'Maximum of 10 controls allowed per card.');
      return;
    }
    const newControl: Control = {
      id: Crypto.randomUUID(),
      cardId: '',
      type,
      position: controls.length,
      config: getDefaultConfig(type),
      isRequired: false,
    };
    onControlsChange([...controls, newControl]);
    setShowTypePicker(false);
    setExpandedControlId(newControl.id);
  }

  function removeControl(id: string) {
    const updated = controls
      .filter((c) => c.id !== id)
      .map((c, i) => ({ ...c, position: i }));
    onControlsChange(updated);
    if (expandedControlId === id) setExpandedControlId(null);
  }

  function moveControl(id: string, direction: 'up' | 'down') {
    const index = controls.findIndex((c) => c.id === id);
    if (index < 0) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= controls.length) return;

    const updated = [...controls];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    // Reassign positions
    const reindexed = updated.map((c, i) => ({ ...c, position: i }));
    onControlsChange(reindexed);
  }

  function updateControlConfig(id: string, config: ControlConfig) {
    const updated = controls.map((c) =>
      c.id === id ? { ...c, config } : c
    );
    onControlsChange(updated);
  }

  function updateControlRequired(id: string, isRequired: boolean) {
    const updated = controls.map((c) =>
      c.id === id ? { ...c, isRequired } : c
    );
    onControlsChange(updated);
  }

  function handleNext() {
    if (controls.length === 0) {
      Alert.alert('No controls', 'Add at least one control before proceeding.');
      return;
    }
    // Validate link button URLs
    for (const control of controls) {
      if (control.type === 'link_button') {
        const config = control.config as { label: string; targetUrl: string };
        if (!isValidLinkUrl(config.targetUrl)) {
          Alert.alert(
            'Invalid URL',
            'Link button URLs must start with https://, http://, or a custom scheme containing "://".'
          );
          return;
        }
      }
    }
    onNext();
  }

  const typeLabel = (type: ControlType) =>
    CONTROL_TYPES.find((t) => t.type === type)?.label ?? type;
  const typeIcon = (type: ControlType) =>
    CONTROL_TYPES.find((t) => t.type === type)?.icon ?? '📦';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={120}
    >
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {controls.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧩</Text>
            <Text style={styles.emptyText}>No controls added yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add block" to start building your tool
            </Text>
          </View>
        ) : (
          controls.map((control, index) => (
            <View key={control.id} style={styles.controlRow}>
              {/* Control header */}
              <View style={styles.controlHeader}>
                <Text style={styles.controlIcon}>{typeIcon(control.type)}</Text>
                <TouchableOpacity
                  style={styles.controlLabelButton}
                  onPress={() =>
                    setExpandedControlId(
                      expandedControlId === control.id ? null : control.id
                    )
                  }
                  accessibilityLabel={`Configure ${getControlDisplayName(control)}`}
                >
                  <View style={styles.controlLabelContainer}>
                    <Text style={styles.controlLabel} numberOfLines={1}>
                      {getControlDisplayName(control)}
                    </Text>
                    <Text style={styles.controlTypeLabel}>
                      {typeLabel(control.type)}
                    </Text>
                  </View>
                  <Text style={styles.expandIndicator}>
                    {expandedControlId === control.id ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.controlActions}>
                  <TouchableOpacity
                    onPress={() => moveControl(control.id, 'up')}
                    disabled={index === 0}
                    style={[styles.actionBtn, index === 0 && styles.actionBtnDisabled]}
                    accessibilityLabel="Move up"
                  >
                    <Text style={styles.actionBtnText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveControl(control.id, 'down')}
                    disabled={index === controls.length - 1}
                    style={[
                      styles.actionBtn,
                      index === controls.length - 1 && styles.actionBtnDisabled,
                    ]}
                    accessibilityLabel="Move down"
                  >
                    <Text style={styles.actionBtnText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeControl(control.id)}
                    style={[styles.actionBtn, styles.deleteBtn]}
                    accessibilityLabel="Delete control"
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Expanded config */}
              {expandedControlId === control.id && (
                <View style={styles.configPanel}>
                  <ControlConfigEditor
                    control={control}
                    onConfigChange={(config) =>
                      updateControlConfig(control.id, config)
                    }
                    onRequiredChange={(val) =>
                      updateControlRequired(control.id, val)
                    }
                  />
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom actions — hidden when keyboard is visible */}
      {!isKeyboardVisible && (
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.addButton,
            controls.length >= MAX_CONTROLS && styles.addButtonDisabled,
          ]}
          onPress={() => setShowTypePicker(true)}
          disabled={controls.length >= MAX_CONTROLS}
          accessibilityLabel="Add block"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>
            + Add block ({controls.length}/{MAX_CONTROLS})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          accessibilityLabel="Proceed to preview"
          accessibilityRole="button"
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Type picker modal */}
      <Modal visible={showTypePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Control Type</Text>
              <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={CONTROL_TYPES}
              keyExtractor={(item) => item.type}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.typeOption}
                  onPress={() => addControl(item.type)}
                  accessibilityLabel={`Add ${item.label}`}
                >
                  <Text style={styles.typeOptionIcon}>{item.icon}</Text>
                  <Text style={styles.typeOptionLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// --- Control Config Editor ---

interface ControlConfigEditorProps {
  control: Control;
  onConfigChange: (config: ControlConfig) => void;
  onRequiredChange: (val: boolean) => void;
}

function ControlConfigEditor({
  control,
  onConfigChange,
  onRequiredChange,
}: ControlConfigEditorProps) {
  const { type, config, isRequired } = control;

  // Helper to show the "Required" toggle for user-input controls
  const showRequired = ![
    'static_text',
    'datetime_stamp',
    'link_button',
  ].includes(type);

  switch (type) {
    case 'static_text': {
      const c = config as { title?: string; body: string; fontSize: 'small' | 'medium' | 'large' };
      return (
        <View>
          <ConfigInput
            label="Title (optional)"
            value={c.title ?? ''}
            onChangeText={(t) => onConfigChange({ ...c, title: t })}
          />
          <ConfigInput
            label="Body"
            value={c.body}
            onChangeText={(t) => onConfigChange({ ...c, body: t })}
            multiline
          />
          <Text style={configStyles.label}>Font Size</Text>
          <View style={configStyles.pillRow}>
            {(['small', 'medium', 'large'] as const).map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  configStyles.pill,
                  c.fontSize === size && configStyles.pillActive,
                ]}
                onPress={() => onConfigChange({ ...c, fontSize: size })}
              >
                <Text
                  style={[
                    configStyles.pillText,
                    c.fontSize === size && configStyles.pillTextActive,
                  ]}
                >
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    case 'text_input': {
      const c = config as { label: string; placeholder?: string; maxLength: number };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <ConfigInput
            label="Placeholder"
            value={c.placeholder ?? ''}
            onChangeText={(t) => onConfigChange({ ...c, placeholder: t })}
          />
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'text_area': {
      const c = config as { label: string; placeholder?: string };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <ConfigInput
            label="Placeholder"
            value={c.placeholder ?? ''}
            onChangeText={(t) => onConfigChange({ ...c, placeholder: t })}
          />
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'mood_slider': {
      const c = config as { label: string; minLabel?: string; maxLabel?: string };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'choice_buttons': {
      const c = config as { label: string; options: { text: string; icon?: string }[] };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <Text style={configStyles.label}>Options (max 8)</Text>
          {c.options.map((opt, i) => (
            <View key={i} style={configStyles.optionRow}>
              <TextInput
                style={configStyles.optionInput}
                value={opt.text}
                onChangeText={(t) => {
                  const updated = [...c.options];
                  updated[i] = { ...updated[i], text: t };
                  onConfigChange({ ...c, options: updated });
                }}
                placeholder={`Option ${i + 1}`}
              />
              <TouchableOpacity
                onPress={() => {
                  const updated = c.options.filter((_, idx) => idx !== i);
                  onConfigChange({ ...c, options: updated });
                }}
                style={configStyles.removeOptionBtn}
              >
                <Text style={configStyles.removeOptionText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {c.options.length < 8 && (
            <TouchableOpacity
              style={configStyles.addOptionBtn}
              onPress={() =>
                onConfigChange({
                  ...c,
                  options: [...c.options, { text: '' }],
                })
              }
            >
              <Text style={configStyles.addOptionText}>+ Add option</Text>
            </TouchableOpacity>
          )}
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'checkbox': {
      const c = config as { label: string };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'counter': {
      const c = config as { label: string; min?: number; max?: number };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <View style={configStyles.rowInputs}>
            <View style={configStyles.halfInput}>
              <Text style={configStyles.label}>Min</Text>
              <TextInput
                style={configStyles.input}
                value={c.min !== undefined ? String(c.min) : ''}
                onChangeText={(t) => {
                  const num = parseInt(t, 10);
                  onConfigChange({ ...c, min: isNaN(num) ? undefined : num });
                }}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={configStyles.halfInput}>
              <Text style={configStyles.label}>Max</Text>
              <TextInput
                style={configStyles.input}
                value={c.max !== undefined ? String(c.max) : ''}
                onChangeText={(t) => {
                  const num = parseInt(t, 10);
                  onConfigChange({ ...c, max: isNaN(num) ? undefined : num });
                }}
                keyboardType="numeric"
                placeholder="100"
              />
            </View>
          </View>
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'datetime_stamp': {
      const c = config as { displayMode: 'visible' | 'hidden' };
      return (
        <View>
          <Text style={configStyles.label}>Display Mode</Text>
          <View style={configStyles.pillRow}>
            {(['visible', 'hidden'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  configStyles.pill,
                  c.displayMode === mode && configStyles.pillActive,
                ]}
                onPress={() => onConfigChange({ ...c, displayMode: mode })}
              >
                <Text
                  style={[
                    configStyles.pillText,
                    c.displayMode === mode && configStyles.pillTextActive,
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    case 'image_attachment': {
      const c = config as { label: string };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <RequiredToggle value={isRequired} onChange={onRequiredChange} />
        </View>
      );
    }

    case 'link_button': {
      const c = config as { label: string; targetUrl: string; fallbackUrl?: string };
      return (
        <View>
          <ConfigInput
            label="Label"
            value={c.label}
            onChangeText={(t) => onConfigChange({ ...c, label: t })}
          />
          <ConfigInput
            label="Target URL"
            value={c.targetUrl}
            onChangeText={(t) => onConfigChange({ ...c, targetUrl: t })}
            placeholder="https://example.com"
            keyboardType="url"
          />
          {c.targetUrl.length > 0 && !isValidLinkUrl(c.targetUrl) && (
            <Text style={configStyles.errorText}>
              URL must start with https://, http://, or a custom scheme with "://"
            </Text>
          )}
          <ConfigInput
            label="Fallback URL (optional)"
            value={c.fallbackUrl ?? ''}
            onChangeText={(t) => onConfigChange({ ...c, fallbackUrl: t })}
            placeholder="https://fallback.example.com"
            keyboardType="url"
          />
        </View>
      );
    }

    default:
      return null;
  }
}

// --- Reusable sub-components ---

function ConfigInput({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'url' | 'numeric';
}) {
  return (
    <View style={configStyles.fieldGroup}>
      <Text style={configStyles.label}>{label}</Text>
      <TextInput
        style={[configStyles.input, multiline && configStyles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function RequiredToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <View style={configStyles.toggleRow}>
      <Text style={configStyles.toggleLabel}>Required</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E0E0E0', true: '#4A90D9' }}
      />
    </View>
  );
}

// --- Styles ---

const configStyles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  pillActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  pillText: {
    fontSize: 13,
    color: '#333333',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333333',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  halfInput: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  removeOptionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeOptionText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  addOptionBtn: {
    marginTop: 4,
    marginBottom: 8,
  },
  addOptionText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
  },
  controlRow: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  controlIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  controlLabelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlLabelContainer: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  controlTypeLabel: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  expandIndicator: {
    fontSize: 12,
    color: '#999999',
  },
  controlActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },
  actionBtnText: {
    fontSize: 16,
    color: '#333333',
  },
  deleteBtn: {
    backgroundColor: '#FFE0E0',
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#FF4444',
    fontWeight: '600',
  },
  configPanel: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 10,
  },
  addButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    borderColor: '#CCCCCC',
    opacity: 0.5,
  },
  addButtonText: {
    color: '#4A90D9',
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  typeOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  typeOptionLabel: {
    fontSize: 16,
    color: '#333333',
  },
});
