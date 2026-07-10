/**
 * ExportService — Handles data export (JSON/CSV), full data deletion,
 * and admin card export to CuratedCardDefinition TypeScript format.
 *
 * Validates: Requirements 16.2, 16.3, 6.1, 6.2, 6.3, 6.4, 6.5, 8.2, 8.3
 */

import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../data/database';
import { seedData } from '../data/seeds';
import { getTagsForCard, getContextTags, getTimeTags } from './emotionTagService';
import { CURATED_LIBRARY } from '../data/curatedLibrary';
import type { Card, ControlConfig, ValidationResult } from '../types/index';
import type { ExportService } from '../types/services';
import type { LearnMoreLink } from '../types/rationale';

interface RationaleRow {
  rationale_approach: string | null;
  rationale_in_a_nutshell: string | null;
  rationale_how_it_works: string | null;
  rationale_evidence_level: string | null;
  rationale_research_summary: string | null;
  rationale_learn_more_links: string | null;
}

interface ExportCard {
  id: string;
  title: string;
  description: string;
  category_id: string;
  origin_badge: string;
  total_uses: number;
  current_streak: number;
  last_used_at: string | null;
  created_at: string;
}

interface ExportCompletion {
  id: string;
  card_id: string;
  completed_at: string;
}

interface ExportControlValue {
  id: string;
  completion_id: string;
  control_id: string;
  control_type: string;
  value: string | null;
}

/**
 * Serialize a ControlConfig to a formatted TypeScript literal string.
 */
function serializeConfig(config: ControlConfig, indent: string): string {
  const lines: string[] = ['{'];
  const entries = Object.entries(config);
  for (const [key, value] of entries) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      // Handle arrays (e.g., options in ChoiceButtonsConfig, acceptedTypes)
      const arrayItems = value.map((item) => {
        if (typeof item === 'object' && item !== null) {
          const objEntries = Object.entries(item)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join(', ');
          return `${indent}      { ${objEntries} }`;
        }
        return `${indent}      ${JSON.stringify(item)}`;
      });
      lines.push(`${indent}    ${key}: [`);
      lines.push(arrayItems.join(',\n'));
      lines.push(`${indent}    ],`);
    } else {
      lines.push(`${indent}    ${key}: ${JSON.stringify(value)},`);
    }
  }
  lines.push(`${indent}  }`);
  return lines.join('\n');
}

/**
 * Validate that a card has all required rationale fields populated for export.
 * Returns a ValidationResult with field-specific errors if any required fields
 * are missing or empty.
 *
 * Validates: Requirements 8.3
 */
