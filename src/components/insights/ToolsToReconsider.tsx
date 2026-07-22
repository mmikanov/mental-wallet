/**
 * ToolsToReconsider — Gently surfaces tools classified as "not_helping"
 * with sufficient usage data (>= 8 uses, >= 5 outcome responses).
 *
 * Shows up to 3 tools with:
 * - Tool name (bold)
 * - Plain-language observation
 * - "Archive" button (triggers existing archive flow)
 * - "Keep" button (dismisses for current period)
 *
 * Renders null if no tools qualify (section hidden entirely).
 * Only shown at Confident tier (gating handled by parent).
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { InsightTooltip } from './InsightTooltip';
import type { ToolCorrelationResult } from '@/services/correlationEngine';

// --- Props ---

export interface ToolsToReconsiderProps {
  tools: ToolCorrelationResult[];
  onArchive?: (cardId: string) => void;
  onKeep?: (cardId: string) => void;
}

// --- Constants ---

const SECTION_TOOLTIP =
  "These tools haven't been helping based on your check-ins and how you feel after using them. You might want to archive them and try something else.";

// --- Helpers ---

function getObservation(toolTitle: string): string {
  return `When you use ${toolTitle}, you usually don't feel much different afterward`;
}

function getEntryAccessibilityLabel(
  toolTitle: string,
  observation: string,
  isArchived?: boolean
): string {
  const archivedPrefix = isArchived ? 'Archived. ' : '';
  return `${archivedPrefix}${toolTitle}. ${observation}. Actions available: Archive or Keep.`;
}

// --- Component ---

export function ToolsToReconsider({ tools, onArchive, onKeep }: ToolsToReconsiderProps) {
  // Hide entirely if no tools qualify (Req 13.6)
  if (tools.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="tools-to-reconsider">
      {/* Section header with tooltip */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Tools to reconsider
        </Text>
        <InsightTooltip explanation={SECTION_TOOLTIP} />
      </View>

      {/* Tool entries */}
      {tools.map((tool) => {
        const observation = getObservation(tool.cardTitle);
        const accessibilityLabel = getEntryAccessibilityLabel(
          tool.cardTitle,
          observation,
          tool.isArchived
        );

        return (
          <View
            key={tool.cardId}
            style={styles.toolEntry}
            accessibilityLabel={accessibilityLabel}
            testID={`reconsider-tool-${tool.cardId}`}
          >
            <View style={styles.toolContent}>
              <View style={styles.toolTitleRow}>
                <Text style={styles.toolTitle}>{tool.cardTitle}</Text>
                {tool.isArchived && (
                  <View style={styles.archivedBadge} testID={`reconsider-archived-badge-${tool.cardId}`}>
                    <Text style={styles.archivedBadgeText}>Archived</Text>
                  </View>
                )}
              </View>
              <Text style={styles.observation}>{observation}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.archiveButton}
                onPress={() => onArchive?.(tool.cardId)}
                accessibilityRole="button"
                accessibilityLabel={`Archive ${tool.cardTitle}`}
                testID={`reconsider-archive-${tool.cardId}`}
              >
                <Text style={styles.archiveButtonText}>Archive</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => onKeep?.(tool.cardId)}
                accessibilityRole="button"
                accessibilityLabel={`Keep ${tool.cardTitle}`}
                testID={`reconsider-keep-${tool.cardId}`}
              >
                <Text style={styles.keepButtonText}>Keep</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  toolEntry: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 10,
  },
  toolContent: {
    marginBottom: 12,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  archivedBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  archivedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  observation: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  archiveButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  keepButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keepButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
});
