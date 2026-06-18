/**
 * StaticTextControl — Renders a static text block with optional title and rich-text body.
 *
 * Supports basic inline formatting:
 * - **bold** → bold text
 * - _italic_ or *italic* → italic text
 * - Lines starting with "- " → bullet list items
 * - Lines starting with "1. " etc → numbered list items
 *
 * Font size: small (13), medium (15, default), large (18).
 * This is a display-only control — no user input, no onChange.
 *
 * Validates: Requirements 6.1, 6.2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Control, StaticTextConfig } from '@/types/index';

interface StaticTextControlProps {
  control: Control;
  readOnly?: boolean;
}

const FONT_SIZES: Record<string, number> = {
  small: 13,
  medium: 15,
  large: 18,
};

/**
 * Parse simple rich-text body into styled segments.
 * Splits by lines and applies inline formatting.
 */
function renderBody(body: string, fontSize: number) {
  const lines = body.split('\n');

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // Bullet list
    if (trimmed.startsWith('- ')) {
      return (
        <View key={lineIdx} style={styles.listItem}>
          <Text style={[styles.bullet, { fontSize }]}>•</Text>
          <Text style={[styles.bodyText, { fontSize }]}>
            {renderInlineFormatting(trimmed.slice(2))}
          </Text>
        </View>
      );
    }

    // Numbered list (e.g., "1. ", "2. ")
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      return (
        <View key={lineIdx} style={styles.listItem}>
          <Text style={[styles.bullet, { fontSize }]}>{numberedMatch[1]}.</Text>
          <Text style={[styles.bodyText, { fontSize }]}>
            {renderInlineFormatting(numberedMatch[2])}
          </Text>
        </View>
      );
    }

    // Regular paragraph
    if (trimmed.length === 0) {
      return <View key={lineIdx} style={styles.spacer} />;
    }

    return (
      <Text key={lineIdx} style={[styles.bodyText, { fontSize }]}>
        {renderInlineFormatting(trimmed)}
      </Text>
    );
  });
}

/**
 * Render inline bold (**text**) and italic (_text_ or *text*) via simple regex.
 */
function renderInlineFormatting(text: string): React.ReactNode[] {
  // Split on bold/italic markers
  const parts: React.ReactNode[] = [];
  // Pattern: **bold**, *italic*, _italic_
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <Text key={`b-${match.index}`} style={styles.bold}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <Text key={`i-${match.index}`} style={styles.italic}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      // _italic_
      parts.push(
        <Text key={`i2-${match.index}`} style={styles.italic}>
          {match[4]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function StaticTextControl({ control }: StaticTextControlProps) {
  const config = control.config as StaticTextConfig;
  const fontSize = FONT_SIZES[config.fontSize] ?? FONT_SIZES.medium;

  return (
    <View style={styles.container} accessibilityRole="text">
      {config.title ? (
        <Text style={[styles.title, { fontSize: fontSize + 2 }]}>
          {config.title}
        </Text>
      ) : null}
      <View>{renderBody(config.body, fontSize)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  title: {
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  bodyText: {
    color: '#374151',
    lineHeight: 22,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: {
    width: 20,
    color: '#374151',
  },
  spacer: {
    height: 8,
  },
});