export function validateExportReadiness(card: {
  id: string;
  title: string;
  rationale_approach?: string | null;
  rationale_in_a_nutshell?: string | null;
  rationale_how_it_works?: string | null;
  rationale_evidence_level?: string | null;
  rationale_research_summary?: string | null;
}): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (!card.rationale_approach || card.rationale_approach.trim().length === 0) {
    errors.push({
      field: 'rationale_approach',
      message: `Card "${card.title}" is missing the rationale approach field`,
    });
  }

  if (!card.rationale_in_a_nutshell || card.rationale_in_a_nutshell.trim().length === 0) {
    errors.push({
      field: 'rationale_in_a_nutshell',
      message: `Card "${card.title}" is missing the rationale in_a_nutshell field`,
    });
  }

  if (!card.rationale_how_it_works || card.rationale_how_it_works.trim().length === 0) {
    errors.push({
      field: 'rationale_how_it_works',
      message: `Card "${card.title}" is missing the rationale how_it_works field`,
    });
  }

  if (!card.rationale_evidence_level || card.rationale_evidence_level.trim().length === 0) {
    errors.push({
      field: 'rationale_evidence_level',
      message: `Card "${card.title}" is missing the rationale evidence_level field`,
    });
  }

  if (!card.rationale_research_summary || card.rationale_research_summary.trim().length === 0) {
    errors.push({
      field: 'rationale_research_summary',
      message: `Card "${card.title}" is missing the rationale research_summary field`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Serialize a Card (from DB) to a CuratedCardDefinition TypeScript literal string.
 * Includes all controls and tag arrays (emotionTags, contextTags, timeTags).
 * Also reads and serializes rationale metadata from DB columns.
 *
 * Validates: Requirements 6.2, 6.5, 8.2, 8.3
 */
export async function serializeToCuratedDefinition(card: Card): Promise<string> {
  // Fetch tags from the database
  const emotionTagRows = await getTagsForCard(card.id);
  const emotionTags = emotionTagRows.map((t) => t.emotion);
  const contextTags = await getContextTags(card.id);
  const timeTags = await getTimeTags(card.id);

  // Fetch rationale columns from the database
  const db = await getDatabase();
  const rationaleRow = await db.getFirstAsync<RationaleRow>(
    `SELECT rationale_approach, rationale_in_a_nutshell, rationale_how_it_works,
            rationale_evidence_level, rationale_research_summary, rationale_learn_more_links
     FROM cards WHERE id = ?`,
    [card.id]
  );

  // If DB rationale is empty, fall back to static CURATED_LIBRARY definition
  let effectiveRationale = rationaleRow;
  if (!rationaleRow?.rationale_approach) {
    const staticCard = CURATED_LIBRARY.find((c) => c.id === card.id || c.id === card.sourceLibraryId);
    if (staticCard?.rationale) {
      effectiveRationale = {
        rationale_approach: staticCard.rationale.approach,
        rationale_in_a_nutshell: staticCard.rationale.inANutshell,
        rationale_how_it_works: staticCard.rationale.howItWorks,
        rationale_evidence_level: staticCard.rationale.evidenceLevel,
        rationale_research_summary: JSON.stringify(staticCard.rationale.researchSummary),
        rationale_learn_more_links: staticCard.rationale.learnMoreLinks
          ? JSON.stringify(staticCard.rationale.learnMoreLinks)
          : null,
      };
    }
  }

  // Validate export readiness — block export if rationale is incomplete
  const validationInput = {
    id: card.id,
    title: card.title,
    rationale_approach: effectiveRationale?.rationale_approach ?? null,
    rationale_in_a_nutshell: effectiveRationale?.rationale_in_a_nutshell ?? null,
    rationale_how_it_works: effectiveRationale?.rationale_how_it_works ?? null,
    rationale_evidence_level: effectiveRationale?.rationale_evidence_level ?? null,
    rationale_research_summary: effectiveRationale?.rationale_research_summary ?? null,
  };

  const validation = validateExportReadiness(validationInput);
  if (!validation.isValid) {
    const errorMessages = validation.errors.map((e) => e.message).join('; ');
    throw new Error(`Export blocked — incomplete rationale: ${errorMessages}`);
  }

  const lines: string[] = [];
  lines.push('{');
  lines.push(`  id: ${JSON.stringify(card.id)},`);
  lines.push(`  title: ${JSON.stringify(card.title)},`);
  lines.push(`  description: ${JSON.stringify(card.description)},`);
  lines.push(`  iconType: ${JSON.stringify(card.iconType)},`);
  lines.push(`  iconValue: ${JSON.stringify(card.iconValue)},`);
  lines.push(`  backgroundType: ${JSON.stringify(card.backgroundType)},`);
  lines.push(`  backgroundValue: ${JSON.stringify(card.backgroundValue)},`);
  lines.push(`  categoryId: ${JSON.stringify(card.categoryId)},`);
  lines.push(`  allowBackgroundCustomization: ${card.allowBackgroundCustomization},`);

  // Controls array
  lines.push('  controls: [');
  for (const control of card.controls) {
    lines.push('    {');
    lines.push(`      type: ${JSON.stringify(control.type)},`);
    lines.push(`      position: ${control.position},`);
    lines.push(`      config: ${serializeConfig(control.config, '    ')},`);
    lines.push(`      isRequired: ${control.isRequired},`);
    lines.push('    },');
  }
  lines.push('  ],');

  // Optional tag arrays — only include if non-empty
  if (emotionTags.length > 0) {
    lines.push(`  emotionTags: [${emotionTags.map((t) => JSON.stringify(t)).join(', ')}],`);
  }
  if (contextTags.length > 0) {
    lines.push(`  contextTags: [${contextTags.map((t) => JSON.stringify(t)).join(', ')}],`);
  }
  if (timeTags.length > 0) {
    lines.push(`  timeTags: [${timeTags.map((t) => JSON.stringify(t)).join(', ')}],`);
  }

  // Rationale block
  const approach = effectiveRationale!.rationale_approach!;
  const inANutshell = effectiveRationale!.rationale_in_a_nutshell!;
  const howItWorks = effectiveRationale!.rationale_how_it_works!;
  const evidenceLevel = effectiveRationale!.rationale_evidence_level!;
  const researchSummary: string[] = JSON.parse(effectiveRationale!.rationale_research_summary!);
  const learnMoreLinksRaw = effectiveRationale!.rationale_learn_more_links;
  const learnMoreLinks: LearnMoreLink[] | null = learnMoreLinksRaw
    ? JSON.parse(learnMoreLinksRaw)
    : null;

  lines.push('  rationale: {');
  lines.push(`    approach: ${JSON.stringify(approach)},`);
  lines.push(`    inANutshell: ${JSON.stringify(inANutshell)},`);
  lines.push(`    howItWorks: ${JSON.stringify(howItWorks)},`);
  lines.push(`    evidenceLevel: ${JSON.stringify(evidenceLevel)},`);
  lines.push(`    researchSummary: [`);
  for (const item of researchSummary) {
    lines.push(`      ${JSON.stringify(item)},`);
  }
  lines.push('    ],');

  // Only include learnMoreLinks if non-null and non-empty
  if (learnMoreLinks && learnMoreLinks.length > 0) {
    lines.push('    learnMoreLinks: [');
    for (const link of learnMoreLinks) {
      lines.push(`      { title: ${JSON.stringify(link.title)}, url: ${JSON.stringify(link.url)} },`);
    }
    lines.push('    ],');
  }

  lines.push('  },');

  lines.push('}');

  return lines.join('\n');
}

/**
 * Copy a serialized CuratedCardDefinition to the device clipboard.
 * Throws an error with a user-friendly message on clipboard failure.
 *
 * Validates: Requirements 6.3, 6.4
 */
export async function exportToClipboard(card: Card): Promise<void> {
  const serialized = await serializeToCuratedDefinition(card);
  try {
    await Clipboard.setStringAsync(serialized);
  } catch {
    throw new Error('Failed to copy to clipboard.');
  }
}

/**
 * Creates an instance of the ExportService.
 */
export function createExportService(): ExportService {
  async function exportData(format: 'json' | 'csv'): Promise<string> {
    const db = await getDatabase();

    const cards = await db.getAllAsync<ExportCard>(
      `SELECT id, title, description, category_id, origin_badge, total_uses, current_streak, last_used_at, created_at FROM cards`
    );

    const completions = await db.getAllAsync<ExportCompletion>(
      `SELECT id, card_id, completed_at FROM completions`
    );

    const controlValues = await db.getAllAsync<ExportControlValue>(
      `SELECT id, completion_id, control_id, control_type, value FROM control_values`
    );

    let fileContent: string;
    let fileName: string;

    if (format === 'json') {
      fileContent = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          cards,
          completions,
          moodLogs: controlValues.filter((cv) => cv.control_type === 'mood_slider'),
        },
        null,
        2
      );
      fileName = `mental-wallet-export-${Date.now()}.json`;
    } else {
      fileContent = formatAsCsv(cards, completions, controlValues);
      fileName = `mental-wallet-export-${Date.now()}.csv`;
    }

    const filePath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, fileContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: format === 'json' ? 'application/json' : 'text/csv',
        dialogTitle: 'Export Mental Health Wallet Data',
      });
    }

    return filePath;
  }

  async function deleteAllData(): Promise<void> {
    const db = await getDatabase();

    await db.execAsync('BEGIN TRANSACTION');
    try {
      // Delete all user data from tables
      await db.execAsync('DELETE FROM control_values');
      await db.execAsync('DELETE FROM completions');
      await db.execAsync('DELETE FROM controls');
      await db.execAsync('DELETE FROM reminders');
      await db.execAsync('DELETE FROM cards');
      await db.execAsync('DELETE FROM settings');
      await db.execAsync('DELETE FROM crisis_resources');
      await db.execAsync('DELETE FROM categories');

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }

    // Re-seed categories and crisis resources
    await seedData(db);
  }

  return {
    exportData,
    deleteAllData,
  };
}

