/**
 * Unit tests for ExportService — data export (JSON/CSV), deletion logic,
 * and rationale validation/serialization.
 *
 * Validates: Requirements 16.2, 16.3, 8.2, 8.3
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  cacheDirectory: '/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined as never),
  EncodingType: { UTF8: 'utf8' },
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true as never),
  shareAsync: jest.fn().mockResolvedValue(undefined as never),
}));

// Mock database
const mockGetAllAsync = jest.fn();
const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
    execAsync: (...args: unknown[]) => mockExecAsync(...args),
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  } as never),
}));

// Mock seeds
jest.mock('../../data/seeds', () => ({
  seedData: jest.fn().mockResolvedValue(undefined as never),
}));

import { createExportService } from '../exportService';
import { validateExportReadiness } from '../exportService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

describe('ExportService', () => {
  const service = createExportService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue(undefined);
    mockGetFirstAsync.mockResolvedValue(null);
  });

  describe('exportData', () => {
    const mockCards = [
      {
        id: 'card-1',
        title: 'Breathing Exercise',
        description: 'A calming tool',
        category_id: 'grounding-calming',
        origin_badge: 'library',
        total_uses: 5,
        current_streak: 2,
        last_used_at: '2024-01-15T10:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockCompletions = [
      { id: 'comp-1', card_id: 'card-1', completed_at: '2024-01-15T10:00:00Z' },
    ];

    const mockControlValues = [
      {
        id: 'cv-1',
        completion_id: 'comp-1',
        control_id: 'ctrl-1',
        control_type: 'mood_slider',
        value: '7',
      },
    ];

    beforeEach(() => {
      mockGetAllAsync
        .mockResolvedValueOnce(mockCards)
        .mockResolvedValueOnce(mockCompletions)
        .mockResolvedValueOnce(mockControlValues);
    });

    it('should export data as JSON with cards, completions, and mood logs', async () => {
      const result = await service.exportData('json');

      expect(result).toMatch(/^\/cache\/mental-wallet-export-\d+\.json$/);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"cards"'),
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('should export data as CSV with separate sections', async () => {
      const result = await service.exportData('csv');

      expect(result).toMatch(/^\/cache\/mental-wallet-export-\d+\.csv$/);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('.csv'),
        expect.stringContaining('--- CARDS ---'),
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('should present the share sheet after writing the file', async () => {
      await service.exportData('json');

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.objectContaining({ mimeType: 'application/json' })
      );
    });

    it('should filter mood logs from control values in JSON export', async () => {
      await service.exportData('json');

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);

      expect(content.moodLogs).toHaveLength(1);
      expect(content.moodLogs[0].control_type).toBe('mood_slider');
    });
  });

  describe('deleteAllData', () => {
    it('should delete all data from tables within a transaction', async () => {
      await service.deleteAllData();

      expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM control_values');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM completions');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM controls');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM reminders');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM cards');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM settings');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM crisis_resources');
      expect(mockExecAsync).toHaveBeenCalledWith('DELETE FROM categories');
      expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
    });

    it('should re-seed data after deletion', async () => {
      const { seedData } = require('../../data/seeds');
      await service.deleteAllData();

      expect(seedData).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockExecAsync
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // DELETE fails

      await expect(service.deleteAllData()).rejects.toThrow('DB error');
      expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});

describe('validateExportReadiness', () => {
  it('should return valid when all required rationale fields are populated', () => {
    const result = validateExportReadiness({
      id: 'card-1',
      title: 'Test Card',
      rationale_approach: 'grounding',
      rationale_in_a_nutshell: 'Helps redirect attention to the present moment.',
      rationale_how_it_works: 'Engages the prefrontal cortex through sensory focus.',
      rationale_evidence_level: 'moderate',
      rationale_research_summary: JSON.stringify(['Research point 1', 'Research point 2']),
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for all missing fields when card has no rationale', () => {
    const result = validateExportReadiness({
      id: 'card-2',
      title: 'Empty Card',
      rationale_approach: null,
      rationale_in_a_nutshell: null,
      rationale_how_it_works: null,
      rationale_evidence_level: null,
      rationale_research_summary: null,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(5);
    expect(result.errors.map((e) => e.field)).toEqual([
      'rationale_approach',
      'rationale_in_a_nutshell',
      'rationale_how_it_works',
      'rationale_evidence_level',
      'rationale_research_summary',
    ]);
  });

  it('should return an error for a single missing field', () => {
    const result = validateExportReadiness({
      id: 'card-3',
      title: 'Partial Card',
      rationale_approach: 'CBT',
      rationale_in_a_nutshell: 'A useful technique.',
      rationale_how_it_works: '',
      rationale_evidence_level: 'strong',
      rationale_research_summary: JSON.stringify(['Point 1', 'Point 2']),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('rationale_how_it_works');
  });

  it('should treat whitespace-only fields as missing', () => {
    const result = validateExportReadiness({
      id: 'card-4',
      title: 'Whitespace Card',
      rationale_approach: '   ',
      rationale_in_a_nutshell: 'Valid text',
      rationale_how_it_works: '\t\n',
      rationale_evidence_level: 'moderate',
      rationale_research_summary: JSON.stringify(['Point']),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.field)).toContain('rationale_approach');
    expect(result.errors.map((e) => e.field)).toContain('rationale_how_it_works');
  });

  it('should include the card title in error messages', () => {
    const result = validateExportReadiness({
      id: 'card-5',
      title: 'Box Breathing',
      rationale_approach: null,
      rationale_in_a_nutshell: 'Good',
      rationale_how_it_works: 'Works well',
      rationale_evidence_level: 'moderate',
      rationale_research_summary: JSON.stringify(['Research']),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Box Breathing');
  });
});