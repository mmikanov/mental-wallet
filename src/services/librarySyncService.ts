/**
 * Library Card Sync — pure detection service.
 *
 * PURE functions only — no DB, no React, no side effects. This keeps the
 * property-based tests fast and lets callers (FocusedCardView, the kebab menu
 * action, and the guard inside `cardService.updateFromLibrary`) all consult a
 * single source of truth for "is this wallet card outdated?".
 *
 * `evaluateOutdated` looks the curated definition up in the module-level
 * `CURATED_LIBRARY` via a normal top-level import so tests can mock
 * `../data/curatedLibrary` with a mutable fixture behind a getter.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 2.5
 */

import type { Card, Control } from '../types';
import {
  CURATED_LIBRARY,
  type CuratedCardDefinition,
  type CuratedControlDefinition,
} from '../data/curatedLibrary';
import { KPI_CARD_DEFINITION } from '../data/kpiCardDefinition';

/**
 * Resolve a curated definition by `source_library_id`, including the off-library
 * built-in Daily Check-in card (`lib-personal-kpi`).
 *
 * The check-in card deliberately lives OUTSIDE `CURATED_LIBRARY` (see
 * `kpiCardDefinition.ts`) so it never leaks into listing surfaces. This resolver
 * is the single sync-path seam that lets the version-based "Update available"
 * flow see it: both `evaluateOutdated` and `cardService.updateFromLibrary` route
 * their curated lookup through here (Req 6.2, 6.3). Listing surfaces
 * (`getMergedLibrary`, recommendations, onboarding, export, correlationEngine)
 * intentionally do NOT use this — they keep reading `CURATED_LIBRARY` directly
 * (Req 6.4).
 */
export function resolveCuratedDefinition(
  sourceLibraryId: string | null | undefined
): CuratedCardDefinition | null {
  if (!sourceLibraryId) return null;
  if (sourceLibraryId === KPI_CARD_DEFINITION.id) return KPI_CARD_DEFINITION;
  return CURATED_LIBRARY.find((c) => c.id === sourceLibraryId) ?? null;
}

export interface OutdatedResult {
  isOutdated: boolean;
  /** null when not applicable (no source_library_id, curated missing, or unversioned). */
  curatedVersion: number | null;
  curated: CuratedCardDefinition | null;
}

/**
 * Req 1.3 / 1.4 / 1.5 / 2.5.
 *
 * A wallet/archived card is **outdated IFF** all of the following hold:
 *  - it has a `sourceLibraryId` (treat '' as "no source", same as null);
 *  - a curated card with that id still exists in `CURATED_LIBRARY`;
 *  - that curated card's `version` is non-null;
 *  - the copy's stored `sourceLibraryVersion` is null OR less than the curated version.
 *
 * `curatedVersion` and `curated` are populated (from the found def) even when
 * the card is not outdated, so callers can reuse the lookup.
 */
export function evaluateOutdated(card: Card): OutdatedResult {
  const hasSourceLibraryId =
    card.sourceLibraryId != null && card.sourceLibraryId !== '';

  if (!hasSourceLibraryId) {
    return { isOutdated: false, curatedVersion: null, curated: null };
  }

  const curated = resolveCuratedDefinition(card.sourceLibraryId);

  if (curated == null) {
    return { isOutdated: false, curatedVersion: null, curated: null };
  }

  const curatedVersion = curated.version ?? null;

  const isOutdated =
    curatedVersion != null &&
    (card.sourceLibraryVersion == null ||
      card.sourceLibraryVersion < curatedVersion);

  return { isOutdated, curatedVersion, curated };
}

/**
 * Reconciliation plan between the card's current controls and the curated
 * definition's controls, matched by **position** (the stable identity for
 * curated cards — the copy was created preserving positions). Used by the
 * in-place update to avoid the history-destroying delete-and-reinsert pattern.
 *
 *  - A target position that also exists in `current` → `toUpdate`
 *    ({ id: currentControl.id, target }), keeping the current control's UUID so
 *    its historical `control_values` references stay valid.
 *  - A target position with no matching current control → `toInsert`.
 *  - A current position with no matching target → `toDeleteIds`
 *    (the current control's id).
 *
 * Comparison style borrowed from `adminCardService.isOverrideMatchingStatic`,
 * but matching is by position rather than id-equality.
 */
export function diffControls(
  current: Control[],
  target: CuratedControlDefinition[]
): {
  toUpdate: { id: string; target: CuratedControlDefinition }[];
  toInsert: CuratedControlDefinition[];
  toDeleteIds: string[];
} {
  const currentByPosition = new Map<number, Control>();
  for (const control of current) {
    currentByPosition.set(control.position, control);
  }

  const targetPositions = new Set<number>();
  const toUpdate: { id: string; target: CuratedControlDefinition }[] = [];
  const toInsert: CuratedControlDefinition[] = [];

  for (const targetControl of target) {
    targetPositions.add(targetControl.position);
    const existing = currentByPosition.get(targetControl.position);
    if (existing) {
      toUpdate.push({ id: existing.id, target: targetControl });
    } else {
      toInsert.push(targetControl);
    }
  }

  const toDeleteIds: string[] = [];
  for (const control of current) {
    if (!targetPositions.has(control.position)) {
      toDeleteIds.push(control.id);
    }
  }

  return { toUpdate, toInsert, toDeleteIds };
}

