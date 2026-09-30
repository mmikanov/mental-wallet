/**
 * Library Card Sync (Phase 1), task 6 — developer re-arm helper (Req 5).
 *
 * This is a DEV-ONLY test aid. It puts eligible wallet cards back into the
 * "outdated" state so the "Update available" flow (pill + confirm sheet + apply)
 * can be exercised repeatedly on a single install instead of only once per card.
 *
 * The DB logic is extracted here (rather than living inline in the button) so it
 * is unit-testable against a real in-memory SQLite DB WITHOUT rendering React
 * (task 6.2). The button (`DevReArmSyncButton`) is a thin wrapper that calls
 * `reArmLibrarySync()` and then refreshes the wallet store.
 *
 * Two writes, both history-preserving (Req 5.5 — never deletes controls,
 * completions, control_values, reminders, or background_overlays; never touches
 * stats):
 *
 *   1. VERSION RESET (Req 5.2) — the primary, always-applicable re-arm:
 *      `UPDATE cards SET source_library_version = NULL WHERE source_library_id
 *      IS NOT NULL`. Every card with a curated link goes back to a null stored
 *      version, so `evaluateOutdated` reports it outdated again the moment its
 *      curated def carries a (non-null) version. Cards with no source_library_id
 *      (my_tool / community / pre-source_library_id copies) are left untouched.
 *
 *   2. TARGETED CONTENT DOWNGRADE (Req 5.3, best-effort) — so re-applying the
 *      update produces a VISIBLE change rather than a silent no-op refresh, AND
 *      so `summarizeUpdate` has a real diff to describe instead of the generic
 *      "We've improved this tool." fallback. We do NOT retain historical curated
 *      definitions, so a faithful GENERAL downgrade isn't possible — the current
 *      curated def alone can't tell us whether a `text_area` field was ALWAYS
 *      multi-line or was WIDENED from `text_input` in the last release.
 *
 *      Instead we keep an explicit `WIDENED_CONTROLS` list: exactly the
 *      (source_library_id, position) pairs that the last curated release
 *      converted `text_input` -> `text_area`. Re-arm flips each of those wallet
 *      controls back to `text_input` (in place, only when currently `text_area`).
 *      This is precise: it reverses only what the update actually changed, and
 *      leaves always-multi-line fields (e.g. Win of the Day, Decatastrophizing,
 *      the 5-4-3-2-1 SEE/TOUCH/HEAR fields, the Evidence FOR/AGAINST fields)
 *      untouched, avoiding a manufactured "made bigger" diff.
 *
 *      Each flip is a surgical, in-place `UPDATE controls SET type = 'text_input'`
 *      keyed on the card's source_library_id AND the control's position — it keeps
 *      the control's UUID (so its historical control_values stay valid) and
 *      touches nothing else. The `type = 'text_area'` guard makes re-runs no-ops.
 *
 * IMPORTANT (see admin-editing.md steering): whenever a future curated release
 * widens (or otherwise changes) a card's fields and bumps its `version`, the
 * `WIDENED_CONTROLS` list below MUST be updated in the same change. Because the
 * app stores no historical definitions, this list is the ONLY record of "what
 * the previous version looked like"; if it drifts, re-arm nulls the version but
 * can't revert the content, and the update summary shows the generic fallback
 * with no visible change (the exact bug this list prevents).
 */

import { getDatabase } from '../data/database';

/**
 * The built-in Daily Check-in tool's source id. Its note field (control
 * position 1) is the field the 1.0.5 update converts text_input -> text_area.
 * Kept as a named export for the existing button/tests; also folded into
 * WIDENED_CONTROLS below.
 */
export const CHECK_IN_SOURCE_LIBRARY_ID = 'lib-personal-kpi';

/** The check-in note field's control position (see kpiService.seedKpiCard). */
export const CHECK_IN_NOTE_CONTROL_POSITION = 1;

/** One curated control that a release widened `text_input` -> `text_area`. */
export interface WidenedControl {
  /** The card's `source_library_id`. */
  sourceLibraryId: string;
  /** The control's `position` within that card. */
  position: number;
}

