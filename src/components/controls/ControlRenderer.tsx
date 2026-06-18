/**
 * ControlRenderer — Iterates a list of controls and renders the appropriate
 * component for each control type.
 *
 * Props:
 * - controls: ordered list of Control objects
 * - values: Record<controlId, value string>
 * - onChange: (controlId, value) => void
 * - errors: Record<controlId, error message>
 * - readOnly: disable all inputs (optional)
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 6.1
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { Control } from '@/types/index';
import StaticTextControl from './StaticTextControl';
import TextInputControl from './TextInputControl';
import TextAreaControl from './TextAreaControl';
import MoodSliderControl from './MoodSliderControl';
import ChoiceButtonsControl from './ChoiceButtonsControl';
import CheckboxControl from './CheckboxControl';
import CounterControl from './CounterControl';
import DateTimeStampControl from './DateTimeStampControl';
import ImageAttachmentControl from './ImageAttachmentControl';
import LinkButtonControl from './LinkButtonControl';

interface ControlRendererProps {
  controls: Control[];
  values: Record<string, string>;
  onChange: (controlId: string, value: string) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
}

export default function ControlRenderer({
  controls,
  values,
  onChange,
  errors = {},
  readOnly = false,
}: ControlRendererProps) {
  const sortedControls = [...controls].sort((a, b) => a.position - b.position);

  return (
    <View style={styles.container}>
      {sortedControls.map((control) => {
        const value = values[control.id] ?? '';
        const error = errors[control.id];
        const handleChange = (newValue: string) => onChange(control.id, newValue);

        switch (control.type) {
          case 'static_text':
            return (
              <StaticTextControl
                key={control.id}
                control={control}
                readOnly={readOnly}
              />
            );

          case 'text_input':
            return (
              <TextInputControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'text_area':
            return (
              <TextAreaControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'mood_slider':
            return (
              <MoodSliderControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'choice_buttons':
            return (
              <ChoiceButtonsControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'checkbox':
            return (
              <CheckboxControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'counter':
            return (
              <CounterControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'datetime_stamp':
            return (
              <DateTimeStampControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'image_attachment':
            return (
              <ImageAttachmentControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          case 'link_button':
            return (
              <LinkButtonControl
                key={control.id}
                control={control}
                value={value}
                onChange={handleChange}
                error={error}
                readOnly={readOnly}
              />
            );

          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
});
