# Implementation Plan: Personal KPI

## Overview

This plan implements the Personal KPI feature — a user-defined progress indicator chosen during onboarding. The implementation covers database migration, service layer, Zustand store, onboarding screen integration, KPI card seeding, settings modification flow, and property-based tests. Tasks are ordered to build infrastructure first, then core logic, then UI, and finally integration/wiring.

## Tasks

- [x] 1. Database migration and data layer
  - [x] 1.1 Add `runKpiMigration()` to `src/data/migrations.ts`
    - Create a `runKpiMigration(db)` function that executes `CREATE TABLE IF NOT EXISTS kpi_records` with columns: `id TEXT PRIMARY KEY`, `value INTEGER NOT NULL CHECK(value >= 1 AND value <= 10)`, `note TEXT`, `kpi_label TEXT NOT NULL`, `recorded_at TEXT NOT NULL`
    - Create index `idx_kpi_records_recorded_at` on `kpi_records(recorded_at)`
    - Call `runKpiMigration(db)` from the existing `runMigrations()` function
    - Follow the same idempotent pattern as `runEmotionMigration`
    - _Requirements: 5.1, 5.2, 5.6_

- [x] 2. KPI service implementation
  - [x] 2.1 Create `src/services/kpiService.ts` with core interface and factory function
    - Implement `createKpiService()` returning the `KpiService` interface
    - Implement `getPersonalKpi()` — reads `personal_kpi` from settings table
    - Implement `setPersonalKpi(label)` — validates label (≥2 non-whitespace chars, ≤50 chars), trims whitespace, persists to settings table via `INSERT OR REPLACE`
    - Implement `kpiCardExists()` — checks if a card with `source_library_id = 'lib-personal-kpi'` exists
    - _Requirements: 1.3, 1.4, 5.3_

  - [x] 2.2 Implement `seedKpiCard` in kpiService
    - Check if KPI card already exists (idempotent, Req 2.2)
    - Build card shell with fixed definition: id `lib-personal-kpi`, title "My Check-In", description "A moment to check in with yourself on what matters to you.", icon emoji "🌱", background color "#E8F5E9", category "daily-checkin-journaling"
    - Build controls array with mood_slider (position 0, required, label = kpiLabel, minLabel "Not great", maxLabel "Really good") and text_input (position 1, not required, label "Anything you want to note?", placeholder "A word or thought…", maxLength 200)
    - Insert card at stack position 1 using a transaction: shift cards at position ≥ 1 down, insert KPI card at position 1
    - Use `source_library_id = 'lib-personal-kpi'` for duplicate detection
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Implement `recordKpi` and `getRecords` in kpiService
    - `recordKpi(value, note)`: generate UUID, get current `personal_kpi` label, insert into `kpi_records` table, also write standard completion to `completions` + `control_values` tables independently
    - Implement retry-once logic for KPI record write; failures of one write do not block the other
    - `getRecords(options)`: query `kpi_records` by date range (inclusive), order by `recorded_at DESC`, paginate with default pageSize 50
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.5_

  - [x] 2.4 Implement `changePersonalKpi` and `updateKpiCardLabel` in kpiService
    - `changePersonalKpi(newLabel)`: read current label, skip if same (Req 4.5), append to `personal_kpi_history` JSON array in settings, update `personal_kpi` setting, call `updateKpiCardLabel`
    - `updateKpiCardLabel(newLabel)`: find the mood_slider control for the KPI card, update its `config` JSON to set the new label, update card `updated_at`
    - `getChangeHistory()`: read and parse `personal_kpi_history` from settings
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 5.4_

  - [x] 2.5 Write property tests for kpiService (`src/services/__tests__/kpiService.property.test.ts`)
    - **Property 1: Custom KPI text validation** — For any string, validation accepts iff ≥2 non-whitespace chars AND length ≤50; persisted value equals trimmed input
    - **Validates: Requirements 1.4**

  - [x] 2.6 Write property tests for KPI card seeding
    - **Property 2: KPI card seeding correctness** — For any valid label, seeded card has correct id, origin badge, position 1, 2 controls with correct config
    - **Property 3: KPI card seeding idempotency** — Multiple seedKpiCard calls result in at most one KPI card
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

  - [x] 2.7 Write property tests for KPI record operations
    - **Property 4: KPI record storage round-trip** — Write then read yields identical value, note, and kpi_label
    - **Property 5: KPI dual-write correctness** — Both kpi_records and completions are written independently
    - **Property 6: KPI date range query correctness** — Query returns only records in range, newest first, ≤ pageSize
    - **Validates: Requirements 3.1, 3.3, 3.6, 5.5**

  - [x] 2.8 Write property tests for KPI label change
    - **Property 7: KPI label change propagation** — changePersonalKpi updates both setting and card control label
    - **Property 8: KPI change history correctness** — History grows by 1 only when label differs; entries have correct values
    - **Property 9: KPI change preserves existing records** — Existing KPI_Records remain unchanged after label change
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 3. Checkpoint - Ensure service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. KPI Zustand store and onboarding store updates
  - [x] 4.1 Create `src/stores/kpiStore.ts`
    - Define `KpiState` interface with `personalKpi: string | null`, `isLoading: boolean`
    - Implement actions: `loadKpi()` (reads from kpiService), `setKpi(label)` (calls kpiService.setPersonalKpi), `changeKpi(newLabel)` (calls kpiService.changePersonalKpi)
    - Use Zustand `create` following existing store patterns
    - _Requirements: 1.3, 4.3_

  - [x] 4.2 Update `src/stores/onboardingStore.ts` with KPI selection support
    - Add `kpiSelectionComplete: boolean` to `PersistedState` interface and `OnboardingState` (default: false)
    - Add `completeKpiSelection: () => Promise<void>` action that sets `kpiSelectionComplete` to true and persists
    - Update `loadState()` to handle legacy detection: if `onboardingScreensComplete` is true but `kpiSelectionComplete` is undefined/missing, set it to true (Req 8.4)
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 4.3 Write property test for legacy user detection
    - **Property 10: Legacy user detection and migration** — For any state with disclaimer_acknowledged=true and onboardingScreensComplete=true without kpiSelectionComplete, system sets kpiSelectionComplete=true
    - **Validates: Requirements 8.4**

