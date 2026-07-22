/**
 * DurationService implementation.
 * Handles persistence, querying, and statistics for duration records
 * that track active engagement time per card session.
 *
 * Validates: Requirements 1.2, 1.6, 1.7, 2.1, 2.2, 2.3, 7.1, 7.3
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from '../data/database';

// --- Types ---

export type DurationEndStatus = 'completed' | 'collapsed' | 'timed_out';

export interface DurationRecord {
  id: string;
  cardId: string;
  startedAt: string; // UTC ISO 8601
  endedAt: string; // UTC ISO 8601
  activeDurationSec: number; // whole seconds of foreground time
  endStatus: DurationEndStatus;
}

export interface DurationQueryOptions {
  cardId?: string;
  startDate?: string; // inclusive, ISO 8601
  endDate?: string; // inclusive, ISO 8601
  endStatus?: DurationEndStatus;
}

export interface DurationStats {
  averageDurationSec: number;
  totalRecords: number;
  recentAverageSec: number; // last 5 completed sessions
  trendDirection: 'more' | 'less' | 'consistent'; // >=15% above = more, >=15% below = less
}

export interface DurationService {
  /** Persist a duration record. Discards if activeDurationSec < 3. */
  persist(record: Omit<DurationRecord, 'id'>): Promise<DurationRecord | null>;

  /** Query duration records with flexible filters. */
  query(options: DurationQueryOptions): Promise<DurationRecord[]>;

  /** Get computed stats for a card (requires min 3 completed records). Optionally filter by startDate. */
  getStats(cardId: string, startDate?: string): Promise<DurationStats | null>;

  /** Get average active duration for a card (for weighting). */
  getCardAverageDuration(cardId: string): Promise<number | null>;

  /** Delete all duration records (for data reset). */
  deleteAll(): Promise<void>;
}

// --- Service Implementation ---

export function createDurationService(): DurationService {
  return {
    async persist(
      record: Omit<DurationRecord, 'id'>
    ): Promise<DurationRecord | null> {
      // Discard records with activeDurationSec < 3 (accidental interactions)
      if (record.activeDurationSec < 3) {
        return null;
      }

      const db = await getDatabase();
      const id = Crypto.randomUUID();

      try {
        await db.runAsync(
          `INSERT INTO duration_records (id, card_id, started_at, ended_at, active_duration_sec, end_status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            record.cardId,
            record.startedAt,
            record.endedAt,
            record.activeDurationSec,
            record.endStatus,
          ]
        );

        return {
          id,
          cardId: record.cardId,
          startedAt: record.startedAt,
          endedAt: record.endedAt,
          activeDurationSec: record.activeDurationSec,
          endStatus: record.endStatus,
        };
      } catch (error) {
        // Log error silently, return null — failed duration records are non-critical
        console.warn(
          '[DurationService] Failed to persist duration record:',
          error
        );
        return null;
      }
    },

    async query(options: DurationQueryOptions): Promise<DurationRecord[]> {
      const db = await getDatabase();

      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (options.cardId) {
        conditions.push('card_id = ?');
        params.push(options.cardId);
      }

      if (options.startDate) {
        conditions.push('started_at >= ?');
        params.push(options.startDate);
      }

      if (options.endDate) {
        conditions.push('started_at <= ?');
        params.push(options.endDate);
      }

      if (options.endStatus) {
        conditions.push('end_status = ?');
        params.push(options.endStatus);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      try {
        const rows = await db.getAllAsync<{
          id: string;
          card_id: string;
          started_at: string;
          ended_at: string;
          active_duration_sec: number;
          end_status: string;
        }>(
          `SELECT id, card_id, started_at, ended_at, active_duration_sec, end_status
           FROM duration_records ${whereClause}
           ORDER BY started_at DESC`,
          params
        );

        return rows.map((row) => ({
          id: row.id,
          cardId: row.card_id,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          activeDurationSec: row.active_duration_sec,
          endStatus: row.end_status as DurationEndStatus,
        }));
      } catch (error) {
        console.warn('[DurationService] Failed to query duration records:', error);
        return [];
      }
    },

    async getStats(cardId: string, startDate?: string): Promise<DurationStats | null> {
      const db = await getDatabase();

      try {
        // Get all completed records for this card, ordered by started_at DESC
        const params: (string | number)[] = [cardId];
        let dateFilter = '';
        if (startDate) {
          dateFilter = ' AND started_at >= ?';
          params.push(startDate);
        }

        const rows = await db.getAllAsync<{
          active_duration_sec: number;
        }>(
          `SELECT active_duration_sec FROM duration_records
           WHERE card_id = ? AND end_status = 'completed'${dateFilter}
           ORDER BY started_at DESC`,
          params
        );

        const totalRecords = rows.length;

        // Require minimum 3 completed records
        if (totalRecords < 3) {
          return null;
        }

        // Compute overall average
        const allDurations = rows.map((r) => r.active_duration_sec);
        const totalSum = allDurations.reduce((sum, d) => sum + d, 0);
        const averageDurationSec = Math.round(totalSum / totalRecords);

        // Compute recent average (last 5 completed sessions by started_at DESC)
        const recentDurations = allDurations.slice(0, 5);
        const recentSum = recentDurations.reduce((sum, d) => sum + d, 0);
        const recentAverageSec = Math.round(recentSum / recentDurations.length);

        // Determine trend direction (only when we have 5+ records)
        let trendDirection: 'more' | 'less' | 'consistent' = 'consistent';
        if (totalRecords >= 5) {
          if (recentAverageSec >= averageDurationSec * 1.15) {
            trendDirection = 'more';
          } else if (recentAverageSec <= averageDurationSec * 0.85) {
            trendDirection = 'less';
          }
        }

        return {
          averageDurationSec,
          totalRecords,
          recentAverageSec,
          trendDirection,
        };
      } catch (error) {
        console.warn('[DurationService] Failed to compute stats:', error);
        return null;
      }
    },

    async getCardAverageDuration(cardId: string): Promise<number | null> {
      const db = await getDatabase();

      try {
        const row = await db.getFirstAsync<{ avg_duration: number | null }>(
          `SELECT AVG(active_duration_sec) as avg_duration FROM duration_records
           WHERE card_id = ? AND end_status = 'completed'`,
          [cardId]
        );

        if (!row || row.avg_duration === null) {
          return null;
        }

        return Math.round(row.avg_duration);
      } catch (error) {
        console.warn(
          '[DurationService] Failed to get card average duration:',
          error
        );
        return null;
      }
    },

    async deleteAll(): Promise<void> {
      const db = await getDatabase();

      try {
        await db.runAsync('DELETE FROM duration_records');
      } catch (error) {
        console.warn(
          '[DurationService] Failed to delete all duration records:',
          error
        );
      }
    },
  };
}
