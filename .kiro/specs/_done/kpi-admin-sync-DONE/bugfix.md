# Bugfix Requirements Document

## Introduction

The admin KPI testing tools (`resetAllRecords` and `createFakeRecord`) in the KPI store only operate on the `kpi_records` table but fail to sync the corresponding KPI card's stats (`last_used_at`, `total_uses`, `current_streak`) and completion records. This creates a data inconsistency where the FAB badge and the card stats show conflicting information — the badge reflects `kpi_records` correctly, but the card's display stats remain stale.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the admin triggers `resetAllRecords` THEN the system deletes all rows from `kpi_records` and nulls `lastCheckInDate` in the store, but leaves the KPI card's `total_uses`, `current_streak`, and `last_used_at` columns unchanged in the `cards` table, causing the card to still display stale usage stats (e.g., "14 uses, 0 day streak, Last used 3 days ago").

1.2 WHEN the admin triggers `resetAllRecords` THEN the system does not delete completion records from the `completions` table (and their linked `control_values`) for the KPI card, leaving orphaned completion data that is inconsistent with the empty `kpi_records` table.

1.3 WHEN the admin triggers `createFakeRecord` with a `daysAgo` value THEN the system writes to `kpi_records` only but does not update the KPI card's `last_used_at` column in the `cards` table, causing the card's "Last used" stat to not reflect the fake record's timestamp.

1.4 WHEN the admin triggers `createFakeRecord` with a `daysAgo` value THEN the system does not create a corresponding completion record in the `completions` table, leaving the card's completion history inconsistent with the `kpi_records` table.

1.5 WHEN the admin triggers `createFakeRecord` with a `daysAgo` value THEN the system does not increment the KPI card's `total_uses` or recompute `current_streak`, causing the card stats to be stale relative to the new record.

### Expected Behavior (Correct)

2.1 WHEN the admin triggers `resetAllRecords` THEN the system SHALL delete all `kpi_records`, reset the KPI card's `total_uses` to 0, `current_streak` to 0, and `last_used_at` to NULL in the `cards` table, and delete all completions (and their `control_values`) for that card, so that both the FAB badge and card stats show a clean zero/empty state.

2.2 WHEN the admin triggers `createFakeRecord` with a `daysAgo` value THEN the system SHALL write to `kpi_records`, create a matching completion record in `completions` with `completed_at` set to the fake timestamp, update the KPI card's `last_used_at` to the fake timestamp, increment `total_uses`, and recompute `current_streak` based on the new record history.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user performs a normal KPI check-in via `recordKpi` THEN the system SHALL CONTINUE TO write to `kpi_records`, create a completion with control values, and update the card's `total_uses`, `current_streak`, and `last_used_at` exactly as it does today.

3.2 WHEN the admin triggers `createFakeRecord` THEN the system SHALL CONTINUE TO delete any `kpi_records` newer than the fake one and update the store's `lastCheckInDate` via `loadLastCheckIn`.

3.3 WHEN the admin triggers `resetAllRecords` THEN the system SHALL CONTINUE TO set the store's `lastCheckInDate` to null and `lastCheckInLoaded` to true.

3.4 WHEN `resetAllRecords` or `createFakeRecord` encounters a database error THEN the system SHALL CONTINUE TO display an Alert with the appropriate error message without crashing.