- [x] 5. Onboarding service and navigation updates
  - [x] 5.1 Update `src/services/onboardingService.ts` for KPI card seeding
    - Add `seedKpiCard(kpiLabel: string)` method to `OnboardingService` interface
    - Implementation delegates to `kpiService.seedKpiCard(kpiLabel)`
    - Update Skip_Intro path to seed KPI card with default label "Feeling good overall"
    - _Requirements: 2.1, 2.6, 8.6_

  - [x] 5.2 Update navigation types and OnboardingNavigator
    - Add `KpiSelection: undefined` to `OnboardingStackParamList` in `src/navigation/OnboardingNavigator.tsx`
    - Add `KpiChange: undefined` to `RootStackParamList` in `src/navigation/types.ts`
    - Register KpiSelectionScreen in the OnboardingNavigator Stack between IntentSelection and wallet
    - _Requirements: 8.1_

- [x] 6. KPI Selection Screen (onboarding)
  - [x] 6.1 Create `src/screens/onboarding/KpiSelectionScreen.tsx`
    - Display warm intro question (≤30 words, 8th-grade reading level): e.g., "What does feeling better look like for you?"
    - Render 7 KPI_Options as tappable choice buttons matching IntentSelectionScreen pattern (44×44pt min tap targets)
    - Implement single-selection behavior (tapping new option deselects previous)
    - Handle "Other" selection: show TextInput (max 50 chars, placeholder "What matters most to you…"), disable Continue until ≥2 non-whitespace chars
    - On predefined selection: persist via kpiStore.setKpi, call seedKpiCard, set kpiSelectionComplete, navigate forward
    - On custom text confirm: trim whitespace, persist, seed card, complete selection
    - "Skip" affordance (44×44pt tap target, label "Skip" or "I'll decide later"): sets default "Feeling good overall", seeds card, completes
    - Support back navigation to IntentSelection (resets selection state on return)
    - Screen reader focus order, accessible labels, live region for validation errors
    - No forbidden words (KPI, metric, data, tracking, score, performance, measurement)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.5_

  - [x] 6.2 Write unit tests for KpiSelectionScreen (`src/services/__tests__/kpiService.test.ts`)
    - Test skip sets default "Feeling good overall"
    - Test fixed card metadata matches spec (title, icon, description)
    - Test validation rejects <2 non-whitespace chars and >50 chars
    - Test forbidden words not present in any UI strings
    - Test predefined options list is exactly 7 items
    - _Requirements: 1.2, 1.4, 1.5, 2.5, 6.1_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Settings integration and KPI change screen
  - [x] 8.1 Add "What I'm focusing on" row to `src/screens/SettingsScreen.tsx`
    - Add a new section or row before the Data section showing current personalKpi text with a chevron
    - Minimum tap target 44×44 points
    - Tapping navigates to KpiChange screen
    - Load current KPI from kpiStore on mount
    - _Requirements: 4.1, 7.2_

  - [x] 8.2 Create `src/screens/KpiChangeScreen.tsx`
    - Display same 7 KPI_Options with current selection highlighted
    - Handle predefined selection: call kpiStore.changeKpi(newLabel), navigate back to Settings
    - Handle "Other" selection with pre-filled text input if current KPI is custom
    - "Save" button for custom text (disabled until valid)
    - If same option selected → return without creating change history record
    - Back/dismiss without selection retains current KPI
    - No forbidden words in UI text
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 6.1, 6.2_

- [x] 9. Onboarding navigation guard wiring
  - [x] 9.1 Update navigation guard logic for KPI selection gate
    - Modify the root navigation logic so that the wallet is only shown when both `onboardingScreensComplete` AND `kpiSelectionComplete` are true
    - Update `completeOnboardingScreens` action to navigate to KpiSelection instead of directly to wallet
    - Handle the "Skip intro" (Welcome screen) path: set both flags true, seed KPI card with default, navigate to wallet
    - Ensure app resumes at KpiSelectionStep if closed mid-flow (Req 1.6, 8.3)
    - _Requirements: 8.2, 8.3, 8.6, 8.7, 1.6_

  - [x] 9.2 Write unit tests for navigation guard
    - Test that wallet requires both flags true
    - Test that legacy users bypass KPI selection
    - Test Skip_Intro path seeds KPI card with default
    - _Requirements: 8.2, 8.4, 8.6_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The KPI card uses `source_library_id = 'lib-personal-kpi'` for duplicate detection since the card `id` is auto-generated via `expo-crypto`
- The design specifies TypeScript throughout — all implementations use TypeScript with strict mode

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1", "4.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "5.1"] },
    { "id": 3, "tasks": ["2.5", "2.6", "2.7", "2.8", "4.3", "5.2"] },
    { "id": 4, "tasks": ["6.1", "8.1", "8.2"] },
    { "id": 5, "tasks": ["6.2", "9.1"] },
    { "id": 6, "tasks": ["9.2"] }
  ]
}
```
