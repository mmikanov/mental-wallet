# Analytics Worker

Production analytics backend for Mental Health Wallet. Runs on Cloudflare Workers with D1 (SQLite) for storage.

## Architecture

```
App (production build)
  → POST /events (batch JSON payload)
  → Cloudflare Worker
  → D1 SQLite database

You (browser)
  → GET /dashboard?secret=<your-secret>
  → Same Worker serves HTML + fetches from /kpis
```

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler` (or use `npx wrangler`)

## First-Time Setup

### 1. Install dependencies

```bash
cd analytics-worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create the D1 database

```bash
npx wrangler d1 create analytics-db
```

This outputs a `database_id`. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "analytics-db"
database_id = "paste-your-database-id-here"
```

### 4. Run the migration

```bash
# Locally (for testing)
npm run db:migrate:local

# Remote (production D1)
npm run db:migrate:remote
```

### 5. Set the dashboard secret

This protects the dashboard and raw event endpoints from public access:

```bash
npx wrangler secret put DASHBOARD_SECRET
# Enter a strong random string when prompted
```

### 6. Deploy

```bash
npm run deploy
```

Wrangler will output the Worker URL, e.g.:
```
https://mental-wallet-analytics.<your-subdomain>.workers.dev
```

### 7. Update the app config

In `src/config/analytics.ts`, replace the placeholder:

```typescript
export const ANALYTICS_BASE_URL: string = __DEV__
  ? 'http://localhost:3001'
  : 'https://mental-wallet-analytics.<your-subdomain>.workers.dev';
```

## Usage

### View the dashboard

Open in your browser:
```
https://mental-wallet-analytics.<your-subdomain>.workers.dev/dashboard?secret=<your-secret>
```

### Query raw events

```bash
# All events (default limit 1000)
curl "https://mental-wallet-analytics.<your-subdomain>.workers.dev/events?secret=<your-secret>"

# Filter by event type
curl "https://mental-wallet-analytics.<your-subdomain>.workers.dev/events?secret=<your-secret>&event_type=tool_completed"

# Pagination
curl "https://mental-wallet-analytics.<your-subdomain>.workers.dev/events?secret=<your-secret>&limit=100&offset=200"
```

### Health check

```bash
curl https://mental-wallet-analytics.<your-subdomain>.workers.dev/health
# → {"status":"ok","service":"mental-wallet-analytics"}
```

## Local Development

```bash
npm run dev
```

This starts the Worker locally with a local D1 database. Run the migration first:

```bash
npm run db:migrate:local
```

Then test with curl:

```bash
curl -X POST http://localhost:8787/events \
  -H "Content-Type: application/json" \
  -d '{"events":[{"anonymous_user_id":"test-uuid-1234-5678-abcd-ef0123456789","session_id":"sess-uuid-1234-5678-abcd-ef0123456789","event_type":"app_opened","timestamp":"2025-07-22T10:00:00.000Z","properties":{"days_since_install":0}}]}'
```

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/events` | POST | None | Ingest batch payload from the app |
| `/events` | GET | Required | Return stored events (supports `limit`, `offset`, `event_type` params) |
| `/events` | DELETE | Required | Delete all stored events |
| `/dashboard` | GET | Required | Serve the analytics dashboard |
| `/kpis` | GET | Required | Return computed KPIs as JSON |
| `/health` | GET | None | Health check |

Auth is via `?secret=<value>` query param or `Authorization: Bearer <value>` header.

## Costs

Cloudflare Workers free tier includes:
- 100,000 requests/day
- D1: 5 million rows read/day, 100,000 rows written/day, 5 GB storage

This comfortably handles thousands of daily active users.

## Monitoring

View real-time Worker logs:

```bash
npm run tail
```

## Updating the Schema

To add new columns or indexes, create a new migration file:

```bash
# Create the file
touch migrations/0002_your_change.sql

# Apply locally
npx wrangler d1 execute analytics-db --local --file=./migrations/0002_your_change.sql

# Apply to production
npx wrangler d1 execute analytics-db --remote --file=./migrations/0002_your_change.sql
```
