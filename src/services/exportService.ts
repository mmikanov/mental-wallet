/**
 * ExportService — Handles data export (JSON/CSV) and full data deletion.
 *
 * Validates: Requirements 16.2, 16.3
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../data/database';
import { seedData } from '../data/seeds';
import type { ExportService } from '../types/services';

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
