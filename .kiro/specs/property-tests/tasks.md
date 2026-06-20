# Implementation Plan: Property-Based Tests

## Overview

This plan implements 7 property-based tests covering core service-layer invariants. All tests use fast-check with 100+ iterations and run against in-memory SQLite. Tests are placed alongside existing service tests.

## Tasks

- [ ] 1. Test infrastructure setup
  - [ ] 1.1 Create in-memory database test helper
    - Create a shared test utility that initializes an in-memory SQLite database with full schema migrations
    - Provide `setupTestDb()` and `teardownTestDb()` helpers for use across all property test files
    - Verify helper works by running a basic insert/select cycle
    - _Requirements: All_

- [ ] 2. Card validation property tests
  - [ ] 2.1 Property 1: Card Shell Completeness
    - Create `src/services/__tests__/cardService.property.test.ts`
    - Generate arbitrary CardShell values (empty, whitespace, valid strings)
    - Assert `validateShell` rejects iff any field is empty/whitespace and identifies exactly the invalid fields
    - Minimum 100 iterations
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Property 2: Control Count Invariant
    - In the same test file, add a property test for control count validation
    - Generate control lists of length 0–15
    - Assert `validateControls` accepts 1–10 and rejects all others
    - Minimum 100 iterations
    - _Requirements: 2.1_

- [ ] 3. Streak property tests
  - [ ] 3.1 Property 3: Streak Monotonicity
    - Create `src/services/__tests__/completionService.property.test.ts`
    - Generate card states with varying lastUsedAt/currentStreak and completion dates
    - Assert streak update produces correct value for each scenario (consecutive day → +1, same day → unchanged, gap → reset to 1)
    - Minimum 100 iterations
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Archive property tests
  - [ ] 4.1 Property 4: Archive Data Preservation
    - Create `src/stores/__tests__/walletStore.property.test.ts`
    - Generate cards with completions, streaks, and reminders
    - Archive and verify: completions preserved, streak unchanged, reminders set inactive
    - Minimum 100 iterations
    - _Requirements: 4.1, 4.2_

- [ ] 5. Editability and duplication property tests
  - [ ] 5.1 Property 5: Origin Badge Editability
    - In `src/services/__tests__/cardService.property.test.ts`, add a property test
    - Generate cards with each origin badge value
    - Assert edit permission granted only for "my_tool"
    - Minimum 100 iterations
    - _Requirements: 5.1, 5.2_

  - [ ] 5.2 Property 6: Duplicate Independence
    - In the same file, add a property test for duplication
    - Generate cards with various titles, badges, controls, stats
    - Duplicate and verify: title suffix " - Copy", "my_tool" badge, identical controls, zeroed stats
    - Minimum 100 iterations
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Reminder-archive property tests
  - [ ] 6.1 Property 7: Reminder-Archive Consistency
    - Create `src/services/__tests__/reminderService.property.test.ts`
    - Generate cards with 1–3 active reminders
    - Archive → verify all reminders inactive
    - Restore → verify reminders still inactive
    - Minimum 100 iterations
    - _Requirements: 7.1, 7.2_

## Notes

- All property tests use `fc.assert(fc.property(...), { numRuns: 100 })` minimum
- Tests run against real service functions with in-memory SQLite — no mocks for the database layer
- Each test file is independent and can run in parallel with others

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "4.1", "5.1", "5.2", "6.1"] }
  ]
}
```
