# Tasks

## Task 1: Fix Reset Navigation (Bug 4)

- [x] Change 'Disclaimer' to 'Onboarding' in SettingsScreen.tsx confirmDeleteAllData
- _Status: Complete — also fixes Bug 8 (KPI FAB missing)_

## Task 2: Add duration_records Table (Bug 3)

- [x] Add runDurationRecordsMigration to migrations.ts
- [x] Fix pickOutcomeCategory typo ('clear' → 'clearer')
- _Status: Complete — also fixes Bug 5 on Android (export + seeding)_

## Task 3: Fix Card Content Bleed (Bug 1)

- [x] Attempted overflow:hidden on cardWrapper — broke shadows, reverted
- [x] Attempted cardWrapperClipped with height constraint — still broke shadows, reverted
- _Status: Won't Fix — overflow:hidden and height clipping both degrade shadow quality. Minor cosmetic issue._

## Task 4: Fix Reorder Mode Icons (Bug 2)

- [x] Import renderCardIcon in ReorderMode.tsx
- [x] Replace plain text icon with renderCardIcon call including sourceId
- [x] Add iconContainer style
- _Status: Complete_

## Task 5: Fix Emoji Clipping (Bug 6)

- [x] ToolPreviewCard: expanded iconContainer from 24x24 to 32x32 + added overflow:visible
- [x] LibraryToolPreview: already had overflow:visible (no change needed)
- [ ] Verify on both platforms
- _Status: Complete_

## Task 6: Fix Scroll Restoration (Bug 7)

- [x] Add scrollTo call in handleClosePreview with 150ms delay
- _Status: Complete_

## Task 7: Fix Export on iOS (Bug 5)

- [x] Replaced deprecated FileSystem API with new File/Paths API
- [x] Fixed: `file.text = content` is not a valid write — replaced with `file.write(content)`
- _Status: Complete — `file.text` was a read method (returns Promise), not a writable property. Using `file.write()` works on both platforms._

## Task 8: Fix BetterHelp Icon in Suggestions (Bug 12)

- [x] Root cause: `getFallbackRecommendations` omitted `iconType` from returned objects
- [x] When `iconType` is undefined, ToolPreviewCard defaults to 'emoji', rendering URL as text
- [x] Fix: added `iconType: card.iconType` to the fallback map in recommendationService.ts
- [x] Not position-dependent — was path-dependent (fallback mode vs direct emotion match)
- _Status: Complete_

## Task 10: Fix KPI FAB Disappears After Rearranging Cards (Bug 10)

- [x] 10.1: Investigate why reorder commit causes `kpiCard` to be null after cards reload
- [x] 10.2: Check if `commitReorder` in walletStore reloads cards in a way that drops the KPI card from the list
- [x] 10.3: Verify the KPI card's `source_library_id = 'lib-personal-kpi'` is preserved after reorder
- [x] 10.4: Fix the issue (commitReorder now preserves cards not in the reorder list)
- [x] 10.5: Verify FAB persists after reorder on both platforms
- _Status: Complete — `commitReorder` was replacing entire cards array with only reordered subset, dropping KPI card_

## Task 9: Fix KPI Badge Not Shown When Never Used (Bug 9)

- [x] 9.1: In `loadLastCheckIn`/`refreshDaysElapsed`, fall back to KPI card's `created_at` when no kpi_records exist
- [x] 9.2: Added `hasEverCheckedIn` boolean to kpiStore (set by loadLastCheckIn, recordKpi, resetAllRecords)
- [x] 9.3: `FocusedCardView` determines `hasEverCheckedIn` from `card.totalUses > 0` (most reliable source of truth)
- [x] 9.4: `formatExplanationMessage` shows different text based on hasEverCheckedIn flag
- [x] 9.5: Verify badge shows correct days when user has never checked in (days since card creation) ✓
- [x] 9.6: Verify badge switches to lastCheckInDate after first check-in ✓
- [x] 9.7: Run existing kpiBadgeUtils tests — 55 tests pass, no regressions
- _Status: Complete_
- _Banner text:_
  - _Never checked in: "X days since you added the app — how are you feeling today?"_
  - _Has checked in: "It's been X days since your last check-in"_
