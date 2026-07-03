import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import { AppError, ErrorCode } from '@/types/errors';

// --- Interfaces ---

export interface KpiRecord {
  id: string;
  value: number; // 1–10
  note: string | null; // max 200 chars
  kpiLabel: string; // label at time of recording
  recordedAt: string; // UTC ISO 8601
}

export interface KpiChangeRecord {
  previousValue: string;
  newValue: string;
  changedAt: string; // UTC ISO 8601
}

export interface KpiQueryOptions {
  startDate?: string; // inclusive, ISO 8601
  endDate?: string; // inclusive, ISO 8601
  page?: number; // default 1
  pageSize?: number; // default 50
}

export interface KpiService {
  /** Get the user's current Personal KPI label */
  getPersonalKpi(): Promise<string | null>;

  /** Set the user's Personal KPI label (persists to settings) */
  setPersonalKpi(label: string): Promise<void>;

  /** Change the KPI label and record the change in history */
  changePersonalKpi(newLabel: string): Promise<void>;

  /** Get the KPI change history */
  getChangeHistory(): Promise<KpiChangeRecord[]>;

  /** Seed the KPI card into the wallet at position 1 */
  seedKpiCard(kpiLabel: string): Promise<void>;

  /** Update the KPI card's slider label in the database */
  updateKpiCardLabel(newLabel: string): Promise<void>;

  /** Record a KPI entry */
  recordKpi(value: number, note: string | null): Promise<KpiRecord>;

  /** Query KPI records by date range, paginated */
  getRecords(options: KpiQueryOptions): Promise<KpiRecord[]>;

  /** Check if a KPI card exists in the wallet */
  kpiCardExists(): Promise<boolean>;
}

// --- Constants ---

const SETTINGS_KEY_PERSONAL_KPI = 'personal_kpi';
const SETTINGS_KEY_PERSONAL_KPI_HISTORY = 'personal_kpi_history';

// --- Validation ---

/**
 * Validates a KPI label string.
 * Must contain at least 2 non-whitespace characters and be ≤50 characters total.
 */
export function validateKpiLabel(label: string): boolean {
  if (label.length > 50) {
    return false;
  }
  const nonWhitespaceCount = label.replace(/\s/g, '').length;
  return nonWhitespaceCount >= 2;
}

// --- Factory ---

/**
 * Creates the KpiService implementation.
 */