/**
 * The exact set of controls the 1.0.5 curated release converted from single-line
 * `text_input` to multi-line `text_area`. Re-arm downgrades precisely these back
 * to `text_input` so the "Update available" re-apply is visible and
 * `summarizeUpdate` has a real widening to describe.
 *
 * SOURCE OF TRUTH: derived from `.kiro/specs/1.0.5-fixes/text-field-review.md`
 * (the `[x]`-marked "Convert?" rows) cross-referenced with the control positions
 * in `src/data/curatedLibrary.ts` (the cards carrying `version: 1`) plus the
 * built-in check-in note in `src/data/kpiCardDefinition.ts` (`lib-personal-kpi`).
 *
 * DELIBERATELY EXCLUDED (always multi-line — never text_input, so flipping them
 * would manufacture a false "made bigger" diff): 5-4-3-2-1 SEE/TOUCH/HEAR
 * (positions 1-3), Evidence FOR/AGAINST (positions 1-2), Win of the Day,
 * Decatastrophizing, Kind Inner Voice, and Sensory "What did you choose?"
 * (position 2 — only its maxLength changed, it stayed text_input).
 *
 * KEEP IN SYNC (see admin-editing.md): add an entry here whenever a future
 * release widens another field and bumps that card's `version`.
 */
export const WIDENED_CONTROLS: WidenedControl[] = [
  // 5-4-3-2-1 Grounding — SMELL, TASTE, Reflection (SEE/TOUCH/HEAR were always multi-line).
  { sourceLibraryId: 'lib-grounding-54321', position: 4 },
  { sourceLibraryId: 'lib-grounding-54321', position: 5 },
  { sourceLibraryId: 'lib-grounding-54321', position: 6 },
  // Thought – Feeling – Action — Thought (1) and Action (3); Feeling (2) stayed single-line.
  { sourceLibraryId: 'lib-thought-feeling-action', position: 1 },
  { sourceLibraryId: 'lib-thought-feeling-action', position: 3 },
  // Daily Mood Check-In — "What's on your mind?".
  { sourceLibraryId: 'lib-daily-mood', position: 1 },
  // Evening Gratitude — both journaling fields.
  { sourceLibraryId: 'lib-evening-gratitude', position: 1 },
  { sourceLibraryId: 'lib-evening-gratitude', position: 2 },
  // Sensory Comfort Kit — "How did it feel?" (position 3).
  { sourceLibraryId: 'lib-sensory-grounding', position: 3 },
  // Evidence For & Against — "The belief" (position 0); the evidence fields were always multi-line.
  { sourceLibraryId: 'lib-evidence-for-against', position: 0 },
  // Three Good Things — all three "good thing" fields.
  { sourceLibraryId: 'lib-gratitude-three', position: 0 },
  { sourceLibraryId: 'lib-gratitude-three', position: 1 },
  { sourceLibraryId: 'lib-gratitude-three', position: 2 },
  // Permission Slip — "I give myself permission to..." (position 1).
  { sourceLibraryId: 'lib-permission-slip', position: 1 },
  // Built-in Daily Check-in note (folds in CHECK_IN_SOURCE_LIBRARY_ID / position).
  { sourceLibraryId: CHECK_IN_SOURCE_LIBRARY_ID, position: CHECK_IN_NOTE_CONTROL_POSITION },
];

export interface ReArmResult {
  /** How many cards had their source_library_version reset to null. */
  versionResetCount: number;
  /**
   * Total number of controls downgraded text_area -> text_input across ALL wallet
   * cards (every WIDENED_CONTROLS entry whose wallet copy currently has that
   * control as text_area). 0 when no affected copies exist / all already
   * text_input.
   */
  downgradedControlCount: number;
}

/**
 * Re-arm the library-update flow for ALL eligible cards (Req 5.4 — scope stated
 * plainly by the caller's label). Returns counts for the completion alert.
 *
 * NOTE: intentionally NOT wrapped in a transaction spanning both statements —
 * each is independently safe and idempotent, and a partial failure leaves the DB
 * in a still-consistent state (a re-run simply re-applies). This is a dev aid.
 */
export async function reArmLibrarySync(): Promise<ReArmResult> {
  const db = await getDatabase();

  // 1. Version reset for every card linked to a curated definition (Req 5.2).
  const versionReset = await db.runAsync(
    `UPDATE cards SET source_library_version = NULL WHERE source_library_id IS NOT NULL`
  );

  // 2. Targeted, visible content downgrades (Req 5.3). For every WIDENED_CONTROLS
  // entry, flip that (source_library_id, position) control from text_area back to
  // text_input — in place (preserving the control's UUID / history), only when it
  // is currently text_area (so re-runs are no-ops and copies already on
  // text_input are left alone), and scoped by source_library_id so always
  // multi-line fields on other cards are never touched.
  let downgradedControlCount = 0;
  for (const { sourceLibraryId, position } of WIDENED_CONTROLS) {
    const downgrade = await db.runAsync(
      `UPDATE controls
          SET type = 'text_input'
        WHERE type = 'text_area'
          AND position = ?
          AND card_id IN (
            SELECT id FROM cards WHERE source_library_id = ?
          )`,
      [position, sourceLibraryId]
    );
    downgradedControlCount += downgrade.changes;
  }

  return {
    versionResetCount: versionReset.changes,
    downgradedControlCount,
  };
}
