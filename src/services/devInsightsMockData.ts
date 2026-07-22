/**
 * Dev-only mock data generator for the Usage-Outcome Insights feature.
 * Populates the database with realistic data so insights screens show meaningful content.
 *
 * Usage: Call generateInsightsMockData() from the Developer section in Settings.
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';

export interface InsightsMockDataSummary {
  kpiCount: number;
  completionCount: number;
  durationCount: number;
  outcomeCount: number;
  controlValueCount: number;
  cardCount: number;
  daysGenerated: number;
}

/**
 * Generates mock insights data for all active wallet cards.
 * Wraps all inserts in a transaction for performance.
 * Clears previously generated mock data before inserting.
 */
export async function generateInsightsMockData(days?: number): Promise<InsightsMockDataSummary> {
  const db = await getDatabase();

  // Get active wallet cards (exclude session_launcher and archived)
  const cards = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM cards WHERE is_archived = 0 AND card_type != 'session_launcher'`
  );

  if (cards.length === 0) {
    throw new Error('No active cards in wallet. Add some cards first.');
  }

  const cardIds = cards.map((c) => c.id);

  // Load each card's controls from the DB
  const cardControls = new Map<string, Array<{ id: string; type: string; config: string }>>();
  for (const cardId of cardIds) {
    const controls = await db.getAllAsync<{ id: string; type: string; config: string }>(
      'SELECT id, type, config FROM controls WHERE card_id = ? ORDER BY position',
      [cardId]
    );
    cardControls.set(cardId, controls);
  }

  // Identify which card is the KPI card
  const kpiCardRow = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM cards WHERE source_library_id = 'lib-personal-kpi' AND is_archived = 0"
  );
  const kpiCardId = kpiCardRow?.id ?? null;

  // Use provided days or fall back to random 30-100
  const totalDays = days ?? randomInt(30, 100);

  // Read KPI label from settings
  const kpiLabelRow = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'personal_kpi_label'`
  );
  const kpiLabel = kpiLabelRow?.value ?? 'Overall wellbeing';

  // Ensure outcome_responses table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS outcome_responses (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Clear ALL previous insights-related data (dev tool — safe to wipe everything)
  await db.runAsync('DELETE FROM control_values');
  await db.runAsync('DELETE FROM kpi_records');
  await db.runAsync('DELETE FROM completions');
  await db.runAsync('DELETE FROM duration_records');
  try {
    await db.runAsync('DELETE FROM outcome_responses');
  } catch {
    // Table may not exist yet
  }

  // If 0 days requested, just clear data and return
  if (totalDays <= 0) {
    // Also reset card stats
    await db.runAsync(
      `UPDATE cards SET total_uses = 0, current_streak = 0, last_used_at = NULL, updated_at = ? WHERE is_archived = 0 AND card_type != 'session_launcher'`,
      [new Date().toISOString()]
    );
    return {
      kpiCount: 0,
      completionCount: 0,
      durationCount: 0,
      outcomeCount: 0,
      controlValueCount: 0,
      cardCount: cardIds.length,
      daysGenerated: 0,
    };
  }

  // Time helpers
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // ─── Generate KPI records ───────────────────────────────────────────
  const kpiRecords: Array<{ id: string; value: number; kpi_label: string; recorded_at: string }> = [];
  const kpiCount = randomInt(Math.round(totalDays * 0.6), Math.round(totalDays * 0.85));

  // Generate day offsets (spread across totalDays with some gaps)
  const kpiDayOffsets = generateSpreadDays(kpiCount, totalDays);

  for (let i = 0; i < kpiDayOffsets.length; i++) {
    const dayOffset = kpiDayOffsets[i];
    const progress = i / (kpiDayOffsets.length - 1); // 0 to 1
    // Slight upward trend: start 4-5, end 6-7
    const baseValue = 4.5 + progress * 2;
    const value = clamp(Math.round(baseValue + (Math.random() - 0.5) * 2), 1, 10);

    const timestamp = new Date(now - dayOffset * DAY_MS);
    // Add random hour offset so they're not all at midnight
    timestamp.setHours(randomInt(7, 22), randomInt(0, 59), 0, 0);

    kpiRecords.push({
      id: Crypto.randomUUID(),
      value,
      kpi_label: kpiLabel,
      recorded_at: timestamp.toISOString(),
    });
  }

  // ─── Generate completions, durations, and outcomes ───────────────────
  const completions: Array<{ id: string; card_id: string; completed_at: string }> = [];
  const durations: Array<{
    id: string;
    card_id: string;
    started_at: string;
    ended_at: string;
    active_duration_sec: number;
    end_status: string;
  }> = [];
  const outcomes: Array<{ id: string; card_id: string; category: string; created_at: string }> = [];
  const controlValues: Array<{ id: string; completion_id: string; control_id: string; control_type: string; value: string }> = [];

  // Separate KPI days into good (>= 6) and bad (< 6) for correlation targeting
  const goodKpiDays = kpiRecords.filter(r => r.value >= 6).map(r => r.recorded_at);
  const badKpiDays = kpiRecords.filter(r => r.value < 6).map(r => r.recorded_at);

  // Assign "personality" to each card for correlation patterns
  const cardPersonalities = cardIds.map((_, index) => {
    if (index === 0) return 'positive';
    if (index === cardIds.length - 1) return 'negative';
    return Math.random() > 0.3 ? 'positive' : 'neutral';
  });

  // Assign typical duration per card
  const cardTypicalDurations = cardIds.map(() => {
    const r = Math.random();
    if (r < 0.4) return 60;
    if (r < 0.7) return 180;
    return 300;
  });

  for (let cardIndex = 0; cardIndex < cardIds.length; cardIndex++) {
    const cardId = cardIds[cardIndex];
    const personality = cardPersonalities[cardIndex];
    const typicalDuration = cardTypicalDurations[cardIndex];
    const completionCount = randomInt(8, Math.max(15, Math.round(totalDays * 0.15)));

    for (let j = 0; j < completionCount; j++) {
      let completedAt: string;

      if (personality === 'positive' && goodKpiDays.length > 0) {
        // 80% chance: pick a day near a good KPI day
        if (Math.random() < 0.8) {
          const kpiDay = goodKpiDays[randomInt(0, goodKpiDays.length - 1)];
          const baseDate = new Date(kpiDay);
          // Use the same day or the next day (D and D-1 association)
          baseDate.setHours(randomInt(7, 22), randomInt(0, 59), randomInt(0, 59), 0);
          completedAt = baseDate.toISOString();
        } else {
          // 20% random (adds noise, makes it realistic)
          const dayOffset = Math.floor(Math.random() * totalDays);
          const ts = new Date(now - dayOffset * DAY_MS);
          ts.setHours(randomInt(7, 22), randomInt(0, 59), randomInt(0, 59), 0);
          completedAt = ts.toISOString();
        }
      } else if (personality === 'negative' && badKpiDays.length > 0) {
        // 80% chance: pick a day near a bad KPI day
        if (Math.random() < 0.8) {
          const kpiDay = badKpiDays[randomInt(0, badKpiDays.length - 1)];
          const baseDate = new Date(kpiDay);
          baseDate.setHours(randomInt(7, 22), randomInt(0, 59), randomInt(0, 59), 0);
          completedAt = baseDate.toISOString();
        } else {
          const dayOffset = Math.floor(Math.random() * totalDays);
          const ts = new Date(now - dayOffset * DAY_MS);
          ts.setHours(randomInt(7, 22), randomInt(0, 59), randomInt(0, 59), 0);
          completedAt = ts.toISOString();
        }
      } else {
        // Neutral: random day spread across the period
        const dayOffset = Math.floor(Math.pow(Math.random(), 1.3) * totalDays);
        const ts = new Date(now - dayOffset * DAY_MS);
        ts.setHours(randomInt(7, 22), randomInt(0, 59), randomInt(0, 59), 0);
        completedAt = ts.toISOString();
      }

      const completionId = Crypto.randomUUID();

      completions.push({
        id: completionId,
        card_id: cardId,
        completed_at: completedAt,
      });

      // Duration record
      const durationVariance = (Math.random() - 0.5) * typicalDuration * 0.5;
      const activeDuration = Math.max(30, Math.round(typicalDuration + durationVariance));
      const startedAt = new Date(new Date(completedAt).getTime() - activeDuration * 1000);
      const endStatus = Math.random() < 0.85 ? 'completed' : 'collapsed';

      durations.push({
        id: Crypto.randomUUID(),
        card_id: cardId,
        started_at: startedAt.toISOString(),
        ended_at: completedAt,
        active_duration_sec: activeDuration,
        end_status: endStatus,
      });

      // Outcome response (~70% of completions)
      if (Math.random() < 0.7) {
        const category = pickOutcomeCategory(personality);
        outcomes.push({
          id: Crypto.randomUUID(),
          card_id: cardId,
          category,
          created_at: completedAt,
        });
      }

      // Generate control_values for this completion
      const controls = cardControls.get(cardId) ?? [];
      for (const control of controls) {
        let value: string;

        if (control.type === 'mood_slider') {
          if (cardId === kpiCardId) {
            // For KPI card: use the actual KPI score for a nearby day
            const completionTime = new Date(completedAt).getTime();
            let closestKpi = kpiRecords[0];
            let closestDist = Math.abs(new Date(closestKpi.recorded_at).getTime() - completionTime);
            for (const kpi of kpiRecords) {
              const dist = Math.abs(new Date(kpi.recorded_at).getTime() - completionTime);
              if (dist < closestDist) {
                closestDist = dist;
                closestKpi = kpi;
              }
            }
            value = String(closestKpi.value);
          } else {
            // For other cards with a mood_slider: random 1-10
            value = String(randomInt(3, 9));
          }
        } else if (control.type === 'text_input') {
          // Optional text — leave empty most of the time, occasionally add a note
          value = Math.random() < 0.2 ? 'Feeling okay today' : '';
        } else if (control.type === 'checkbox') {
          value = Math.random() < 0.7 ? 'true' : 'false';
        } else if (control.type === 'choice_buttons') {
          // Pick a random choice from the config
          try {
            const config = JSON.parse(control.config);
            const choices = config.choices ?? config.options ?? ['Option 1'];
            value = choices[randomInt(0, choices.length - 1)];
          } catch {
            value = 'Option 1';
          }
        } else {
          // Default: empty string for unknown types
          value = '';
        }

        controlValues.push({
          id: Crypto.randomUUID(),
          completion_id: completionId,
          control_id: control.id,
          control_type: control.type,
          value,
        });
      }
    }
  }

  // ─── Insert all data in a transaction ──────────────────────────────
  await db.execAsync('BEGIN TRANSACTION');
  try {
    // Insert KPI records
    for (const kpi of kpiRecords) {
      await db.runAsync(
        `INSERT INTO kpi_records (id, value, note, kpi_label, recorded_at) VALUES (?, ?, NULL, ?, ?)`,
        [kpi.id, kpi.value, kpi.kpi_label, kpi.recorded_at]
      );
    }

    // Insert completions
    for (const comp of completions) {
      await db.runAsync(
        `INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)`,
        [comp.id, comp.card_id, comp.completed_at]
      );
    }

    // Insert duration records
    for (const dur of durations) {
      await db.runAsync(
        `INSERT INTO duration_records (id, card_id, started_at, ended_at, active_duration_sec, end_status) VALUES (?, ?, ?, ?, ?, ?)`,
        [dur.id, dur.card_id, dur.started_at, dur.ended_at, dur.active_duration_sec, dur.end_status]
      );
    }

    // Insert outcome responses
    for (const out of outcomes) {
      await db.runAsync(
        `INSERT INTO outcome_responses (id, card_id, category, created_at) VALUES (?, ?, ?, ?)`,
        [out.id, out.card_id, out.category, out.created_at]
      );
    }

    // Insert control_values
    for (const cv of controlValues) {
      await db.runAsync(
        'INSERT INTO control_values (id, completion_id, control_id, control_type, value) VALUES (?, ?, ?, ?, ?)',
        [cv.id, cv.completion_id, cv.control_id, cv.control_type, cv.value]
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  // ─── Sync card stats with generated completions ────────────────────
  for (const cardId of cardIds) {
    const statsRow = await db.getFirstAsync<{ cnt: number; latest: string | null }>(
      `SELECT COUNT(*) as cnt, MAX(completed_at) as latest FROM completions WHERE card_id = ?`,
      [cardId]
    );
    if (statsRow) {
      await db.runAsync(
        `UPDATE cards SET total_uses = ?, last_used_at = ?, current_streak = 1, updated_at = ? WHERE id = ?`,
        [statsRow.cnt, statsRow.latest, new Date().toISOString(), cardId]
      );
    }
  }

  return {
    kpiCount: kpiRecords.length,
    completionCount: completions.length,
    durationCount: durations.length,
    outcomeCount: outcomes.length,
    controlValueCount: controlValues.length,
    cardCount: cardIds.length,
    daysGenerated: totalDays,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generate `count` day offsets spread somewhat evenly across `totalDays`,
 * with some natural gaps.
 */
function generateSpreadDays(count: number, totalDays: number): number[] {
  const days: number[] = [];
  const step = totalDays / count;
  for (let i = 0; i < count; i++) {
    const base = Math.round(i * step);
    const jitter = Math.round((Math.random() - 0.5) * step * 0.6);
    const day = clamp(base + jitter, 0, totalDays - 1);
    days.push(day);
  }
  // Remove duplicates and sort descending (most recent first = smallest offset)
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique;
}

/**
 * Pick an outcome category weighted by the card's personality.
 * Positive cards: mostly calmer/clear/hopeful
 * Negative cards: mostly same/worse
 * Neutral: mixed
 */
function pickOutcomeCategory(personality: string): string {
  const r = Math.random();

  if (personality === 'positive') {
    // 70% positive, 20% same, 10% worse
    if (r < 0.3) return 'calmer';
    if (r < 0.55) return 'clear';
    if (r < 0.7) return 'hopeful';
    if (r < 0.9) return 'same';
    return 'worse';
  }

  if (personality === 'negative') {
    // 25% positive, 35% same, 40% worse
    if (r < 0.1) return 'calmer';
    if (r < 0.2) return 'clear';
    if (r < 0.25) return 'hopeful';
    if (r < 0.6) return 'same';
    return 'worse';
  }

  // Neutral: standard distribution (60% positive, 25% same, 15% worse)
  if (r < 0.25) return 'calmer';
  if (r < 0.45) return 'clear';
  if (r < 0.6) return 'hopeful';
  if (r < 0.85) return 'same';
  return 'worse';
}
