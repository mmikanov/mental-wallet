# Design Document

## Overview

A new screen (`SubmissionScreen.tsx`) handles the submission flow. Submissions are stored locally in a `submissions` table and POSTed to the curator admin API. Status updates are received via push notification or periodic polling.

## Architecture

Mobile-side: new database table, submission screen, and status display in kebab menu. Server-side: integration with the curator admin panel API (see `curator-admin-panel` spec).

## Components and Interfaces

### Submission Flow

1. User taps "Submit to library" → SubmissionScreen opens with pre-filled data
2. User reviews/edits metadata, checks guidelines, chooses anonymity
3. Submit → local insert + POST to `/submissions` API
4. Kebab menu shows "Pending Review" status
5. On approval/rejection: update local status via notification or polling

### API Integration

```typescript
// Submit card to moderation queue
POST /submissions
Body: { cardId, title, description, categoryId, whenToUse, toolType, isAnonymous, authorName, allowBackgroundCustomization }
Response: 202 { submissionId, status: 'pending' }
```

## Data Models

```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  title TEXT NOT NULL CHECK(length(title) <= 60),
  description TEXT NOT NULL CHECK(length(description) <= 200),
  category_id TEXT NOT NULL REFERENCES categories(id),
  when_to_use TEXT NOT NULL CHECK(length(when_to_use) <= 300),
  tool_type TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  author_name TEXT,
  allow_background_customization INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  rejection_reason TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

ALTER TABLE cards ADD COLUMN submission_status TEXT DEFAULT 'none';
ALTER TABLE cards ADD COLUMN allow_background_customization INTEGER NOT NULL DEFAULT 0;
```

## Testing Strategy

- Unit test: form validation enforces character limits
- Unit test: submission creates local record with correct status
- Unit test: kebab menu shows correct status label
