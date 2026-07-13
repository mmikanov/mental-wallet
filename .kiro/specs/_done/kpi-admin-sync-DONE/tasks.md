# Implementation Tasks

## Task Dependency Graph

Wave 1: Task 1 (Bug 1 exploration)
Wave 2: Task 2 (Bug 1 preservation)
Wave 3: Task 3 (Bug 1 fix + verify)
Wave 4: Task 4 (Bug 2 exploration)
Wave 5: Task 5 (Bug 2 preservation)
Wave 6: Task 6 (Bug 2 fix + verify)

## Tasks

- [x] 1. Write bug condition exploration test for resetAllRecords (Bug 1)
  - [x] 1.1 Create test file `src/stores/__tests__/kpiStore-resetSync.test.ts`
    - Set up an in-memory SQLite database with the cards, completions, control_values, and kpi_records tables
    - Insert a card with source_library_id = 'lib-personal-kpi', total_uses = 5, current_streak = 3, last_used_at = some recent timestamp
    - Insert several completion records for that card
    - Insert several kpi_records
    - Call the current `resetAllRecords` function
    - Assert that after reset: card.total_uses === 0, card.current_streak === 0, card.last_used_at === null, completions count === 0
    - **This test is EXPECTED TO FAIL on unfixed code** (proving the bug exists)
    - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Write preservation test for resetAllRecords (Bug 1)
  - [x] 2.1 Add preservation tests to `src/stores/__tests__/kpiStore-resetSync.test.ts`
    - Test that after resetAllRecords: kpi_records count === 0 (existing behavior preserved)
    - Test that after resetAllRecords: store's lastCheckInDate === null (existing behavior preserved)
    - Test that resetAllRecords is idempotent (calling twice gives same result)
    - Test that resetAllRecords shows Alert on DB error (existing error handling preserved)
    - **These tests MUST PASS on current unfixed code** (they verify behaviors that should NOT change)
    - _Requirements: 3.3, 3.4_

- [x] 3. Fix resetAllRecords and verify (Bug 1)
  - [x] 3.1 Modify `resetAllRecords` in `src/stores/kpiStore.ts`
    - Add: find KPI card by source_library_id = 'lib-personal-kpi'
    - Add: DELETE FROM control_values WHERE completion_id IN (SELECT id FROM completions WHERE card_id = ?)
    - Add: DELETE FROM completions WHERE card_id = ?
    - Add: UPDATE cards SET total_uses = 0, current_streak = 0, last_used_at = NULL, updated_at = ? WHERE id = ?
    - Add: import and call useWalletStore.getState().loadCards() for UI refresh (wrap in try/catch)
    - If KPI card not found, skip card/completions operations with console.warn, still delete kpi_records
    - _Requirements: 2.1, 3.3, 3.4_
  - [x] 3.2 Run exploration test (Task 1) — should NOW PASS
  - [x] 3.3 Run preservation test (Task 2) — should STILL PASS
  - Depends on: Task 1, Task 2

- [x] 4. Write bug condition exploration test for createFakeRecord (Bug 2)
  - [x] 4.1 Create test file `src/stores/__tests__/kpiStore-fakeRecordSync.test.ts`
    - Set up in-memory SQLite database with cards, completions, control_values, kpi_records tables
    - Insert a card with source_library_id = 'lib-personal-kpi', total_uses = 3, current_streak = 2, last_used_at = some timestamp
    - Call the current `createFakeRecord(5)` function
    - Assert that after createFakeRecord: card.last_used_at matches the fake timestamp (computeFakeRecordTimestamp(5))
    - Assert that card.total_uses equals count of completions for that card
    - Assert that a completion record exists with completed_at matching the fake timestamp
    - **This test is EXPECTED TO FAIL on unfixed code** (proving the bug exists)
    - _Requirements: 1.3, 1.4, 1.5, 2.2_
  - Depends on: Task 3

- [x] 5. Write preservation test for createFakeRecord (Bug 2)
  - [x] 5.1 Add preservation tests to `src/stores/__tests__/kpiStore-fakeRecordSync.test.ts`
    - Test that after createFakeRecord(5): kpi_records newer than the fake timestamp are deleted (existing behavior)
    - Test that after createFakeRecord(5): store's lastCheckInDate is updated via loadLastCheckIn (existing behavior)
    - Test that createFakeRecord shows Alert on DB error (existing error handling preserved)
    - **These tests MUST PASS on current unfixed code** (they verify behaviors that should NOT change)
    - _Requirements: 3.2, 3.4_
  - Depends on: Task 3

- [x] 6. Fix createFakeRecord and verify (Bug 2)
  - [x] 6.1 Modify `createFakeRecord` in `src/stores/kpiStore.ts`
    - After existing kpi_records operations, add:
    - Find KPI card: SELECT id FROM cards WHERE source_library_id = 'lib-personal-kpi'
    - Delete control_values for completions newer than fake timestamp
    - Delete completions newer than fake timestamp for KPI card
    - INSERT INTO completions a new record with completed_at = fake timestamp
    - UPDATE cards SET last_used_at = fakeTimestamp, total_uses = (SELECT COUNT(*) FROM completions WHERE card_id = ?), current_streak = 1, updated_at = now
    - Import and call useWalletStore.getState().loadCards() for UI refresh (wrap in try/catch)
    - If KPI card not found, skip card/completions operations with console.warn
    - _Requirements: 2.2, 3.2, 3.4_
  - [x] 6.2 Run exploration test (Task 4) — should NOW PASS
  - [x] 6.3 Run preservation test (Task 5) — should STILL PASS
  - Depends on: Task 4, Task 5

## Notes

- The KPI card is identified by `source_library_id = 'lib-personal-kpi'`
- Tests should mock the database using the existing jest setup patterns in the project (see existing test files in `src/stores/__tests__/` and `src/services/__tests__/`)
- The wallet store's `loadCards()` call must be wrapped in a separate try/catch so UI refresh failures don't surface errors
- `current_streak` for fake records is always set to 1 (no consecutive-day computation for admin tools)
- These are admin-only testing tools; the normal user flow (`kpiService.recordKpi`) is not modified
