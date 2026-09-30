/**
 * Canonical definition of the built-in Daily Check-in card (🌱 "My Check-In",
 * `source_library_id = 'lib-personal-kpi'`).
 *
 * WHY THIS LIVES OUTSIDE `CURATED_LIBRARY` (on purpose):
 * `lib-personal-kpi` is deliberately excluded from every `CURATED_LIBRARY`-driven
 * listing/consumer surface — the Library Browser (`getMergedLibrary`), tool
 * recommendations (`recommendationService`), onboarding suggestions
 * (`onboardingService`), export listings (`exportService`), and the correlation
 * engine (which special-cases it out). Adding this card to `CURATED_LIBRARY` would
 * leak it into all of those surfaces (violating Req 6.4). So its definition lives
 * here, resolvable by the library-sync path only.
 *
 * SINGLE SOURCE OF TRUTH:
 * Both `kpiService.seedKpiCard` (initial setup) and the library-sync resolver
 * (`librarySyncService.resolveCuratedDefinition`, task 8.3) read from this same
 * definition, so the seeded card and the update mechanism can never drift apart
 * (Req 6.1).
 *
 * `version: 1` corresponds to the 1.0.5 note-field change (single-line `text_input`
 * → multi-line `text_area`) — the first user-visible content change to the check-in
 * card, so existing installs' copies (stored at `source_library_version = null`)
 * become detectable as outdated and can opt into the update.
 */

import type { CuratedCardDefinition } from './curatedLibrary';

export const KPI_CARD_DEFINITION: CuratedCardDefinition = {
  id: 'lib-personal-kpi',
  version: 1,
  title: 'My Check-In',
  description: 'A moment to check in with yourself on what matters to you.',
  iconType: 'emoji',
  iconValue: '🌱',
  backgroundType: 'color',
  backgroundValue: '#E8F5E9',
  categoryId: 'daily-checkin-journaling',
  allowBackgroundCustomization: true,
  controls: [
    {
      // position 0 — the personalized mood question.
      //
      // The `label` here is a STRUCTURAL TEMPLATE PLACEHOLDER only; it is NEVER
      // shown to the user. Both `seedKpiCard` (at seed time) and
      // `updateFromLibrary` (task 8.5, on update) re-derive the real per-user
      // label from the user's current tracked goal via `formatKpiMoodLabel(...)`
      // and overwrite this template before/after persisting. The template exists
      // solely so the control has a well-formed `MoodSliderConfig` shape.
      type: 'mood_slider',
      position: 0,
      config: {
        label: 'How are you doing with your goal?',
        minLabel: 'Struggling',
        maxLabel: 'Thriving',
      },
      isRequired: true,
    },
    {
      // position 1 — the note field. `text_area` (multi-line) is the 1.0.5 change
      // baked in at version 1; existing copies seeded before 1.0.5 have this as a
      // single-line `text_input` and are what the update flow migrates.
      type: 'text_area',
      position: 1,
      config: {
        label: 'Anything you want to note?',
        placeholder: 'A word or thought…',
      },
      isRequired: false,
    },
  ],
};

/**
 * Canonical format for the check-in card's personalized mood-slider label.
 *
 * This is the SINGLE SOURCE OF TRUTH for the label format so `seedKpiCard`
 * (initial setup) and `updateFromLibrary`'s check-in label re-derivation
 * (task 8.5) — as well as `kpiService.updateKpiCardLabel` when the user changes
 * their goal — all produce the identical string and can never drift.
 */
export function formatKpiMoodLabel(kpiLabel: string): string {
  return `How are you doing with: ${kpiLabel.toLowerCase()}?`;
}
