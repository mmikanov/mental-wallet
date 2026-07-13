# KPI Admin Sync — Bugfix Design

## Overview

This design addresses two bugs in the admin KPI testing tools (`resetAllRecords` and `createFakeRecord`) in `src/stores/kpiStore.ts`. Both functions only operate on the `kpi_records` table but fail to sync the corresponding KPI card's stats and completion records. This creates a data inconsistency where the FAB badge (driven by `kpi_records`) shows one thing while the card's display stats (`total_uses`, `current_streak`, `last_used_at` from the `cards` table) remain stale.

The normal user flow (`recordKpi` in `kpiService.ts`) already writes to both `kpi_records` and the completions/cards system. The admin tools need to mirror this dual-write pattern.

## Glossary

- **Bug_Condition (C)**: The set of inputs/states that trigger the defective behavior for each bug
- **Property (P)**: The desired correct behavior when the bug condition holds
- **Preservation**: Existing behavior that must remain unchanged after the fix
- **kpi_records**: Table storing raw KPI check-in values (value, note, kpi_label, recorded_at)
- **completions**: Table storing card usage records (card_id, completed_at)
- **control_values**: Table storing control-level data per completion (completion_id, control_id, value)
- **cards**: Table storing card metadata including `total_uses`, `current_streak`, `last_used_at`
- **KPI card**: The card with `source_library_id = 'lib-personal-kpi'` in the `cards` table
- **walletStore.loadCards()**: Re-reads all cards from DB and updates the reactive UI state

## Bug Details

### Bug 1: `resetAllRecords` Doesn't Reset Card Stats

The bug manifests when the admin triggers `resetAllRecords`. The function deletes all rows from `kpi_records` and sets `lastCheckInDate` to null in the store, but leaves the KPI card's `total_uses`, `current_streak`, and `last_used_at` unchanged in the `cards` table. It also leaves orphaned completion records in `completions` and `control_values`. The card continues to display stale stats (e.g., "14 uses, 0 day streak, Last used 3 days ago") even though all underlying records are gone.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug1(state)
  INPUT: state of type { resetTriggered: boolean, kpiCardExists: boolean }
  OUTPUT: boolean

  RETURN state.resetTriggered === true
         AND state.kpiCardExists === true
END FUNCTION
```

### Bug 2: `createFakeRecord` Doesn't Update Card Stats

The bug manifests when the admin triggers `createFakeRecord(daysAgo)`. The function writes to `kpi_records` and deletes newer records, but does not create a matching completion record, does not update the card's `last_used_at`, does not increment `total_uses`, and does not recompute `current_streak`. The card's stats remain stale relative to the new fake record.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug2(state)
  INPUT: state of type { fakeRecordCreated: boolean, kpiCardExists: boolean, daysAgo: number }
  OUTPUT: boolean

  RETURN state.fakeRecordCreated === true
         AND state.kpiCardExists === true
         AND state.daysAgo >= 0
END FUNCTION
```

### Examples

- **Bug 1**: Admin triggers reset → FAB badge correctly shows no check-ins, but card still displays "14 uses, Last used 3 days ago"
- **Bug 2**: Admin creates fake record 5 days ago → FAB badge correctly shows "5 days since last check-in", but card still shows previous `last_used_at` and stale `total_uses`

## Architecture Changes

### Current Flow (Defective)

```
resetAllRecords:
  DELETE FROM kpi_records  →  done (card stats untouched)

createFakeRecord(N):
  INSERT INTO kpi_records  →  DELETE newer kpi_records  →  done (card stats untouched)
```

### Fixed Flow

```
resetAllRecords:
  BEGIN TRANSACTION
    Find KPI card ID
    DELETE FROM kpi_records
    DELETE FROM control_values (for KPI card's completions)
    DELETE FROM completions (for KPI card)
    UPDATE cards SET total_uses=0, current_streak=0, last_used_at=NULL
  END TRANSACTION
  Refresh UI via walletStore.loadCards()

createFakeRecord(N):
  BEGIN (existing operations)
    INSERT INTO kpi_records
    DELETE newer kpi_records
  END
  BEGIN (new operations)
    Find KPI card ID
    DELETE control_values for completions newer than fake timestamp
    DELETE completions newer than fake timestamp
    INSERT INTO completions (matching fake record)
    UPDATE cards SET last_used_at, total_uses = COUNT(*), current_streak = 1
  END
  Refresh UI via walletStore.loadCards()
```

