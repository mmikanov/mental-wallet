import * as fc from 'fast-check';
import { create, addToolUsed, getActive } from '../emotionSessionService';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
}));

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// Generators
const emotionArb = fc.constantFrom(
  'stressed',
  'overwhelmed',
  'anxious',
  'sad',
  'angry',
  'numb'
);
const toolSequenceArb = fc.array(fc.uuid(), { minLength: 0, maxLength: 10 });

/**
 * In-memory database row store simulating the emotion_sessions table.
 */
interface SessionRow {
  id: string;
  selected_emotion: string;
  selected_contexts: string;
  selected_time: string | null;
  tool_card_ids: string;
  started_at: string;
  ended_at: string | null;
}

/**
 * Creates an in-memory mock database that operates on an array of session rows.
 * Simulates execAsync (for transactions), runAsync (for INSERT/UPDATE),
 * getFirstAsync (for SELECT), and getAllAsync.
 */
function createMockDb() {
  const sessions: SessionRow[] = [];

  const mockDb = {
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
    execAsync: jest.fn(async (sql: string) => {
      // Transaction control — no-op in mock (kept for backward compatibility)
      return undefined;
    }),
    runAsync: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('UPDATE emotion_sessions SET ended_at') && sql.includes('WHERE ended_at IS NULL')) {
        // Close all unterminated sessions
        const timestamp = params[0] as string;
        for (const session of sessions) {
          if (session.ended_at === null) {
            session.ended_at = timestamp;
          }
        }
      } else if (sql.includes('UPDATE emotion_sessions SET tool_card_ids')) {
        // Update tool_card_ids for a specific session
        const toolCardIds = params[0] as string;
        const sessionId = params[1] as string;
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
          session.tool_card_ids = toolCardIds;
        }
      } else if (sql.includes('INSERT INTO emotion_sessions')) {
        const [id, emotion, startedAt] = params as [string, string, string];
        sessions.push({
          id,
          selected_emotion: emotion,
          selected_contexts: '[]',
          selected_time: null,
          tool_card_ids: '[]',
          started_at: startedAt,
          ended_at: null,
        });
      }
      return { changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT tool_card_ids FROM emotion_sessions WHERE id = ?')) {
        const sessionId = (params as string[])[0];
        const session = sessions.find((s) => s.id === sessionId);
        if (!session) return null;
        return { tool_card_ids: session.tool_card_ids };
      }
      if (sql.includes('WHERE ended_at IS NULL ORDER BY started_at DESC')) {
        const active = sessions
          .filter((s) => s.ended_at === null)
          .sort((a, b) => b.started_at.localeCompare(a.started_at));
        if (active.length === 0) return null;
        const s = active[0];
        return {
          id: s.id,
          selected_emotion: s.selected_emotion,
          selected_contexts: s.selected_contexts,
          selected_time: s.selected_time,
          tool_card_ids: s.tool_card_ids,
          started_at: s.started_at,
          ended_at: s.ended_at,
        };
      }
      return null;
    }),
    getAllAsync: jest.fn(async () => sessions.map((s) => ({ ...s }))),
  };

  return { sessions, mockDb };
}

describe('emotionSessionService - Property Tests', () => {
  describe('Feature: emotion-first-onboarding, Property 14: Session tool list append-only', () => {
    /**
     * **Validates: Requirements 10.2**
     *
     * For any sequence of tool card IDs [t1, t2, ..., tn], calling
     * addToolUsed(sessionId, t1), addToolUsed(sessionId, t2), ..., then
     * reading the session's tool_card_ids returns exactly [t1, t2, ..., tn]
     * in order. No entries are lost.
     */
    it('for any sequence of tool IDs, each is appended and no previous entries are lost', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, toolSequenceArb, async (emotion, toolIds) => {
          const { sessions, mockDb } = createMockDb();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          // Create a session
          const session = await create(emotion as any);
          const sessionId = session.id;

          // Append each tool ID
          for (const toolId of toolIds) {
            await addToolUsed(sessionId, toolId);
          }

          // Read the session's tool_card_ids from the in-memory store
          const storedSession = sessions.find((s) => s.id === sessionId);
          const storedToolIds: string[] = JSON.parse(
            storedSession!.tool_card_ids
          );

          // Must match exactly in order
          expect(storedToolIds).toEqual(toolIds);
          expect(storedToolIds.length).toBe(toolIds.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 16: EmotionSession record completeness', () => {
    /**
     * **Validates: Requirements 11.4**
     *
     * For any created EmotionSession record, it SHALL contain all required
     * fields: a non-null id, a non-null startedAt, a valid selectedEmotion
     * from the enum set, a selectedContexts array, a nullable selectedTime,
     * a toolCardIds array (empty), and a nullable endedAt.
     */
    it('for any emotion, create() returns a record with all required fields populated correctly', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, async (emotion) => {
          const { mockDb } = createMockDb();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          const session = await create(emotion as any);

          // id is a non-null string
          expect(session.id).not.toBeNull();
          expect(typeof session.id).toBe('string');
          expect(session.id.length).toBeGreaterThan(0);

          // startedAt is a non-null string
          expect(session.startedAt).not.toBeNull();
          expect(typeof session.startedAt).toBe('string');
          expect(session.startedAt.length).toBeGreaterThan(0);

          // selectedEmotion equals the input emotion
          expect(session.selectedEmotion).toBe(emotion);

          // selectedContexts is an array (empty at creation)
          expect(Array.isArray(session.selectedContexts)).toBe(true);
          expect(session.selectedContexts).toEqual([]);

          // selectedTime is null at creation
          expect(session.selectedTime).toBeNull();

          // toolCardIds is an empty array at creation
          expect(Array.isArray(session.toolCardIds)).toBe(true);
          expect(session.toolCardIds).toEqual([]);

          // endedAt is null at creation
          expect(session.endedAt).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 17: Previous unterminated session is closed on new session start', () => {
    /**
     * **Validates: Requirements 11.7**
     *
     * Starting with a session S1 that has ended_at = null, creating a new
     * session S2 must result in S1 having a non-null ended_at, and S2 having
     * ended_at = null. There should be at most 1 session with null ended_at.
     */
    it('creating a new session closes any open session first', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, emotionArb, async (emotion1, emotion2) => {
          const { sessions, mockDb } = createMockDb();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          // Create first session (S1)
          const s1 = await create(emotion1 as any);

          // S1 should be unterminated
          const s1Row = sessions.find((s) => s.id === s1.id);
          expect(s1Row!.ended_at).toBeNull();

          // Create second session (S2) — should close S1
          const s2 = await create(emotion2 as any);

          // S1 must now have a non-null ended_at
          const s1AfterRow = sessions.find((s) => s.id === s1.id);
          expect(s1AfterRow!.ended_at).not.toBeNull();
          expect(typeof s1AfterRow!.ended_at).toBe('string');

          // S2 must have ended_at = null
          const s2Row = sessions.find((s) => s.id === s2.id);
          expect(s2Row!.ended_at).toBeNull();

          // At most 1 session with null ended_at
          const activeSessions = sessions.filter((s) => s.ended_at === null);
          expect(activeSessions.length).toBe(1);
          expect(activeSessions[0].id).toBe(s2.id);
        }),
        { numRuns: 100 }
      );
    });
  });
});