export function createKpiService(): KpiService {
  return {
    async getPersonalKpi(): Promise<string | null> {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [SETTINGS_KEY_PERSONAL_KPI]
      );
      return row?.value ?? null;
    },

    async setPersonalKpi(label: string): Promise<void> {
      if (!validateKpiLabel(label)) {
        throw AppError.validation(
          ErrorCode.VALIDATION_EMPTY_FIELD,
          'KPI label must contain at least 2 non-whitespace characters and be at most 50 characters'
        );
      }

      const trimmed = label.trim();

      try {
        const db = await getDatabase();
        await db.runAsync(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [SETTINGS_KEY_PERSONAL_KPI, trimmed]
        );
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to persist personal KPI setting',
          error instanceof Error ? error : undefined
        );
      }
    },

    async kpiCardExists(): Promise<boolean> {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM cards WHERE source_library_id = ?',
        ['lib-personal-kpi']
      );
      return (row?.count ?? 0) > 0;
    },

    async changePersonalKpi(newLabel: string): Promise<void> {
      if (!validateKpiLabel(newLabel)) {
        throw AppError.validation(
          ErrorCode.VALIDATION_EMPTY_FIELD,
          'KPI label must contain at least 2 non-whitespace characters and be at most 50 characters'
        );
      }

      const trimmed = newLabel.trim();

      // Read current label
      const currentLabel = await this.getPersonalKpi();

      // Skip if same (Req 4.5)
      if (currentLabel === trimmed) {
        return;
      }

      try {
        const db = await getDatabase();

        // Read existing history
        const historyRow = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          [SETTINGS_KEY_PERSONAL_KPI_HISTORY]
        );
        const history: KpiChangeRecord[] = historyRow
          ? JSON.parse(historyRow.value)
          : [];

        // Append new entry
        history.push({
          previousValue: currentLabel ?? '',
          newValue: trimmed,
          changedAt: new Date().toISOString(),
        });

        // Write updated history back to settings
        await db.runAsync(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [SETTINGS_KEY_PERSONAL_KPI_HISTORY, JSON.stringify(history)]
        );

        // Update personal_kpi setting
        await db.runAsync(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [SETTINGS_KEY_PERSONAL_KPI, trimmed]
        );

        // Update the KPI card's slider label
        await this.updateKpiCardLabel(trimmed);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to change personal KPI',
          error instanceof Error ? error : undefined
        );
      }
    },

    async getChangeHistory(): Promise<KpiChangeRecord[]> {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          [SETTINGS_KEY_PERSONAL_KPI_HISTORY]
        );
        if (!row) {
          return [];
        }
        return JSON.parse(row.value) as KpiChangeRecord[];
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_READ_FAILED,
          'Failed to read KPI change history',
          error instanceof Error ? error : undefined
        );
      }
    },

    async seedKpiCard(kpiLabel: string): Promise<void> {
      const db = await getDatabase();

      // Idempotency check: skip if KPI card already exists
      const existing = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM cards WHERE source_library_id = ?',
        ['lib-personal-kpi']
      );
      if ((existing?.count ?? 0) > 0) {
        return;
      }

      const cardId = Crypto.randomUUID();
      const now = new Date().toISOString();

      // Fixed card definition
      const card = {
        id: cardId,
        title: 'My Check-In',
        description: 'A moment to check in with yourself on what matters to you.',
        iconType: 'emoji',
        iconValue: '🌱',
        backgroundType: 'color',
        backgroundValue: '#E8F5E9',
        categoryId: 'daily-checkin-journaling',
        originBadge: 'library',
        sourceLibraryId: 'lib-personal-kpi',
        allowBackgroundCustomization: 1,
      };

      // Build controls with dynamic kpiLabel for mood_slider
      const controls = [
        {
          id: Crypto.randomUUID(),
          type: 'mood_slider',
          position: 0,
          config: JSON.stringify({
            label: kpiLabel,
            minLabel: 'Not great',
            maxLabel: 'Really good',
          }),
          isRequired: 1,
        },
        {
          id: Crypto.randomUUID(),
          type: 'text_input',
          position: 1,
          config: JSON.stringify({
            label: 'Anything you want to note?',
            placeholder: 'A word or thought…',
            maxLength: 200,
          }),
          isRequired: 0,
        },
      ];

      // Use transaction: shift cards at position >= 1 down, then insert KPI card at position 1
      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Shift existing cards at position >= 1 down by 1
        await db.runAsync(
          'UPDATE cards SET stack_position = stack_position + 1 WHERE stack_position >= 1 AND is_archived = 0'
        );

        // Insert the KPI card at position 1
        await db.runAsync(
          `INSERT INTO cards (id, title, description, icon_type, icon_value, background_type, background_value, category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at, is_archived, archived_at, previous_stack_position, allow_background_customization, source_library_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, NULL, 0, NULL, NULL, ?, ?, ?, ?)`,
          [
            card.id,
            card.title,
            card.description,
            card.iconType,
            card.iconValue,
            card.backgroundType,
            card.backgroundValue,
            card.categoryId,
            card.originBadge,
            card.allowBackgroundCustomization,
            card.sourceLibraryId,
            now,
            now,
          ]
        );

        // Insert controls
        for (const control of controls) {
          await db.runAsync(
            `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              control.id,
              cardId,
              control.type,
              control.position,
              control.config,
              control.isRequired,
              now,
            ]
          );
        }

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to seed KPI card',
          error instanceof Error ? error : undefined
        );
      }
    },

    async updateKpiCardLabel(newLabel: string): Promise<void> {
      try {
        const db = await getDatabase();

        // Find the KPI card ID
        const cardRow = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM cards WHERE source_library_id = ?',
          ['lib-personal-kpi']
        );

        if (!cardRow) {
          // KPI card doesn't exist yet — nothing to update
          return;
        }

        // Find the mood_slider control for this card
        const controlRow = await db.getFirstAsync<{ id: string; config: string }>(
          'SELECT id, config FROM controls WHERE card_id = ? AND type = ?',
          [cardRow.id, 'mood_slider']
        );

        if (!controlRow) {
          // No mood_slider control found — nothing to update
          return;
        }

        // Parse config JSON, update label, stringify back
        const config = JSON.parse(controlRow.config);
        config.label = newLabel;
        const updatedConfig = JSON.stringify(config);

        // Update control config
        await db.runAsync(
          'UPDATE controls SET config = ? WHERE id = ?',
          [updatedConfig, controlRow.id]
        );

        // Update card's updated_at timestamp
        const now = new Date().toISOString();
        await db.runAsync(
          'UPDATE cards SET updated_at = ? WHERE id = ?',
          [now, cardRow.id]
        );
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to update KPI card label',
          error instanceof Error ? error : undefined
        );
      }
    },

    async recordKpi(value: number, note: string | null): Promise<KpiRecord> {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const recordedAt = new Date().toISOString();

      // Get current personal KPI label
      const kpiLabel = await this.getPersonalKpi() ?? 'Feeling good overall';

      // --- Write to kpi_records (with retry-once) ---
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await db.runAsync(
            'INSERT INTO kpi_records (id, value, note, kpi_label, recorded_at) VALUES (?, ?, ?, ?, ?)',
            [id, value, note, kpiLabel, recordedAt]
          );
          break;
        } catch (error) {
          if (attempt === 1) {
            // Second attempt failed — log silently and continue
            console.warn('KPI record write failed after retry:', error);
          }
        }
      }

      // --- Write standard completion independently ---
      try {
        // Look up the actual card ID from cards table
        const cardRow = await db.getFirstAsync<{ id: string }>(
          "SELECT id FROM cards WHERE source_library_id = ?",
          ['lib-personal-kpi']
        );

        if (cardRow) {
          const completionId = Crypto.randomUUID();
          const completedAt = recordedAt;

          await db.withTransactionAsync(async () => {
            // Insert completion record
            await db.runAsync(
              'INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)',
              [completionId, cardRow.id, completedAt]
            );

            // Look up control IDs for this card
            const controls = await db.getAllAsync<{ id: string; type: string }>(
              'SELECT id, type FROM controls WHERE card_id = ? ORDER BY position ASC',
              [cardRow.id]
            );

            // Write control values for mood_slider and text_input
            for (const control of controls) {
              const controlValueId = Crypto.randomUUID();
              let controlValue: string;

              if (control.type === 'mood_slider') {
                controlValue = String(value);
              } else if (control.type === 'text_input') {
                controlValue = note ?? '';
              } else {
                continue;
              }

              await db.runAsync(
                'INSERT INTO control_values (id, completion_id, control_id, control_type, value) VALUES (?, ?, ?, ?, ?)',
                [controlValueId, completionId, control.id, control.type, controlValue]
              );
            }

            // Update streak for the card
            const streakRow = await db.getFirstAsync<{
              total_uses: number;
              current_streak: number;
              last_used_at: string | null;
            }>(
              'SELECT total_uses, current_streak, last_used_at FROM cards WHERE id = ?',
              [cardRow.id]
            );

            if (streakRow) {
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              let newStreak: number;
              const newTotalUses = streakRow.total_uses + 1;

              if (!streakRow.last_used_at) {
                newStreak = 1;
              } else {
                const lastUsedDay = new Date(streakRow.last_used_at);
                const lastDay = new Date(lastUsedDay.getFullYear(), lastUsedDay.getMonth(), lastUsedDay.getDate());
                const daysDiff = Math.floor((today.getTime() - lastDay.getTime()) / 86_400_000);

                if (daysDiff === 0) {
                  newStreak = streakRow.current_streak;
                } else if (daysDiff === 1) {
                  newStreak = streakRow.current_streak + 1;
                } else {
                  newStreak = 1;
                }
              }

              await db.runAsync(
                'UPDATE cards SET total_uses = ?, current_streak = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
                [newTotalUses, newStreak, now.toISOString(), now.toISOString(), cardRow.id]
              );
            }
          });
        }
      } catch (error) {
        // Standard completion failure does NOT block or rollback KPI record
        console.warn('Standard completion write failed:', error);
      }

      return {
        id,
        value,
        note,
        kpiLabel,
        recordedAt,
      };
    },

    async getRecords(options: KpiQueryOptions): Promise<KpiRecord[]> {
      const db = await getDatabase();
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (options.startDate) {
        conditions.push('recorded_at >= ?');
        params.push(options.startDate);
      }
      if (options.endDate) {
        conditions.push('recorded_at <= ?');
        params.push(options.endDate);
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const rows = await db.getAllAsync<{
        id: string;
        value: number;
        note: string | null;
        kpi_label: string;
        recorded_at: string;
      }>(
        `SELECT id, value, note, kpi_label, recorded_at FROM kpi_records ${whereClause} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      return rows.map((row) => ({
        id: row.id,
        value: row.value,
        note: row.note,
        kpiLabel: row.kpi_label,
        recordedAt: row.recorded_at,
      }));
    },
  };
}
