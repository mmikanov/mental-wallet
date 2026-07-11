# Requirements Document

## Introduction

This feature adds a days-since-last-check-in badge to the existing KPI FAB on the Wallet screen. The badge provides a gentle visual nudge showing how many days have elapsed since the user last completed a KPI check-in. It uses a classic red notification badge style (red circle with white number) positioned at the top-right corner of the green FAB circle. The badge is hidden on the same day as a check-in and only appears when 1 or more full days have passed.

## Glossary

- **KPI_FAB**: The existing 56×56pt green (#E8F5E9) floating action button with a 🌱 sprout emoji, positioned at the bottom-right of the Wallet screen. It opens the KPI check-in card when tapped.
- **Days_Since_Badge**: A red circular badge with a white number, positioned at the top-right corner of the KPI_FAB, displaying the count of full calendar days elapsed since the user's most recent KPI check-in.
- **Last_Check_In_Date**: The `recorded_at` timestamp (UTC ISO 8601) of the most recent row in the `kpi_records` table for the current user.
- **Days_Elapsed**: The number of full calendar days between the Last_Check_In_Date (converted to local date) and the current local date. Computed as the difference in calendar days, not 24-hour periods.
- **App**: The Mental Health Wallet application.
- **Focused_Card_View**: The expanded view of a card when it is opened from the Wallet screen or via the KPI_FAB. Displays the card's full content including controls and contextual information.
- **Badge_Explanation_Message**: A brief, warm text message displayed at the top of the Focused_Card_View for the Daily Check-in card, explaining what the Days_Since_Badge number meant (e.g., "It's been 3 days since your last check-in").
- **Admin_Mode**: A hidden developer/testing mode activated by triple-tapping on the Library Browser screen. Provides access to testing and debugging tools not available to regular users.
- **Fake_KPI_Record**: A synthetic `kpi_records` row created by an admin for testing purposes, with a `recorded_at` timestamp set to a specified number of days in the past relative to the current date.

## Requirements

### Requirement 1: Badge Visibility Logic

**User Story:** As a user, I want to see at a glance how long it's been since my last check-in, so that I'm gently reminded to reflect on my progress without being nagged.

#### Acceptance Criteria

1. WHEN the Days_Elapsed value is 1 or greater, THE KPI_FAB SHALL display the Days_Since_Badge showing the Days_Elapsed number.
2. WHEN the Days_Elapsed value is 0 (the user completed a check-in today in local time), THE KPI_FAB SHALL hide the Days_Since_Badge.
3. WHEN the user has no KPI records in the `kpi_records` table, THE KPI_FAB SHALL hide the Days_Since_Badge.
4. WHEN the user completes a KPI check-in, THE KPI_FAB SHALL hide the Days_Since_Badge immediately without requiring a screen refresh or app restart.

### Requirement 2: Days Elapsed Calculation

**User Story:** As a user, I want the badge number to reflect real calendar days, so that the count feels intuitive and matches my perception of time.

#### Acceptance Criteria

1. THE App SHALL compute Days_Elapsed by converting the Last_Check_In_Date UTC timestamp to the device's local date and calculating the calendar day difference between that local date and the current local date.
2. WHEN the device date changes (midnight rollover while the app is in the foreground), THE App SHALL recalculate Days_Elapsed and update the Days_Since_Badge accordingly.
3. WHEN the app returns to the foreground after being backgrounded, THE App SHALL recalculate Days_Elapsed and update the Days_Since_Badge to reflect the current date.

### Requirement 3: Badge Visual Design

**User Story:** As a user, I want the badge to be immediately recognizable as a notification indicator, so that I understand its meaning without explanation.

#### Acceptance Criteria

1. THE Days_Since_Badge SHALL render as a red (#FF3B30) filled circle with a white (#FFFFFF) bold number centered inside.
2. THE Days_Since_Badge SHALL have a minimum diameter of 20 points and expand horizontally to accommodate multi-digit numbers with 4 points of horizontal padding on each side.
3. THE Days_Since_Badge SHALL be positioned at the top-right corner of the KPI_FAB circle, overlapping the FAB edge (offset so approximately 25% of the badge area extends beyond the FAB boundary).
4. THE Days_Since_Badge font size SHALL be 12 points for single-digit numbers and 10 points for numbers with 2 or more digits.
5. WHEN the Days_Elapsed value exceeds 99, THE Days_Since_Badge SHALL display "99+" instead of the actual number.

### Requirement 4: Badge Animation and Interaction

**User Story:** As a user, I want the badge to feel natural alongside the existing FAB animation, so that the interface remains smooth and cohesive.

#### Acceptance Criteria

1. WHEN the KPI_FAB animates in (spring scale+fade), THE Days_Since_Badge SHALL animate in together with the FAB using the same spring animation, appearing as part of the FAB composite element.
2. WHEN the KPI_FAB animates out (card focused or reorder mode), THE Days_Since_Badge SHALL animate out together with the FAB.
3. WHEN the Days_Since_Badge transitions from hidden to visible (after a day boundary is crossed), THE Days_Since_Badge SHALL appear with a brief scale-up spring animation (from 0 to 1 scale) independent of the FAB animation.
4. THE Days_Since_Badge SHALL NOT respond to separate tap gestures — tapping anywhere on the KPI_FAB (including the badge area) SHALL trigger the existing FAB press action.

### Requirement 5: Data Query

**User Story:** As a developer, I want the badge to query the last check-in date efficiently, so that the badge loads without delaying the Wallet screen render.

#### Acceptance Criteria

1. THE App SHALL query the most recent `recorded_at` value from the `kpi_records` table using an indexed lookup (utilizing the existing `idx_kpi_records_recorded_at` index) with a `LIMIT 1` and `ORDER BY recorded_at DESC` clause.
2. THE App SHALL cache the Last_Check_In_Date in the KPI Zustand store to avoid repeated database queries on each re-render.
3. WHEN a new KPI_Record is saved, THE App SHALL update the cached Last_Check_In_Date in the store immediately so the badge hides without an additional database read.

### Requirement 6: Accessibility

**User Story:** As a user with accessibility needs, I want the badge information conveyed through assistive technology, so that I can understand the check-in status without relying on vision alone.

#### Acceptance Criteria

1. WHEN the Days_Since_Badge is visible, THE KPI_FAB accessibility label SHALL include the days-since count (e.g., "Check in on how you're doing, 3 days since last check-in").
2. WHEN the Days_Since_Badge is hidden (checked in today or no records), THE KPI_FAB accessibility label SHALL remain the existing label "Check in on how you're doing" without appending any days-since information.
3. THE Days_Since_Badge SHALL be excluded from the accessibility focus order (marked as not individually focusable) since its information is conveyed through the parent FAB's accessibility label.

### Requirement 7: Badge Explanation on Card Open

**User Story:** As a user, I want to understand what the badge number meant after I open the Daily Check-in card, so that I have context about how long it's been since my last check-in without needing to remember.

#### Acceptance Criteria

1. WHEN the user opens the Daily Check-in card via the KPI_FAB and the Days_Elapsed value at the moment of opening is 1 or greater, THE Focused_Card_View SHALL display the Badge_Explanation_Message at the top of the card content (e.g., "It's been 3 days since your last check-in").
2. THE Badge_Explanation_Message SHALL use a brief, warm tone and include the Days_Elapsed count that was shown on the Days_Since_Badge at the time the card was opened.
3. WHEN the Days_Elapsed value at the moment of opening is 0 or the user has no KPI records, THE Focused_Card_View SHALL NOT display the Badge_Explanation_Message.
4. WHEN the user completes a KPI check-in while the Badge_Explanation_Message is visible, THE Focused_Card_View SHALL hide the Badge_Explanation_Message immediately.
5. THE Badge_Explanation_Message SHALL use singular "day" when the Days_Elapsed count is 1 and plural "days" when the count is 2 or greater.

### Requirement 8: Admin Testing Tools for Badge

**User Story:** As an admin, I want to create fake KPI records and reset KPI data, so that I can verify the Days_Since_Badge displays correctly for various time intervals without waiting real days.

#### Acceptance Criteria

1. WHILE Admin_Mode is active, THE App SHALL display a KPI badge testing section accessible from the Settings screen or a debug panel.
2. WHEN the admin specifies a number of days in the past (1 or greater) and confirms the action, THE App SHALL create a Fake_KPI_Record in the `kpi_records` table with a `recorded_at` timestamp set to that many days before the current date and time.
3. WHEN a Fake_KPI_Record is created, THE App SHALL update the cached Last_Check_In_Date in the KPI store immediately so the Days_Since_Badge reflects the new state without requiring an app restart.
4. WHEN the admin triggers a reset action, THE App SHALL delete all rows from the `kpi_records` table and set the cached Last_Check_In_Date to null so the Days_Since_Badge disappears immediately.
5. IF the admin enters an invalid number of days (0, negative, or non-numeric), THEN THE App SHALL display a validation error message and prevent Fake_KPI_Record creation.
6. WHILE Admin_Mode is inactive, THE App SHALL hide all KPI badge testing controls from the user interface.