/** Extract a human label from a control/curated config. Narrows the ControlConfig
 * union safely: most configs carry `label`; `static_text` carries `title`/`body`
 * instead. Returns undefined when nothing usable is present. */
function extractLabel(config: unknown): string | undefined {
  if (config == null || typeof config !== 'object') return undefined;
  const c = config as { label?: unknown; title?: unknown; body?: unknown };
  if (typeof c.label === 'string' && c.label.length > 0) return c.label;
  if (typeof c.title === 'string' && c.title.length > 0) return c.title;
  if (typeof c.body === 'string' && c.body.length > 0) return c.body;
  return undefined;
}

/**
 * Addendum 2 — pure, per-card "what changed" summary.
 *
 * Derives plain-language lines describing how the curated definition differs from
 * the wallet card's current content, matched by control **position** (via
 * `diffControls`) plus a shell-field comparison. Written for humans, not
 * developers. PURE — no DB, no React.
 *
 * Rules (design "Addendum 2 → Per-card change summary"):
 *  - same-position control whose type becomes `text_area` (from anything else) →
 *    "Makes the '{label}' field bigger, for longer entries" (preferred over the
 *    generic update line for that control).
 *  - added control (`toInsert`)   → "Adds a new step: '{label}'" (fallback
 *    "Adds a new step: 'a new field'" when no usable label).
 *  - removed control (`toDeleteIds`) → "Removes the '{label}' step".
 *  - other same-position config change (same type, config differs) →
 *    "Updates the '{label}' field".
 *  - shell: title → "Updates the title"; description → "Updates the description";
 *    icon/background/category → "Refreshes the look" (emitted at most once).
 *  - fallback (never empty, Property 11): if nothing describable changed, return
 *    exactly ["We've improved this tool."].
 *
 * KPI exclusion (Property 12 / Req 7.2): for the check-in card
 * (`sourceLibraryId === KPI_CARD_DEFINITION.id`) the position-0 mood_slider label
 * differs (personalized wallet copy vs template) but that is NOT a real change, so
 * position 0 is excluded from the control diff entirely. The position-1 note
 * widening is still reported.
 *
 * Validates: Requirements 8.5, 7.2
 */
export function summarizeUpdate(
  card: Card,
  curated: CuratedCardDefinition
): string[] {
  const lines: string[] = [];

  const isCheckIn = card.sourceLibraryId === KPI_CARD_DEFINITION.id;

  // For the check-in card, drop position 0 (mood_slider) from BOTH sides so its
  // personalized-vs-template label difference is never surfaced.
  const currentControls = isCheckIn
    ? card.controls.filter((c) => c.position !== 0)
    : card.controls;
  const targetControls = isCheckIn
    ? curated.controls.filter((c) => c.position !== 0)
    : curated.controls;

  const { toUpdate, toInsert, toDeleteIds } = diffControls(
    currentControls,
    targetControls
  );

  // Same-position changes.
  const currentById = new Map(currentControls.map((c) => [c.id, c]));
  for (const { id, target } of toUpdate) {
    const existing = currentById.get(id);
    if (!existing) continue;

    const label = extractLabel(target.config) ?? extractLabel(existing.config);
    const labelText = label ?? 'the';

    // text_area widening takes precedence over the generic update line.
    if (target.type === 'text_area' && existing.type !== 'text_area') {
      lines.push(`Makes the '${labelText}' field bigger, for longer entries`);
      continue;
    }

    const typeChanged = existing.type !== target.type;
    const configChanged =
      JSON.stringify(existing.config) !== JSON.stringify(target.config);
    if (typeChanged || configChanged) {
      lines.push(`Updates the '${labelText}' field`);
    }
  }

  // Added controls.
  for (const target of toInsert) {
    const label = extractLabel(target.config) ?? 'a new field';
    lines.push(`Adds a new step: '${label}'`);
  }

  // Removed controls — look up the removed control to name it.
  const deleteIdSet = new Set(toDeleteIds);
  for (const control of currentControls) {
    if (!deleteIdSet.has(control.id)) continue;
    const label = extractLabel(control.config) ?? 'a';
    lines.push(`Removes the '${label}' step`);
  }

  // Shell fields.
  if (card.title !== curated.title) {
    lines.push('Updates the title');
  }
  if (card.description !== curated.description) {
    lines.push('Updates the description');
  }

  const lookChanged =
    card.iconType !== curated.iconType ||
    card.iconValue !== curated.iconValue ||
    card.backgroundType !== curated.backgroundType ||
    card.backgroundValue !== curated.backgroundValue ||
    card.categoryId !== curated.categoryId;
  if (lookChanged) {
    lines.push('Refreshes the look');
  }

  if (lines.length === 0) {
    return ["We've improved this tool."];
  }

  return lines;
}
