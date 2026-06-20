# Design Document

## Overview

Separate web application (React + Vite + TypeScript) with a Node.js/Express REST API backed by PostgreSQL. Communicates with the mobile app via REST endpoints.

## Architecture

Standalone project in `curator-admin/` directory. Separate from the mobile app codebase. The mobile app POSTs submissions and GETs library updates from this API.

## Components and Interfaces

### API Endpoints

- `POST /submissions` — Mobile app submits a card
- `GET /submissions` — List queue with filters (status, category, date range) and sort
- `GET /submissions/:id` — Submission detail with card preview
- `POST /submissions/:id/approve` — Approve submission (includes allowBackgroundCustomization override)
- `POST /submissions/:id/reject` — Reject with feedback text
- `POST /submissions/:id/request-changes` — Request revision with feedback
- `GET /library/updates?since=timestamp` — Mobile fetches new community/library cards
- `POST /library/cards` — Curator creates a new Library card (includes allowBackgroundCustomization flag)

### Frontend Pages

1. **Queue View**: Filterable/sortable list of submissions with status badges
2. **Detail View**: Full card preview (shell + controls), similar cards sidebar, action buttons
3. **Library Management**: Card builder for creating new Library cards
4. **Statistics**: Weekly submissions, approval rate, top category, avg decision time, overdue count

### Tech Stack

- Frontend: React 18, Vite, TypeScript, TailwindCSS
- Backend: Express.js, TypeScript, PostgreSQL, Prisma ORM
- Auth: Basic auth or OAuth for curator access (initial implementation)

## Data Models

Server-side PostgreSQL schema mirrors mobile submissions table plus curator audit fields. Library cards synced to mobile as JSON payloads.

## Testing Strategy

- API integration tests for each endpoint
- Frontend component tests for queue filtering and actions
- E2E test: submit from mobile → appears in queue → approve → available in library updates
