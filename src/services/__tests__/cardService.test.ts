import { validateShell, validateControls, createCardService } from '../cardService';
import type { CardShell, Control, ControlConfig, LinkButtonConfig } from '../../types/index';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
}));

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

describe('CardService', () => {
  describe('validateShell', () => {
    const validShell: CardShell = {
      title: 'My Coping Tool',
      description: 'A helpful description for this tool',
      iconType: 'emoji',
      iconValue: '🧘',
      backgroundType: 'color',
      backgroundValue: '#4A90D9',
    };

    it('accepts a valid shell with all fields populated', () => {
      const result = validateShell(validShell);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects shell with empty title', () => {
      const result = validateShell({ ...validShell, title: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
    });

    it('rejects shell with whitespace-only title', () => {
      const result = validateShell({ ...validShell, title: '   \t\n  ' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
    });

    it('rejects shell with title exceeding 80 characters', () => {
      const result = validateShell({ ...validShell, title: 'A'.repeat(81) });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
    });

    it('accepts shell with title at exactly 80 characters', () => {
      const result = validateShell({ ...validShell, title: 'A'.repeat(80) });
      expect(result.isValid).toBe(true);
    });

    it('rejects shell with empty description', () => {
      const result = validateShell({ ...validShell, description: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'description')).toBe(true);
    });

    it('rejects shell with whitespace-only description', () => {
      const result = validateShell({ ...validShell, description: '   ' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'description')).toBe(true);
    });

    it('rejects shell with description exceeding 300 characters', () => {
      const result = validateShell({ ...validShell, description: 'B'.repeat(301) });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'description')).toBe(true);
    });

    it('accepts shell with description at exactly 300 characters', () => {
      const result = validateShell({ ...validShell, description: 'B'.repeat(300) });
      expect(result.isValid).toBe(true);
    });

    it('rejects shell with empty iconValue', () => {
      const result = validateShell({ ...validShell, iconValue: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'iconValue')).toBe(true);
    });

    it('rejects shell with whitespace-only iconValue', () => {
      const result = validateShell({ ...validShell, iconValue: '   ' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'iconValue')).toBe(true);
    });

    it('rejects shell with empty backgroundValue', () => {
      const result = validateShell({ ...validShell, backgroundValue: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'backgroundValue')).toBe(true);
    });

    it('rejects shell with whitespace-only backgroundValue', () => {
      const result = validateShell({ ...validShell, backgroundValue: '  \n ' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'backgroundValue')).toBe(true);
    });

    it('reports all invalid fields at once when multiple are empty', () => {
      const result = validateShell({
        ...validShell,
        title: '',
        description: '',
        iconValue: '',
        backgroundValue: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(4);
    });
  });

  describe('validateControls', () => {
    function makeControl(overrides?: Partial<Control>): Control {
      return {
        id: 'ctrl-1',
        cardId: 'card-1',
        type: 'checkbox',
        position: 0,
        config: { label: 'Test' } as ControlConfig,
        isRequired: false,
        ...overrides,
      };
    }

    it('accepts 1 control', () => {
      const result = validateControls([makeControl()]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts 10 controls', () => {
      const controls = Array.from({ length: 10 }, (_, i) =>
        makeControl({ id: `ctrl-${i}`, position: i })
      );
      const result = validateControls(controls);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects 0 controls', () => {
      const result = validateControls([]);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'controls')).toBe(true);
    });

    it('rejects 11 controls', () => {
      const controls = Array.from({ length: 11 }, (_, i) =>
        makeControl({ id: `ctrl-${i}`, position: i })
      );
      const result = validateControls(controls);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'controls')).toBe(true);
    });

    it('rejects 15 controls', () => {
      const controls = Array.from({ length: 15 }, (_, i) =>
        makeControl({ id: `ctrl-${i}`, position: i })
      );
      const result = validateControls(controls);
      expect(result.isValid).toBe(false);
    });

    it('accepts link_button with valid https URL', () => {
      const control = makeControl({
        type: 'link_button',
        config: { label: 'Visit', targetUrl: 'https://example.com' } as LinkButtonConfig,
      });
      const result = validateControls([control]);
      expect(result.isValid).toBe(true);
    });

    it('accepts link_button with valid http URL', () => {
      const control = makeControl({
        type: 'link_button',
        config: { label: 'Visit', targetUrl: 'http://example.com' } as LinkButtonConfig,
      });
      const result = validateControls([control]);
      expect(result.isValid).toBe(true);
    });

    it('accepts link_button with valid custom scheme', () => {
      const control = makeControl({
        type: 'link_button',
        config: {
          label: 'Open App',
          targetUrl: 'myapp://deep/path',
        } as LinkButtonConfig,
      });
      const result = validateControls([control]);
      expect(result.isValid).toBe(true);
    });

    it('rejects link_button with invalid URL (no scheme)', () => {
      const control = makeControl({
        type: 'link_button',
        config: {
          label: 'Bad Link',
          targetUrl: 'not-a-valid-url',
        } as LinkButtonConfig,
      });
      const result = validateControls([control]);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('targetUrl'))).toBe(true);
    });

    it('rejects link_button with empty URL', () => {
      const control = makeControl({
        type: 'link_button',
        config: { label: 'Empty', targetUrl: '' } as LinkButtonConfig,
      });
      const result = validateControls([control]);
      expect(result.isValid).toBe(false);
    });
  });

  describe('delete', () => {
    it('throws an error when attempting to delete a session_launcher card', async () => {
      const { getDatabase } = require('../../data/database');

      const mockSessionLauncherCard = {
        id: 'session-launcher',
        title: 'Start from how I feel',
        description: 'Tell the app what you are dealing with.',
        icon_type: 'emoji',
        icon_value: '🫶',
        background_type: 'color',
        background_value: '#F0E6FF',
        category_id: 'grounding-calming',
        origin_badge: 'library',
        stack_position: 0,
        total_uses: 0,
        current_streak: 0,
        last_used_at: null,
        is_archived: 0,
        archived_at: null,
        previous_stack_position: null,
        allow_background_customization: 0,
        source_library_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        control_id: null,
        control_card_id: null,
        control_type: null,
        control_position: null,
        control_config: null,
        control_is_required: null,
      };

      const mockDb = {
        getAllAsync: jest.fn().mockResolvedValue([mockSessionLauncherCard]),
        getFirstAsync: jest.fn().mockResolvedValue({ card_type: 'session_launcher' }),
        execAsync: jest.fn().mockResolvedValue(undefined),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      };

      getDatabase.mockResolvedValue(mockDb);

      const service = createCardService();

      await expect(service.delete('session-launcher')).rejects.toThrow(
        'Cannot permanently delete the session launcher card'
      );

      // Verify no transaction was started (delete was blocked before transaction)
      const execCalls = mockDb.execAsync.mock.calls.map((c: unknown[]) => c[0]);
      expect(execCalls).not.toContain('BEGIN TRANSACTION');
    });

    it('allows deletion of standard cards', async () => {
      const { getDatabase } = require('../../data/database');

      const mockStandardCard = {
        id: 'standard-card-1',
        title: 'Breathing Exercise',
        description: 'A simple breathing exercise',
        icon_type: 'emoji',
        icon_value: '🌬️',
        background_type: 'color',
        background_value: '#87CEEB',
        category_id: 'grounding-calming',
        origin_badge: 'my_tool',
        stack_position: 1,
        total_uses: 5,
        current_streak: 1,
        last_used_at: null,
        is_archived: 0,
        archived_at: null,
        previous_stack_position: null,
        allow_background_customization: 0,
        source_library_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        control_id: null,
        control_card_id: null,
        control_type: null,
        control_position: null,
        control_config: null,
        control_is_required: null,
      };

      const mockDb = {
        getAllAsync: jest.fn().mockResolvedValue([mockStandardCard]),
        getFirstAsync: jest.fn().mockResolvedValue({ card_type: 'standard' }),
        execAsync: jest.fn().mockResolvedValue(undefined),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      };

      getDatabase.mockResolvedValue(mockDb);

      const service = createCardService();
      await service.delete('standard-card-1');

      // Verify transaction was started (delete proceeded)
      const execCalls = mockDb.execAsync.mock.calls.map((c: unknown[]) => c[0]);
      expect(execCalls).toContain('BEGIN TRANSACTION');
      expect(execCalls).toContain('COMMIT');
    });
  });

  describe('duplicate', () => {
    it('creates a copy with reset stats and "my_tool" badge', async () => {
      const { getDatabase } = require('../../data/database');

      const mockCard = {
        id: 'original-id',
        title: 'Deep Breathing',
        description: 'A calming exercise',
        icon_type: 'emoji',
        icon_value: '🌬️',
        background_type: 'color',
        background_value: '#87CEEB',
        category_id: 'grounding-calming',
        origin_badge: 'library',
        stack_position: 2,
        total_uses: 15,
        current_streak: 3,
        last_used_at: '2024-01-15T10:00:00Z',
        is_archived: 0,
        archived_at: null,
        previous_stack_position: null,
        allow_background_customization: 0,
        source_library_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        control_id: 'ctrl-1',
        control_card_id: 'original-id',
        control_type: 'static_text',
        control_position: 0,
        control_config: '{"body":"Breathe deeply","fontSize":"medium"}',
        control_is_required: 0,
      };

      const mockDuplicated = {
        ...mockCard,
        id: 'mock-uuid-new',
        title: 'Deep Breathing - Copy',
        origin_badge: 'my_tool',
        stack_position: 0,
        total_uses: 0,
        current_streak: 0,
        last_used_at: null,
        control_card_id: 'mock-uuid-new',
      };

      let callCount = 0;
      const mockDb = {
        getAllAsync: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return [mockCard]; // getById for original
          return [mockDuplicated]; // getById for duplicated
        }),
        getFirstAsync: jest.fn().mockResolvedValue({ count: 3 }),
        execAsync: jest.fn().mockResolvedValue(undefined),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      };

      getDatabase.mockResolvedValue(mockDb);

      const service = createCardService();
      const result = await service.duplicate('original-id');

      expect(result.title).toBe('Deep Breathing - Copy');
      expect(result.originBadge).toBe('my_tool');
      expect(result.totalUses).toBe(0);
      expect(result.currentStreak).toBe(0);
      expect(result.lastUsedAt).toBeNull();
      expect(result.stackPosition).toBe(0);

      // Verify the duplicate insert was called with correct params
      const insertCalls = mockDb.runAsync.mock.calls;
      const cardInsertCall = insertCalls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO cards')
      );
      expect(cardInsertCall).toBeDefined();
      // Verify origin_badge is 'my_tool' in the insert
      expect(cardInsertCall![0]).toContain("'my_tool'");
    });
  });
});
