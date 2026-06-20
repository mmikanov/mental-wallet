# Design: Property-Based Tests

## Overview

All property tests use fast-check with a minimum of 100 iterations per property. Tests are placed in `__tests__/` directories adjacent to the service/store code they verify. Each test file focuses on a single service's invariants.

## Test File Layout

```
src/
├── services/__tests__/
│   ├── cardService.property.test.ts      # Properties 1, 2, 5, 6
│   ├── completionService.property.test.ts # Property 3
│   └── reminderService.property.test.ts   # Property 7
└── stores/__tests__/
    └── walletStore.property.test.ts       # Property 4
```

## Arbitraries (fast-check generators)

### CardShell Arbitrary
- Generates `{ title, description, iconType, iconValue, backgroundType, backgroundValue }` with values drawn from `fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 }).filter(s => s.trim().length > 0))`
- Constrains title to max 80 chars, description to max 300 chars

### Control List Arbitrary
- Generates arrays of mock Control objects with length 0–15
- Each control has a random valid ControlType, sequential position, and minimal valid config

### Card State Arbitrary (for streak tests)
- Generates `{ lastUsedAt: Date, currentStreak: number (1–365), completionDate: Date }`
- `completionDate` is drawn from: same day, next day, or day + random gap (2–30)

### Card With Completions Arbitrary (for archive tests)
- Generates a Card with 0–20 mock completions and 0–3 active reminders

### Origin Badge Arbitrary
- Draws from `fc.oneof(fc.constant('library'), fc.constant('community'), fc.constant('my_tool'))`

## Test Approach

Each property test:
1. Uses `fc.assert(fc.property(...))` with `{ numRuns: 100 }` minimum
2. Calls the real service function (not mocks) where feasible, using an in-memory SQLite database
3. Asserts the invariant holds for all generated inputs
4. Uses `fc.pre()` for preconditions where needed (e.g., filtering to valid date ranges)

## Database Setup

- Tests use expo-sqlite's in-memory mode (`:memory:`) to avoid file system side effects
- Before each test suite: run migrations to create schema
- Before each test: clear all rows to ensure isolation
