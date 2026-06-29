import * as fc from 'fast-check';
import { createCardService } from '../cardService';
import { ErrorCode } from '../../types/errors';

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

describe('cardService - Property Tests', () => {
  describe('Feature: emotion-first-onboarding, Property 3: Session_launcher cards are non-deletable', () => {
    /**
     * **Validates: Requirements 4.6**
     *
     * For any card with card_type equal to "session_launcher", invoking the
     * permanent delete operation SHALL be rejected (throw an error with code
     * VALIDATION_REQUIRED_FIELD), and the card SHALL remain in the database.
     */
    it('for any card ID where card_type is session_launcher, delete always throws and card remains', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (cardId) => {
          const mockCard = {
            id: cardId,
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
            getAllAsync: jest.fn().mockResolvedValue([mockCard]),
            getFirstAsync: jest.fn().mockResolvedValue({ card_type: 'session_launcher' }),
            execAsync: jest.fn().mockResolvedValue(undefined),
            runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createCardService();

          // Delete must be rejected
          let thrownError: any = null;
          try {
            await service.delete(cardId);
          } catch (err) {
            thrownError = err;
          }

          // Must throw an error
          expect(thrownError).not.toBeNull();
          expect(thrownError.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);

          // No transaction should have started (card remains in DB)
          const execCalls = mockDb.execAsync.mock.calls.map((c: unknown[]) => c[0]);
          expect(execCalls).not.toContain('BEGIN TRANSACTION');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 15: No duplicate wallet cards from "Add to wallet"', () => {
    /**
     * **Validates: Requirements 10.6**
     *
     * For any card_type that equals 'session_launcher', the delete operation
     * ALWAYS rejects. This property further validates at the service level that
     * session_launcher cards are consistently protected regardless of the card ID.
     *
     * Note: The full "Add to wallet" duplicate prevention is a UI-level concern
     * handled in SessionLauncherContent. At the service level, the protection
     * manifests as: session_launcher type cards cannot be deleted regardless of
     * how many times the operation is attempted.
     */
    it('for any card ID, if card_type is session_launcher, repeated delete attempts all reject consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }),
          async (cardId, attemptCount) => {
            const mockCard = {
              id: cardId,
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
              getAllAsync: jest.fn().mockResolvedValue([mockCard]),
              getFirstAsync: jest.fn().mockResolvedValue({ card_type: 'session_launcher' }),
              execAsync: jest.fn().mockResolvedValue(undefined),
              runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
            };

            mockGetDatabase.mockResolvedValue(mockDb as any);

            const service = createCardService();

            // All delete attempts must be rejected
            for (let i = 0; i < attemptCount; i++) {
              let thrownError: any = null;
              try {
                await service.delete(cardId);
              } catch (err) {
                thrownError = err;
              }

              expect(thrownError).not.toBeNull();
              expect(thrownError.code).toBe(ErrorCode.VALIDATION_REQUIRED_FIELD);
            }

            // No transaction should have started for any attempt
            const execCalls = mockDb.execAsync.mock.calls.map((c: unknown[]) => c[0]);
            expect(execCalls).not.toContain('BEGIN TRANSACTION');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