### New Dependency

Both functions gain a dependency on the wallet store for UI refresh:

```typescript
import { useWalletStore } from '@/stores/walletStore';
// At end of operation:
await useWalletStore.getState().loadCards();
```

## Implementation Details

### Bug 1 Fix: `resetAllRecords`

**File**: `src/stores/kpiStore.ts` — `resetAllRecords` function

**SQL operations (in order, within existing try/catch):**

```sql
-- Step 1: Get the KPI card ID
SELECT id FROM cards WHERE source_library_id = 'lib-personal-kpi';

-- Step 2: Delete kpi_records (existing behavior)
DELETE FROM kpi_records;

-- Step 3: Delete control_values for this card's completions
DELETE FROM control_values WHERE completion_id IN (SELECT id FROM completions WHERE card_id = ?);

-- Step 4: Delete completions for this card
DELETE FROM completions WHERE card_id = ?;

-- Step 5: Reset card stats
UPDATE cards SET total_uses = 0, current_streak = 0, last_used_at = NULL, updated_at = ? WHERE id = ?;
```

**Post-DB actions:**
- Set store state: `{ lastCheckInDate: null, lastCheckInLoaded: true }` (existing)
- Call `await useWalletStore.getState().loadCards()` (new)

**Graceful degradation:** If the KPI card doesn't exist in the DB (Step 1 returns null), the `kpi_records` deletion still proceeds. Steps 3–5 are skipped with a `console.warn`. No user-facing error.

### Bug 2 Fix: `createFakeRecord`

**File**: `src/stores/kpiStore.ts` — `createFakeRecord` function

After existing `kpi_records` operations (insert fake record + delete newer records), add:

```sql
-- Step 1: Get the KPI card ID
SELECT id, total_uses FROM cards WHERE source_library_id = 'lib-personal-kpi';

-- Step 2: Delete control_values for completions newer than the fake timestamp
DELETE FROM control_values WHERE completion_id IN (SELECT id FROM completions WHERE card_id = ? AND completed_at > ?);

-- Step 3: Delete completions newer than the fake timestamp
DELETE FROM completions WHERE card_id = ? AND completed_at > ?;

-- Step 4: Create matching completion record
INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?);

-- Step 5: Update card stats
-- total_uses = recount from completions table (accurate after deletions + insert)
-- current_streak = 1 (isolated fake record, no consecutive-day chain to compute)
-- last_used_at = fake record's timestamp
UPDATE cards SET last_used_at = ?, total_uses = (SELECT COUNT(*) FROM completions WHERE card_id = ?), current_streak = 1, updated_at = ? WHERE id = ?;
```

**Post-DB actions:**
- Call `await get().loadLastCheckIn()` (existing)
- Call `await useWalletStore.getState().loadCards()` (new)

**Rationale for `current_streak = 1`:** The `createFakeRecord` function deletes all records newer than the fake one. This leaves the fake record as the most recent. Since we can't know whether there are consecutive-day records before it without complex querying, and admin tools don't need accurate streak computation, we hardcode streak to 1.

**Graceful degradation:** If the KPI card doesn't exist (Step 1 returns null), the `kpi_records` operations (existing behavior) still proceed. Card/completions operations are skipped with a `console.warn`. No user-facing error.

## Correctness Properties

Property 1: Bug Condition — Reset Clears All Card State

_For any_ state where `resetAllRecords` is triggered and the KPI card exists in the DB, the card's `total_uses` SHALL be 0, `current_streak` SHALL be 0, `last_used_at` SHALL be NULL, AND `SELECT COUNT(*) FROM completions WHERE card_id = ?` (for the KPI card) SHALL return 0, AND `SELECT COUNT(*) FROM kpi_records` SHALL return 0.

**Validates: Requirements 2.1**

Property 2: Bug Condition — Fake Record Syncs Card Stats

_For any_ call to `createFakeRecord(daysAgo)` where the KPI card exists, the card's `last_used_at` SHALL equal the fake record's `recorded_at` timestamp, AND `SELECT COUNT(*) FROM completions WHERE card_id = ?` SHALL equal the card's `total_uses`, AND `current_streak` SHALL be 1.

