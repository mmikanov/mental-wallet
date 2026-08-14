# General Bugs — Design

## Overview

Cross-platform bugs found during testing on both iOS and Android. Fixes are applied to both platforms unless noted otherwise.

## Fix Implementations

### Bug 1: Card Content Bleed in Stacked View (Open)

**Root Cause**: In the stacked card layout, the card below can have content (description text, reminder indicator) that visually shows above the card stacked on top of it. The `cardWrapper` has no overflow clipping, and while `CardEdge` has `innerClip` with overflow hidden, the z-ordering/elevation may not fully cover content.

**Attempted Fix**: Added `overflow: 'hidden'` + `borderRadius: 16` to `cardWrapper` — this clipped the card shadows, making it look worse. Reverted.

**Needed Approach**: Either increase elevation on overlapping cards, or clip at the `cardWrapper` level without affecting shadow rendering. May need a separate shadow wrapper outside the clip container. Low priority.

### Bug 2: Third-Party Icons Not Shown in Reorder Mode (Fixed)

**Root Cause**: `ReorderMode` rendered icons as plain emoji text (`{item.iconType === 'emoji' ? item.iconValue : '📋'}`) without using `renderCardIcon`, so third-party icons never triggered the bundled logo lookup.

**Fix**: Replaced plain text with `renderCardIcon()` call including `sourceId` for local logo lookup.

**Files**: `src/components/wallet/ReorderMode.tsx`

### Bug 3: Missing duration_records Table (Fixed)

**Root Cause**: The `devInsightsMockData` seeder and export service referenced `duration_records` table, but no migration created it.

**Fix**: Added `runDurationRecordsMigration` to `migrations.ts` creating the table with proper schema and indexes. Also fixed `pickOutcomeCategory` returning `'clear'` instead of `'clearer'` (CHECK constraint mismatch).

**Files**: `src/data/migrations.ts`, `src/services/devInsightsMockData.ts`

### Bug 4: Reset Navigation to Wrong Route (Fixed)

**Root Cause**: `confirmDeleteAllData` in SettingsScreen dispatched navigation to `'Disclaimer'` which doesn't exist as a root route. The correct route is `'Onboarding'`.

**Fix**: Changed `routes: [{ name: 'Disclaimer' }]` to `routes: [{ name: 'Onboarding' }]`.

**Files**: `src/screens/SettingsScreen.tsx`

### Bug 5: Export Fails on iOS (Open)

**Root Cause**: The export service was using deprecated `FileSystem.cacheDirectory` (returns `null` in SDK 54) and `FileSystem.writeAsStringAsync`. Updated to new `File`/`Paths` API which works on Android but may have issues on iOS 26.5 beta.

**Current State**: Works on Android, still failing on iOS. Needs investigation — may need platform-conditional approach or fallback to legacy API on iOS.

**Files**: `src/services/exportService.ts`

### Bug 6: Emoji Icon Clipping (Open)

**Root Cause**: Icon containers in `ToolPreviewCard` (24x24) and `LibraryToolPreview` (48x48) constrain emoji rendering. Some emoji glyphs extend beyond their font size bounds, getting clipped by the container.

**Needed Fix**: Add `overflow: 'visible'` to icon containers, or increase container size slightly. Low priority visual issue.

### Bug 7: Scroll Not Restored After Preview Close (Fixed)

**Root Cause**: The auto-scroll `useEffect` in `SessionLauncherContent` only triggered on `[recommendations]` change. Closing a preview doesn't change recommendations, so scroll never restored.

**Fix**: Added `scrollTo` call directly in `handleClosePreview` with a 150ms delay for layout remount.

**Files**: `src/components/session/SessionLauncherContent.tsx`

### Bug 8: KPI FAB Missing After Reset (Fixed)

**Root Cause**: Consequence of Bug 4 — failed navigation to onboarding meant KPI selection was skipped after data reset.

**Fix**: Resolved by fixing Bug 4 (correct navigation route).

### Bug 9: KPI Badge Not Shown When Never Used (Open)

**Root Cause**: `computeDaysElapsed(lastCheckInDateUtc)` returns `null` when `lastCheckInDateUtc` is `null` (no records in `kpi_records` table). `DaysSinceBadge` renders nothing when `daysElapsed` is `null`. There is no fallback to a reference date (like card creation date) for the "never used" case.

**Fix Design**:

1. Add a `kpiCardCreatedAt` field to `kpiStore` (loaded alongside `loadLastCheckIn`)
2. In `KpiFab`, when `lastCheckInDate` is null but `kpiCardCreatedAt` exists, compute `daysElapsed` using the card's `createdAt` date as the reference
3. `computeDaysElapsed` stays unchanged (pure function, doesn't need modification) — the caller passes the appropriate date

**Recommended approach**: Use a separate field for clarity. The `KpiFab` component computes:
```typescript
const referenceDate = lastCheckInDate ?? kpiCardCreatedAt;
const daysElapsed = computeDaysElapsed(referenceDate, new Date());
```

**Files to modify**:
- `src/stores/kpiStore.ts` — add `kpiCardCreatedAt` field and load it in `loadLastCheckIn`
- `src/screens/WalletScreen.tsx` (KpiFab) — use fallback reference date when `lastCheckInDate` is null

### BetterHelp Icon Missing in Suggestions (Open)

**Root Cause**: Unknown. Other third-party app icons display correctly. BetterHelp-specific issue — card definition, logo registry, and asset file all look correct. Needs runtime debugging.

**Needed Investigation**: Check if the recommendation service returns `iconType: 'third_party'` for BetterHelp specifically, or if there's a data issue when the card is seeded.
