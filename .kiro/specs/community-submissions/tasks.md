# Tasks

## Task 1: Add submissions database migration

- [ ] Create migration adding submissions table (id, card_id, title, description, category_id, when_to_use, tool_type, is_anonymous, author_name, allow_background_customization, status, rejection_reason, submitted_at, decided_at)
- [ ] Add submission_status column to cards table via ALTER TABLE
- [ ] Add allow_background_customization column to cards table (INTEGER, default 0)
- [ ] Add Submission and SubmissionStatus type definitions
- _Requirements: 1.5_

## Task 2: Implement submission flow

- [ ] Create `src/screens/SubmissionScreen.tsx` with pre-filled form from card data
- [ ] Validate: title ≤60 chars, description ≤200 chars, "When to use" ≤300 chars, all required
- [ ] Display submission guidelines and require acknowledgment checkbox
- [ ] Implement anonymous vs. attributed publishing choice
- [ ] Include "Allow background customization" toggle (defaults off) in submission form
- [ ] On submit: insert into submissions table with status 'pending', update card.submission_status
- [ ] Show "Pending Review" status in kebab menu for submitted cards
- [ ] Handle approval notification: update status, show confirmation
- [ ] Handle rejection notification: show rejection reason, allow revision and resubmission
- [ ] Add "Submit to library" option in kebab menu for "My tool" cards
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] }
  ]
}
```
