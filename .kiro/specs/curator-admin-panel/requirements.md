# Requirements Document

## Introduction

The curator admin panel is a separate web application for reviewing community submissions and managing the curated library. It provides moderation tools, statistics, and library card creation.

## Requirements

### Requirement 1: Curator Admin Panel

**User Story:** As a curator, I want a moderation dashboard to review community submissions and manage the library.

#### Acceptance Criteria

1. THE Admin Panel SHALL display the Moderation_Queue with submission metadata and card preview (shell + first 3 controls).
2. THE Admin Panel SHALL provide filters (type, category, date range, status) and sort options.
3. THE Admin Panel SHALL show similar-category cards alongside each submission for uniqueness assessment.
4. THE Admin Panel SHALL provide Approve, Request Changes, and Reject actions with feedback text (max 500 chars).
5. "Request Changes" notifies the submitter and removes from active queue until resubmitted.
6. THE Admin Panel SHALL display moderation statistics: submissions this week, approval rate, top category, avg decision time, overdue count (>5 days).
7. THE Admin Panel SHALL allow curators to create new Library cards and publish immediately.
8. WHEN creating or approving a card, THE Admin Panel SHALL include an "Allow background customization" toggle that sets whether users can personalize the card's background without duplicating it.
9. THE Admin Panel SHALL allow curators to override the submitter's `allowBackgroundCustomization` setting during the approval process.
