# Tasks

## Task 1: Set up admin web application

- [ ] Create `curator-admin/` directory with React + Vite + TypeScript project
- [ ] Set up Express.js REST API with TypeScript
- [ ] Configure PostgreSQL connection with Prisma ORM
- [ ] Define database schema: submissions table, library_cards table, curators table
- [ ] Implement API endpoints: POST /submissions, GET /submissions, GET /submissions/:id, POST /:id/approve, POST /:id/reject, POST /:id/request-changes, GET /library/updates, POST /library/cards
- [ ] Add basic authentication for curator access
- _Requirements: 1.1, 1.2_

## Task 2: Implement moderation UI

- [ ] Create queue list view with filters (status, category, date range) and sort (newest/oldest)
- [ ] Create submission detail view with card preview (shell + first 3 controls rendered)
- [ ] Show similar-category cards alongside each submission for uniqueness comparison
- [ ] Implement Approve / Request Changes / Reject actions with feedback text input (≤500 chars)
- [ ] Include "Allow background customization" toggle on approval form (pre-filled from submitter's choice, curator can override)
- [ ] "Request Changes" triggers notification to submitter, removes from active queue
- _Requirements: 1.3, 1.4, 1.5, 1.8, 1.9_

## Task 3: Implement library management and statistics

- [ ] Create library card builder (same shell + controls editing as mobile creation flow)
- [ ] Include "Allow background customization" toggle when creating Library cards
- [ ] Publish new Library cards immediately via POST /library/cards
- [ ] Create statistics dashboard: submissions this week, approval rate, top category, avg decision time, overdue count (>5 days pending)
- _Requirements: 1.6, 1.7, 1.8_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] }
  ]
}
```