function formatAsCsv(
  cards: ExportCard[],
  completions: ExportCompletion[],
  controlValues: ExportControlValue[]
): string {
  const lines: string[] = [];

  // Cards section
  lines.push('--- CARDS ---');
  lines.push('id,title,description,category_id,origin_badge,total_uses,current_streak,last_used_at,created_at');
  for (const card of cards) {
    lines.push(
      [
        csvEscape(card.id),
        csvEscape(card.title),
        csvEscape(card.description),
        csvEscape(card.category_id),
        csvEscape(card.origin_badge),
        String(card.total_uses),
        String(card.current_streak),
        csvEscape(card.last_used_at ?? ''),
        csvEscape(card.created_at),
      ].join(',')
    );
  }

  lines.push('');

  // Completions section
  lines.push('--- COMPLETIONS ---');
  lines.push('id,card_id,completed_at');
  for (const completion of completions) {
    lines.push(
      [
        csvEscape(completion.id),
        csvEscape(completion.card_id),
        csvEscape(completion.completed_at),
      ].join(',')
    );
  }

  lines.push('');

  // Mood logs section
  lines.push('--- MOOD LOGS ---');
  lines.push('id,completion_id,control_id,control_type,value');
  const moodLogs = controlValues.filter((cv) => cv.control_type === 'mood_slider');
  for (const log of moodLogs) {
    lines.push(
      [
        csvEscape(log.id),
        csvEscape(log.completion_id),
        csvEscape(log.control_id),
        csvEscape(log.control_type),
        csvEscape(log.value ?? ''),
      ].join(',')
    );
  }

  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
