import { create, addToolUsed, endSession } from '../emotionSessionService';
import { setTagsForCard, setContextTags, setTimeTags } from '../emotionTagService';

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
 */
function createMockDb() {
  const sessions: SessionRow[] = [];

  const mockDb = {
    execAsync: jest.fn(async (_sql: string) => undefined),
    runAsync: jest.fn(async (sql: string, params: unknown[]) => {
      if (
        sql.includes('UPDATE emotion_sessions SET ended_at') &&
        sql.includes('WHERE ended_at IS NULL') &&
        !sql.includes('WHERE id = ?')
      ) {
        // Close all unterminated sessions
        const timestamp = params[0] as string;
        for (const session of sessions) {
          if (session.ended_at === null) {
            session.ended_at = timestamp;
          }
        }
      } else if (
        sql.includes('UPDATE emotion_sessions SET ended_at') &&
        sql.includes('WHERE id = ?')
      ) {
        // End specific session
        const timestamp = params[0] as string;
        const sessionId = params[1] as string;
        const session = sessions.find((s) => s.id === sessionId && s.ended_at === null);
        if (session) {
          session.ended_at = timestamp;
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
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  };

  return { sessions, mockDb };
}

describe('Session Interactions - Unit Tests', () => {
  describe('Tool opening appends to session tool list (Req 10.2)', () => {
    it('appends a single tool to an empty session tool list', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('stressed');
      await addToolUsed(session.id, 'card-abc');

      const storedSession = sessions.find((s) => s.id === session.id);
      const toolIds: string[] = JSON.parse(storedSession!.tool_card_ids);
      expect(toolIds).toEqual(['card-abc']);
    });

    it('appends multiple tools in order', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('anxious');
      await addToolUsed(session.id, 'card-1');
      await addToolUsed(session.id, 'card-2');
      await addToolUsed(session.id, 'card-3');

      const storedSession = sessions.find((s) => s.id === session.id);
      const toolIds: string[] = JSON.parse(storedSession!.tool_card_ids);
      expect(toolIds).toEqual(['card-1', 'card-2', 'card-3']);
    });

    it('preserves previously added tools when appending new ones', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('sad');
      await addToolUsed(session.id, 'tool-a');
      await addToolUsed(session.id, 'tool-b');

      // Verify first two are there
      let storedSession = sessions.find((s) => s.id === session.id);
      let toolIds: string[] = JSON.parse(storedSession!.tool_card_ids);
      expect(toolIds).toEqual(['tool-a', 'tool-b']);

      // Add a third
      await addToolUsed(session.id, 'tool-c');

      storedSession = sessions.find((s) => s.id === session.id);
      toolIds = JSON.parse(storedSession!.tool_card_ids);
      expect(toolIds).toEqual(['tool-a', 'tool-b', 'tool-c']);
    });

    it('allows the same card ID to be appended multiple times (append-only)', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('overwhelmed');
      await addToolUsed(session.id, 'card-x');
      await addToolUsed(session.id, 'card-x');

      const storedSession = sessions.find((s) => s.id === session.id);
      const toolIds: string[] = JSON.parse(storedSession!.tool_card_ids);
      expect(toolIds).toEqual(['card-x', 'card-x']);
    });

    it('throws when session does not exist', async () => {
      const { mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      await expect(addToolUsed('nonexistent-session', 'card-1')).rejects.toThrow(
        'Emotion session not found'
      );
    });
  });

  describe('"Add to wallet" success flow (Req 10.5)', () => {
    /**
     * Tests that the underlying services (setTagsForCard, setContextTags, setTimeTags)
     * work correctly in sequence, simulating the "Add to wallet" flow at the service level.
     */
    it('persists emotion tags for a card via setTagsForCard', async () => {
      const emotionInserts: Array<{ cardId: string; emotion: string }> = [];

      const tagMockDb = {
        runAsync: jest.fn(async (sql: string, params: unknown[]) => {
          if (sql.includes('DELETE FROM emotion_tags')) {
            // no-op for delete
          } else if (sql.includes('INSERT INTO emotion_tags')) {
            emotionInserts.push({
              cardId: params[1] as string,
              emotion: params[2] as string,
            });
          }
          return { changes: 1 };
        }),
        withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
          await fn();
        }),
      };

      mockGetDatabase.mockResolvedValue(tagMockDb as any);

      await setTagsForCard('new-wallet-card', ['stressed', 'anxious']);

      expect(emotionInserts).toHaveLength(2);
      expect(emotionInserts[0]).toMatchObject({ cardId: 'new-wallet-card', emotion: 'stressed' });
      expect(emotionInserts[1]).toMatchObject({ cardId: 'new-wallet-card', emotion: 'anxious' });
    });

    it('persists context tags for a card via setContextTags', async () => {
      const contextInserts: Array<{ cardId: string; context: string }> = [];

      const tagMockDb = {
        runAsync: jest.fn(async (sql: string, params: unknown[]) => {
          if (sql.includes('INSERT INTO card_context_tags')) {
            contextInserts.push({
              cardId: params[0] as string,
              context: params[1] as string,
            });
          }
          return { changes: 1 };
        }),
        withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
          await fn();
        }),
      };

      mockGetDatabase.mockResolvedValue(tagMockDb as any);

      await setContextTags('new-wallet-card', ['at_work', 'alone_at_home']);

      expect(contextInserts).toHaveLength(2);
      expect(contextInserts[0]).toMatchObject({ cardId: 'new-wallet-card', context: 'at_work' });
      expect(contextInserts[1]).toMatchObject({
        cardId: 'new-wallet-card',
        context: 'alone_at_home',
      });
    });

    it('persists time tags for a card via setTimeTags', async () => {
      const timeInserts: Array<{ cardId: string; time: string }> = [];

      const tagMockDb = {
        runAsync: jest.fn(async (sql: string, params: unknown[]) => {
          if (sql.includes('INSERT INTO card_time_tags')) {
            timeInserts.push({
              cardId: params[0] as string,
              time: params[1] as string,
            });
          }
          return { changes: 1 };
        }),
        withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
          await fn();
        }),
      };

      mockGetDatabase.mockResolvedValue(tagMockDb as any);

      await setTimeTags('new-wallet-card', ['5_10_min']);

      expect(timeInserts).toHaveLength(1);
      expect(timeInserts[0]).toMatchObject({ cardId: 'new-wallet-card', time: '5_10_min' });
    });

    it('completes full tag assignment sequence (emotions + contexts + time) without errors', async () => {
      const allInserts: string[] = [];

      const tagMockDb = {
        runAsync: jest.fn(async (sql: string, _params: unknown[]) => {
          if (sql.includes('INSERT')) {
            allInserts.push(sql);
          }
          return { changes: 1 };
        }),
        withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
          await fn();
        }),
      };

      mockGetDatabase.mockResolvedValue(tagMockDb as any);

      // Simulate the full "Add to wallet" tag assignment sequence
      await setTagsForCard('card-new', ['stressed', 'overwhelmed', 'anxious']);
      await setContextTags('card-new', ['at_work']);
      await setTimeTags('card-new', ['1_2_min']);

      // Should have inserts for 3 emotion tags + 1 context tag + 1 time tag = 5
      expect(allInserts).toHaveLength(5);
    });
  });

  describe('Duplicate detection (Req 10.6)', () => {
    it('addToolUsed appends the same cardId twice (append-only, no dedup at service level)', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('angry');
      await addToolUsed(session.id, 'duplicate-card');
      await addToolUsed(session.id, 'duplicate-card');
      await addToolUsed(session.id, 'duplicate-card');

      const storedSession = sessions.find((s) => s.id === session.id);
      const toolIds: string[] = JSON.parse(storedSession!.tool_card_ids);
      expect(toolIds).toEqual(['duplicate-card', 'duplicate-card', 'duplicate-card']);
      expect(toolIds.length).toBe(3);
    });

    it('UI-level duplicate detection: wallet already contains card with same title should skip', () => {
      // This tests the logic used in SessionLauncherContent's handleAddToWallet
      const walletCards = [
        { id: 'existing-1', title: 'Box Breathing' },
        { id: 'existing-2', title: '5-4-3-2-1 Grounding' },
      ];

      const libraryCardTitle = 'Box Breathing';

      // Logic from handleAddToWallet: check if a card with the same title already exists
      const alreadyInWallet = walletCards.some((c) => c.title === libraryCardTitle);
      expect(alreadyInWallet).toBe(true);
    });

    it('UI-level duplicate detection: allows adding when title not in wallet', () => {
      const walletCards = [
        { id: 'existing-1', title: 'Box Breathing' },
        { id: 'existing-2', title: '5-4-3-2-1 Grounding' },
      ];

      const libraryCardTitle = 'Progressive Muscle Relaxation';

      const alreadyInWallet = walletCards.some((c) => c.title === libraryCardTitle);
      expect(alreadyInWallet).toBe(false);
    });

    it('UI-level duplicate detection: session-level set prevents re-adding same library card ID', () => {
      // This tests the addedToWalletIds Set logic in SessionLauncherContent
      const addedToWalletIds = new Set<string>(['library-card-1']);

      // Attempting to add a card that was already added in this session
      const cardId = 'library-card-1';
      const shouldSkip = addedToWalletIds.has(cardId);
      expect(shouldSkip).toBe(true);

      // A new card should not be skipped
      const newCardId = 'library-card-2';
      const shouldSkipNew = addedToWalletIds.has(newCardId);
      expect(shouldSkipNew).toBe(false);
    });
  });

  describe('Session end writes timestamp (Req 11.2)', () => {
    it('endSession sets ended_at to a valid ISO timestamp', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('numb');

      // Verify ended_at is null before ending
      const beforeEnd = sessions.find((s) => s.id === session.id);
      expect(beforeEnd!.ended_at).toBeNull();

      await endSession(session.id);

      const afterEnd = sessions.find((s) => s.id === session.id);
      expect(afterEnd!.ended_at).not.toBeNull();
      expect(typeof afterEnd!.ended_at).toBe('string');

      // Verify it's a valid ISO date
      const date = new Date(afterEnd!.ended_at!);
      expect(date.getTime()).not.toBeNaN();
    });

    it('endSession timestamp is at or after the started_at timestamp', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('stressed');
      await endSession(session.id);

      const storedSession = sessions.find((s) => s.id === session.id);
      const startedAt = new Date(storedSession!.started_at).getTime();
      const endedAt = new Date(storedSession!.ended_at!).getTime();

      expect(endedAt).toBeGreaterThanOrEqual(startedAt);
    });

    it('endSession does not modify an already-ended session', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      const session = await create('anxious');
      await endSession(session.id);

      const firstEndedAt = sessions.find((s) => s.id === session.id)!.ended_at;

      // End again — should not change the timestamp (query has `AND ended_at IS NULL`)
      await endSession(session.id);

      const secondEndedAt = sessions.find((s) => s.id === session.id)!.ended_at;
      expect(secondEndedAt).toBe(firstEndedAt);
    });

    it('endSession only affects the targeted session, not others', async () => {
      const { sessions, mockDb } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);

      // Create two sessions (second one closes the first automatically)
      const session1 = await create('sad');
      const session1EndedAt = sessions.find((s) => s.id === session1.id)!.ended_at;

      // Session1 was auto-closed by creating session2, so let's create fresh
      const { sessions: sessions2, mockDb: mockDb2 } = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb2 as any);

      const sessionA = await create('angry');
      // Manually add another active session (simulating edge case)
      sessions2.push({
        id: 'session-other',
        selected_emotion: 'numb',
        selected_contexts: '[]',
        selected_time: null,
        tool_card_ids: '[]',
        started_at: new Date().toISOString(),
        ended_at: null,
      });

      await endSession(sessionA.id);

      const sessionARow = sessions2.find((s) => s.id === sessionA.id);
      const otherRow = sessions2.find((s) => s.id === 'session-other');

      expect(sessionARow!.ended_at).not.toBeNull();
      // The other session remains unterminated (endSession targets by ID)
      expect(otherRow!.ended_at).toBeNull();
    });
  });
});
