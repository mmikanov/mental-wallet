# Bugfix Requirements Document

## Introduction

Archived cards in the Archive screen do not display their origin type (`originBadge` field), making it difficult for users to distinguish between cards sourced from the curated library, the community, or ones they created themselves. This reduces confidence when deciding which cards to restore or delete.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a card with `originBadge = 'library'` is displayed in the Archive screen THEN the system does not show any visual indicator of its library origin

1.2 WHEN a card with `originBadge = 'my_tool'` is displayed in the Archive screen THEN the system does not show any visual indicator that it was user-created

1.3 WHEN a card with `originBadge = 'community'` is displayed in the Archive screen THEN the system does not show any visual indicator of its community origin

### Expected Behavior (Correct)

2.1 WHEN a card with `originBadge = 'library'` is displayed in the Archive screen THEN the system SHALL display a "Library" badge/tag on the card

2.2 WHEN a card with `originBadge = 'my_tool'` is displayed in the Archive screen THEN the system SHALL display a "My Tool" badge/tag on the card

2.3 WHEN a card with `originBadge = 'community'` is displayed in the Archive screen THEN the system SHALL display a "Community" badge/tag on the card

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a card is displayed in the Archive screen THEN the system SHALL CONTINUE TO show the card title, icon, category tag, and last-used date as before

3.2 WHEN a user taps "Restore to Wallet" on an archived card THEN the system SHALL CONTINUE TO restore the card and remove it from the archive list

3.3 WHEN a user taps "Delete" on an archived card THEN the system SHALL CONTINUE TO show a confirmation dialog and permanently delete the card upon confirmation

3.4 WHEN no archived cards exist THEN the system SHALL CONTINUE TO display the empty state message
