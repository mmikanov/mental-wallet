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
- [ ] Investigate alternative approach (separate shadow wrapper or increased elevation)
- _Status: Open — low priority_

## Task 4: Fix Reorder Mode Icons (Bug 2)

- [x] Import renderCardIcon in ReorderMode.tsx
- [x] Replace plain text icon with renderCardIcon call including sourceId
- [x] Add iconContainer style
- _Status: Complete_

## Task 5: Fix Emoji Clipping (Bug 6)

- [ ] Add overflow:visible to icon containers in ToolPreviewCard and LibraryToolPreview
- [ ] Verify on both platforms
- _Status: Open — low priority_

## Task 6: Fix Scroll Restoration (Bug 7)

- [x] Add scrollTo call in handleClosePreview with 150ms delay
- _Status: Complete_

## Task 7: Fix Export on iOS (Bug 5)

- [x] Replaced deprecated FileSystem API with new File/Paths API
- [ ] Investigate why new API fails on iOS (works on Android)
- [ ] May need platform-conditional fallback to legacy API on iOS
- _Status: Open — works on Android, broken on iOS_

## Task 8: Fix BetterHelp Icon in Suggestions

- [ ] Debug why BetterHelp specifically doesn't show icon (other apps work)
- [ ] Check recommendation service output for BetterHelp iconType
- [ ] Verify asset loading for betterhelp.jpg specifically
- _Status: Open_

## Task 9: Fix KPI Badge Not Shown When Never Used (Bug 9)

- [ ] 9.1: Add `kpiCardCreatedAt: string | null` field to `KpiState` interface in `src/stores/kpiStore.ts`
- [ ] 9.2: In `loadLastCheckIn`, query the KPI card's `created_at` from the `cards` table (`WHERE source_library_id = 'lib-personal-kpi'`) and store it in `kpiCardCreatedAt`
- [ ] 9.3: Expose `kpiCardCreatedAt` from the store in the `KpiFab` component (WalletScreen.tsx)
- [ ] 9.4: In `KpiFab`, compute `const referenceDate = lastCheckInDate ?? kpiCardCreatedAt` and pass to `computeDaysElapsed`
- [ ] 9.5: Verify badge shows correct days when user has never checked in (days since card creation)
- [ ] 9.6: Verify badge switches to lastCheckInDate after first check-in
- [ ] 9.7: Run existing kpiBadgeUtils tests — confirm no regressions
- _Status: Open_
