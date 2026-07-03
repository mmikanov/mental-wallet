import { createKpiService, validateKpiLabel } from '../kpiService';
import { AppError, ErrorCode } from '../../types/errors';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock expo-crypto for seedKpiCard tests
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 9)),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

function createMockDb() {
  return {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

/**
 * KPI options as defined in KpiSelectionScreen.
 * Must match the 7 predefined options in the spec.
 */
const KPI_OPTIONS = [
  'Feeling calmer',
  'Sleeping better',
  'Being more present',
  'Having more energy',
  'Feeling more connected',
  'Managing stress better',
  'Other (write your own)',
] as const;

/** Default KPI label used when user skips selection */
const DEFAULT_KPI = 'Feeling good overall';

/** Fixed card metadata from the spec */
const KPI_CARD_METADATA = {
  title: 'My Check-In',
  description: 'A moment to check in with yourself on what matters to you.',
  iconValue: '🌱',
  backgroundValue: '#E8F5E9',
} as const;

/**
 * Forbidden words that must not appear in any user-facing text
 * within the KPI feature (Requirement 6.1).
 */
const FORBIDDEN_WORDS = [
  'KPI',
  'metric',
  'data',
  'tracking',
  'score',
  'performance',
  'measurement',
] as const;

describe('kpiService', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: ReturnType<typeof createKpiService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGetDatabase.mockResolvedValue(mockDb as any);
    service = createKpiService();
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as any);
  });

  describe('validateKpiLabel', () => {
    it('accepts a valid label with 2+ non-whitespace chars', () => {
      expect(validateKpiLabel('Hi')).toBe(true);
    });

    it('accepts predefined KPI options', () => {
      expect(validateKpiLabel('Feeling calmer')).toBe(true);
      expect(validateKpiLabel('Sleeping better')).toBe(true);
      expect(validateKpiLabel('Being more present')).toBe(true);
    });

    it('rejects a label with fewer than 2 non-whitespace chars', () => {
      expect(validateKpiLabel('a')).toBe(false);
      expect(validateKpiLabel(' a ')).toBe(false);
      expect(validateKpiLabel('   ')).toBe(false);
      expect(validateKpiLabel('')).toBe(false);
    });

    it('rejects a label longer than 50 characters', () => {
      const longLabel = 'a'.repeat(51);
      expect(validateKpiLabel(longLabel)).toBe(false);
    });

    it('accepts a label that is exactly 50 characters', () => {
      const label = 'a'.repeat(50);
      expect(validateKpiLabel(label)).toBe(true);
    });

    it('counts non-whitespace characters correctly with mixed whitespace', () => {
      expect(validateKpiLabel(' a b ')).toBe(true); // 2 non-whitespace
      expect(validateKpiLabel('\t\n x \t')).toBe(false); // 1 non-whitespace
    });
  });

  describe('getPersonalKpi', () => {
    it('returns null when no setting exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await service.getPersonalKpi();

      expect(result).toBeNull();
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT value FROM settings WHERE key = ?',
        ['personal_kpi']
      );
    });

    it('returns the stored KPI label', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'Feeling calmer' });

      const result = await service.getPersonalKpi();

      expect(result).toBe('Feeling calmer');
    });
  });

  describe('setPersonalKpi', () => {
    it('persists a valid predefined KPI label', async () => {
      await service.setPersonalKpi('Sleeping better');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['personal_kpi', 'Sleeping better']
      );
    });

    it('trims whitespace before persisting', async () => {
      await service.setPersonalKpi('  Feeling calmer  ');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['personal_kpi', 'Feeling calmer']
      );
    });

    it('throws validation error for labels with fewer than 2 non-whitespace chars', async () => {
      await expect(service.setPersonalKpi('a')).rejects.toThrow(AppError);
      await expect(service.setPersonalKpi('a')).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_EMPTY_FIELD,
      });
    });

    it('throws validation error for labels longer than 50 characters', async () => {
      const longLabel = 'a'.repeat(51);
      await expect(service.setPersonalKpi(longLabel)).rejects.toThrow(AppError);
      await expect(service.setPersonalKpi(longLabel)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_EMPTY_FIELD,
      });
    });

    it('throws persistence error when database write fails', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('disk full'));

      await expect(service.setPersonalKpi('Valid label')).rejects.toThrow(AppError);
      await expect(service.setPersonalKpi('Valid label')).rejects.toMatchObject({
        code: ErrorCode.PERSISTENCE_WRITE_FAILED,
      });
    });
  });

  describe('kpiCardExists', () => {
    it('returns false when no KPI card exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

      const result = await service.kpiCardExists();

      expect(result).toBe(false);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM cards WHERE source_library_id = ?',
        ['lib-personal-kpi']
      );
    });

    it('returns true when a KPI card exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 1 });

      const result = await service.kpiCardExists();

      expect(result).toBe(true);
    });

    it('returns false when query returns null', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await service.kpiCardExists();

      expect(result).toBe(false);
    });
  });

  describe('skip sets default "Feeling good overall"', () => {
    it('persists the default KPI label when skip is used', async () => {
      await service.setPersonalKpi(DEFAULT_KPI);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['personal_kpi', 'Feeling good overall']
      );
    });

    it('validates the default KPI label as valid', () => {
      expect(validateKpiLabel(DEFAULT_KPI)).toBe(true);
    });
  });

  describe('fixed card metadata matches spec', () => {
    it('seeds card with title "My Check-In"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
      mockDb.runAsync.mockResolvedValue(undefined);
      mockDb.execAsync.mockResolvedValue(undefined);

      await service.seedKpiCard('Feeling calmer');

      // The INSERT INTO cards call should include the correct title
      const insertCall = mockDb.runAsync.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO cards')
      );
      expect(insertCall).toBeDefined();
      const params = insertCall![1] as any[];
      // title is the second param (after id)
      expect(params[1]).toBe(KPI_CARD_METADATA.title);
    });

    it('seeds card with description matching spec', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
      mockDb.runAsync.mockResolvedValue(undefined);
      mockDb.execAsync.mockResolvedValue(undefined);

      await service.seedKpiCard('Feeling calmer');

      const insertCall = mockDb.runAsync.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO cards')
      );
      expect(insertCall).toBeDefined();
      const params = insertCall![1] as any[];
      // description is the third param
      expect(params[2]).toBe(KPI_CARD_METADATA.description);
    });

    it('seeds card with icon emoji "🌱"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
      mockDb.runAsync.mockResolvedValue(undefined);
      mockDb.execAsync.mockResolvedValue(undefined);

      await service.seedKpiCard('Feeling calmer');

      const insertCall = mockDb.runAsync.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO cards')
      );
      expect(insertCall).toBeDefined();
      const params = insertCall![1] as any[];
      // icon_type is params[3], icon_value is params[4]
      expect(params[3]).toBe('emoji');
      expect(params[4]).toBe(KPI_CARD_METADATA.iconValue);
    });

    it('seeds card with background color "#E8F5E9"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
      mockDb.runAsync.mockResolvedValue(undefined);
      mockDb.execAsync.mockResolvedValue(undefined);

      await service.seedKpiCard('Feeling calmer');

      const insertCall = mockDb.runAsync.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO cards')
      );
      expect(insertCall).toBeDefined();
      const params = insertCall![1] as any[];
      // background_type is params[5], background_value is params[6]
      expect(params[5]).toBe('color');
      expect(params[6]).toBe(KPI_CARD_METADATA.backgroundValue);
    });
  });

  describe('validation rejects specific edge cases', () => {
    it('rejects single character "a"', () => {
      expect(validateKpiLabel('a')).toBe(false);
    });

    it('rejects whitespace-only input "  "', () => {
      expect(validateKpiLabel('  ')).toBe(false);
    });

    it('rejects 51-character input', () => {
      expect(validateKpiLabel('a'.repeat(51))).toBe(false);
    });

    it('rejects tab characters only', () => {
      expect(validateKpiLabel('\t\t\t')).toBe(false);
    });

    it('rejects single char with surrounding whitespace', () => {
      expect(validateKpiLabel('  x  ')).toBe(false);
    });

    it('accepts exactly 2 non-whitespace characters', () => {
      expect(validateKpiLabel('ab')).toBe(true);
    });

    it('accepts exactly 50 characters', () => {
      expect(validateKpiLabel('a'.repeat(50))).toBe(true);
    });
  });

  describe('forbidden words not present in UI strings', () => {
    it('KPI options do not contain forbidden words', () => {
      for (const option of KPI_OPTIONS) {
        for (const forbidden of FORBIDDEN_WORDS) {
          expect(option.toLowerCase()).not.toContain(forbidden.toLowerCase());
        }
      }
    });

    it('card title does not contain forbidden words', () => {
      for (const forbidden of FORBIDDEN_WORDS) {
        expect(KPI_CARD_METADATA.title.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    });

    it('card description does not contain forbidden words', () => {
      for (const forbidden of FORBIDDEN_WORDS) {
        expect(KPI_CARD_METADATA.description.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    });

    it('default KPI label does not contain forbidden words', () => {
      for (const forbidden of FORBIDDEN_WORDS) {
        expect(DEFAULT_KPI.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    });

    it('control labels do not contain forbidden words', () => {
      const controlLabels = [
        'Anything you want to note?',
        'A word or thought…',
        'Not great',
        'Really good',
      ];
      for (const label of controlLabels) {
        for (const forbidden of FORBIDDEN_WORDS) {
          expect(label.toLowerCase()).not.toContain(forbidden.toLowerCase());
        }
      }
    });
  });

  describe('predefined options list is exactly 7 items', () => {
    it('has exactly 7 KPI options', () => {
      expect(KPI_OPTIONS).toHaveLength(7);
    });

    it('last item is "Other (write your own)"', () => {
      expect(KPI_OPTIONS[6]).toBe('Other (write your own)');
    });

    it('first 6 items are predefined labels (not "Other")', () => {
      const predefined = KPI_OPTIONS.slice(0, 6);
      for (const option of predefined) {
        expect(option).not.toContain('Other');
      }
    });
  });
});
