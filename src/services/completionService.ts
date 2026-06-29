/**
 * CompletionService implementation.
 * Handles recording completions, managing control values,
 * streak calculations, and stale streak resets.
 *
 * Validates: Requirements 5.5, 13.1, 13.2, 13.3, 11.1
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from '../data/database';
import type { CompletionService } from '../types/services';
import type { Completion, ControlValue, Pagination, StreakInfo } from '../types/index';
import { AppError, ErrorCode } from '../types/errors';

// --- Date Helpers (no external deps for MVP) ---

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function differenceInCalendarDays(a: Date, b: Date): number {
  const dayA = startOfDay(a);
  const dayB = startOfDay(b);
  return Math.floor((dayA.getTime() - dayB.getTime()) / 86_400_000);
}

// --- Service Implementation ---

export function createCompletionService(): CompletionService {
  return {
    async record(
      cardId: string,
      values: Omit<ControlValue, 'id' | 'completionId'>[]
    ): Promise<Completion> {
      const db = await getDatabase();
      const completionId = Crypto.randomUUID();
      const completedAt = new Date().toISOString();

      const controlValues: ControlValue[] = [];

      try {
        await db.withTransactionAsync(async () => {
          // Insert completion record
          await db.runAsync(
            'INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)',
            [completionId, cardId, completedAt]
          );

          // Insert each control value
          for (const val of values) {
            const valueId = Crypto.randomUUID();
            await db.runAsync(
              'INSERT INTO control_values (id, completion_id, control_id, control_type, value) VALUES (?, ?, ?, ?, ?)',
              [valueId, completionId, val.controlId, val.controlType, val.value]
            );
            controlValues.push({
              id: valueId,
              completionId,
              controlId: val.controlId,
              controlType: val.controlType,
              value: val.value,
            });
          }

          // Update streak for the card
          await updateStreakInternal(db, cardId);
        });

        return {
          id: completionId,
          cardId,
          completedAt,
          values: controlValues,
        };
      } catch (error) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_TRANSACTION_FAILED,
          `Failed to record completion for card ${cardId}`,
          error instanceof Error ? error : undefined
        );
      }
    },

    async getByCard(cardId: string, pagination?: Pagination): Promise<Completion[]> {
      const db = await getDatabase();
      const page = pagination?.page ?? 1;
      const pageSize = pagination?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      try {
        // Get completions for this card, paginated, newest first
        const completions = await db.getAllAsync<{
          id: string;
          card_id: string;
          completed_at: string;
        }>(
          'SELECT id, card_id, completed_at FROM completions WHERE card_id = ? ORDER BY completed_at DESC LIMIT ? OFFSET ?',
          [cardId, pageSize, offset]
        );

        // For each completion, load its control values
        const results: Completion[] = [];
        for (const comp of completions) {
          const values = await db.getAllAsync<{
            id: string;
            completion_id: string;
            control_id: string;
            control_type: string;
            value: string | null;
          }>(
            'SELECT id, completion_id, control_id, control_type, value FROM control_values WHERE completion_id = ?',
            [comp.id]
          );

          results.push({
            id: comp.id,
            cardId: comp.card_id,
            completedAt: comp.completed_at,
            values: values.map((v) => ({
              id: v.id,
              completionId: v.completion_id,
              controlId: v.control_id,
              controlType: v.control_type as ControlValue['controlType'],
              value: v.value ?? '',
            })),
          });
        }

        return results;
      } catch (error) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_READ_FAILED,
          `Failed to read completions for card ${cardId}`,
          error instanceof Error ? error : undefined
        );
      }
    },

    async deleteEntry(completionId: string): Promise<void> {
      const db = await getDatabase();

      try {
        // Delete control values first (explicit for safety, even though CASCADE exists)
        await db.runAsync(
          'DELETE FROM control_values WHERE completion_id = ?',
          [completionId]
        );
        // Delete the completion record
        await db.runAsync('DELETE FROM completions WHERE id = ?', [completionId]);
      } catch (error) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          `Failed to delete completion ${completionId}`,
          error instanceof Error ? error : undefined
        );
      }
    },

    async getStreakInfo(cardId: string): Promise<StreakInfo> {
      const db = await getDatabase();

      try {
        const row = await db.getFirstAsync<{
          total_uses: number;
          current_streak: number;
          last_used_at: string | null;
        }>(
          'SELECT total_uses, current_streak, last_used_at FROM cards WHERE id = ?',
          [cardId]
        );

        if (!row) {
          throw AppError.persistence(
            ErrorCode.PERSISTENCE_NOT_FOUND,
            `Card ${cardId} not found`
          );
        }

        return {
          totalUses: row.total_uses,
          currentStreak: row.current_streak,
          lastUsedAt: row.last_used_at,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_READ_FAILED,
          `Failed to read streak info for card ${cardId}`,
          error instanceof Error ? error : undefined
        );
      }
    },

    async updateStreak(cardId: string): Promise<void> {
      const db = await getDatabase();
      await updateStreakInternal(db, cardId);
    },
  };
}

/**
 * Internal streak update logic, accepts db instance so it can be called
 * within an existing transaction.
 */
async function updateStreakInternal(
  db: Awaited<ReturnType<typeof getDatabase>>,
  cardId: string
): Promise<void> {
  const row = await db.getFirstAsync<{
    total_uses: number;
    current_streak: number;
    last_used_at: string | null;
  }>(
    'SELECT total_uses, current_streak, last_used_at FROM cards WHERE id = ?',
    [cardId]
  );

  if (!row) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_NOT_FOUND,
      `Card ${cardId} not found`
    );
  }

  const now = new Date();
  const today = startOfDay(now);

  let newStreak: number;
  const newTotalUses = row.total_uses + 1;

  if (!row.last_used_at) {
    // No previous use — start streak at 1
    newStreak = 1;
  } else {
    const lastUsedDay = startOfDay(new Date(row.last_used_at));
    const daysDiff = differenceInCalendarDays(today, lastUsedDay);

    if (daysDiff === 0) {
      // Already used today — streak unchanged
      newStreak = row.current_streak;
    } else if (daysDiff === 1) {
      // Used yesterday — extend streak
      newStreak = row.current_streak + 1;
    } else {
      // Gap > 1 day — reset streak
      newStreak = 1;
    }
  }

  await db.runAsync(
    'UPDATE cards SET total_uses = ?, current_streak = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
    [newTotalUses, newStreak, now.toISOString(), now.toISOString(), cardId]
  );
}

/**
 * Resets streaks for cards that haven't been used for more than 1 calendar day.
 * Should be called on app open.
 */
export async function resetStaleStreaks(): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  const today = startOfDay(now);

  try {
    // Get all cards with an active streak and a last_used_at value
    const cards = await db.getAllAsync<{
      id: string;
      last_used_at: string;
    }>(
      'SELECT id, last_used_at FROM cards WHERE current_streak > 0 AND last_used_at IS NOT NULL'
    );

    for (const card of cards) {
      const lastDay = startOfDay(new Date(card.last_used_at));
      const daysSince = differenceInCalendarDays(today, lastDay);

      if (daysSince > 1) {
        await db.runAsync(
          'UPDATE cards SET current_streak = 0, updated_at = ? WHERE id = ?',
          [now.toISOString(), card.id]
        );
      }
    }
  } catch (error) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to reset stale streaks',
      error instanceof Error ? error : undefined
    );
  }
}