**Validates: Requirements 2.2**

Property 3: Preservation — Idempotent Reset

Calling `resetAllRecords` multiple times in sequence SHALL always result in the same clean state: `total_uses = 0`, `last_used_at = NULL`, `current_streak = 0`, 0 completions for the KPI card, 0 kpi_records.

**Validates: Requirements 2.1, 3.3**

Property 4: Preservation — Normal RecordKpi Unaffected

_For any_ normal KPI check-in via `recordKpi(value, note)`, the system SHALL continue to write to `kpi_records`, create a completion with control values, and update the card's stats exactly as it does today. The admin tool fixes do not alter the `kpiService.recordKpi` code path.

**Validates: Requirements 3.1**

Property 5: Preservation — Fake Record Still Deletes Newer KPI Records

_For any_ call to `createFakeRecord(daysAgo)`, the system SHALL continue to delete `kpi_records` with `recorded_at` greater than the fake timestamp, and SHALL continue to update the store's `lastCheckInDate` via `loadLastCheckIn`.

**Validates: Requirements 3.2**

Property 6: Preservation — Reset Still Nulls Store State

_For any_ call to `resetAllRecords`, the system SHALL continue to set the store's `lastCheckInDate` to null and `lastCheckInLoaded` to true.

**Validates: Requirements 3.3**

## Error Handling

- **KPI card not found**: If `SELECT id FROM cards WHERE source_library_id = 'lib-personal-kpi'` returns no rows, both functions skip the card/completions operations and log `console.warn('KPI card not found in DB, skipping card sync')`. The `kpi_records` operations (existing behavior) still execute. No `Alert.alert` is shown for this case since it's a non-critical admin scenario.
- **DB errors**: All new DB operations are wrapped in the existing try/catch blocks. If any SQL operation fails, the existing `Alert.alert('Error', ...)` fallback handles it.
- **walletStore.loadCards() failure**: If the UI refresh fails, it should not surface an error — the data is already correct in the DB, and the UI will refresh on next navigation. Wrap the `loadCards()` call in its own try/catch with a silent `console.warn`.

## Testing Strategy

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating each bug on unfixed code.

**Bug 1 Test**: Call `resetAllRecords` after recording some KPI entries. Assert that the card's `total_uses` is 0 and completions count is 0. Run on unfixed code → expect failure (card stats remain stale).

**Bug 2 Test**: Call `createFakeRecord(5)` after recording some KPI entries. Assert that the card's `last_used_at` matches the fake timestamp and `total_uses` equals completion count. Run on unfixed code → expect failure (card stats unchanged).

### Fix Checking

**Pseudocode:**
```
-- Bug 1
FOR ALL state WHERE resetTriggered AND kpiCardExists DO
  resetAllRecords_fixed()
  ASSERT cards.total_uses = 0
  ASSERT cards.current_streak = 0
  ASSERT cards.last_used_at = NULL
  ASSERT COUNT(completions WHERE card_id = kpiCardId) = 0
  ASSERT COUNT(control_values WHERE completion_id IN kpiCompletions) = 0
  ASSERT COUNT(kpi_records) = 0
END FOR

-- Bug 2
FOR ALL (daysAgo) WHERE fakeRecordCreated AND kpiCardExists DO
  createFakeRecord_fixed(daysAgo)
  fakeTimestamp := computeFakeRecordTimestamp(daysAgo)
  ASSERT cards.last_used_at = fakeTimestamp
  ASSERT cards.total_uses = COUNT(completions WHERE card_id = kpiCardId)
  ASSERT cards.current_streak = 1
END FOR
```

### Preservation Checking

**Pseudocode:**
```
-- Idempotent reset
FOR i IN 1..N DO
  resetAllRecords_fixed()
  ASSERT cards.total_uses = 0
  ASSERT cards.last_used_at = NULL
  ASSERT cards.current_streak = 0
END FOR

-- Normal recordKpi unchanged
recordKpi_fixed(value, note)
ASSERT kpi_records.count = original_count + 1
ASSERT completions.count = original_completions + 1
ASSERT cards.total_uses = original_total_uses + 1
```
