# Requirements: Property-Based Tests

## Introduction

This spec covers the property-based test suite for Mental Health Wallet's core service layer. These tests use fast-check to validate business logic invariants with randomized inputs (100+ iterations per property). They exercise edge cases in validation, streak calculation, archive behavior, editability permissions, and card duplication correctness.

All tests target already-implemented logic in the service and store layers — no new features are introduced.

## Requirements

### Requirement 1: Card Shell Validation Properties

**User Story:** As a developer, I want property-based tests proving the card shell validator correctly identifies invalid fields, so that I have confidence in the validation boundary.

#### Acceptance Criteria

1. GIVEN arbitrary CardShell values (including empty strings, whitespace-only strings, and valid strings), WHEN `validateShell` is called, THEN it SHALL reject if and only if any field is empty or whitespace-only.
2. WHEN `validateShell` rejects a CardShell, THEN the returned errors SHALL identify exactly the fields that are empty or whitespace-only — no false positives or missing fields.

### Requirement 2: Control Count Validation Properties

**User Story:** As a developer, I want property-based tests proving the control count validator enforces the 1–10 range, so that cards cannot be saved with zero or excessive controls.

#### Acceptance Criteria

1. GIVEN a control list of length N (0–15), WHEN `validateControls` is called, THEN it SHALL accept if and only if 1 ≤ N ≤ 10.

### Requirement 3: Streak Calculation Properties

**User Story:** As a developer, I want property-based tests proving streak logic handles all date scenarios correctly, so that users see accurate streak counts.

#### Acceptance Criteria

1. GIVEN a card with a known lastUsedAt and currentStreak, WHEN a completion is recorded on the immediately following calendar day, THEN the streak SHALL increment by 1.
2. GIVEN a card with a known lastUsedAt, WHEN a completion is recorded on the same calendar day, THEN the streak SHALL remain unchanged.
3. GIVEN a card with a known lastUsedAt, WHEN a completion is recorded after a gap of 2+ calendar days, THEN the streak SHALL reset to 1.

### Requirement 4: Archive Data Preservation Properties

**User Story:** As a developer, I want property-based tests proving archiving preserves data integrity, so that users never lose completions or stats when archiving.

#### Acceptance Criteria

1. GIVEN a card with completions and a non-zero streak, WHEN the card is archived, THEN all completions SHALL remain intact and the streak value SHALL be unchanged.
2. GIVEN a card with active reminders, WHEN the card is archived, THEN all associated reminders SHALL be set to inactive.

### Requirement 5: Origin Badge Editability Properties

**User Story:** As a developer, I want property-based tests proving only user-created cards are editable, so that read-only cards cannot be accidentally modified.

#### Acceptance Criteria

1. GIVEN a card with origin badge "my_tool", WHEN edit permission is checked, THEN the card SHALL be editable.
2. GIVEN a card with origin badge "library" or "community", WHEN edit permission is checked, THEN the card SHALL NOT be editable.

### Requirement 6: Duplicate Independence Properties

**User Story:** As a developer, I want property-based tests proving duplicated cards are correctly independent from their source, so that duplicates don't inherit stats or origin restrictions.

#### Acceptance Criteria

1. WHEN a card is duplicated, THEN the duplicate's title SHALL equal the original title with " - Copy" appended.
2. WHEN a card is duplicated, THEN the duplicate SHALL have origin badge "my_tool" regardless of the original's badge.
3. WHEN a card is duplicated, THEN the duplicate SHALL have controls identical in type, position, and config to the original.
4. WHEN a card is duplicated, THEN the duplicate's totalUses, currentStreak, and lastUsedAt SHALL all be zeroed/null.

### Requirement 7: Reminder-Archive Consistency Properties

**User Story:** As a developer, I want property-based tests proving reminder state is consistent through archive/restore cycles, so that users aren't surprised by phantom notifications.

#### Acceptance Criteria

1. GIVEN a card with 1–3 active reminders, WHEN the card is archived, THEN all reminders SHALL become inactive.
2. GIVEN an archived card with inactive reminders, WHEN the card is restored, THEN reminders SHALL remain inactive (user must manually re-enable).
