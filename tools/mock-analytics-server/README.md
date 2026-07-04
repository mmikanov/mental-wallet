# Mock Analytics Server

A local development server that receives, stores, and visualizes analytics events from Mental Health Wallet. Use it to validate the full event pipeline end-to-end without setting up real infrastructure.

## Setup

```bash
cd tools/mock-analytics-server
npm install
```

## Usage

From the project root:

```bash
npm run mock-analytics
```

Or directly:

```bash
node tools/mock-analytics-server/index.js
```

The server starts on port 3001 by default.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/events` | Receive a batch payload of analytics events |
| GET | `/events` | Return all received events as JSON |
| DELETE | `/events` | Clear all stored events |
| GET | `/dashboard` | HTML dashboard with computed KPIs |

### POST /events

Accepts the standard `Batch_Payload` format:

```json
{
  "events": [
    {
      "anonymous_user_id": "550e8400-e29b-41d4-a716-446655440000",
      "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "event_type": "tool_completed",
      "timestamp": "2025-01-15T14:30:00.123Z",
      "properties": {
        "card_id": "abc123",
        "card_category": "grounding-calming",
        "origin_badge": "library",
        "duration_ms": 45000
      }
    }
  ]
}
```

Returns `200` with `{ accepted, total }` on success, `400` for malformed payloads.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3001` | Server port |
| `ERROR_RATE` | `0` | Percentage (0–100) of requests that return HTTP 500 to simulate failures for retry testing |

Example with error simulation:

```bash
ERROR_RATE=20 npm run mock-analytics
```

## Dashboard

Open `http://localhost:3001/dashboard` in a browser to see live KPIs:

- **Total events received** — count of all events stored
- **Unique anonymous users** — distinct `anonymous_user_id` values
- **Onboarding completion rate** — users with `onboarding_completed` / users with `app_opened`
- **Mode split** — percentage of `wallet_first` vs `emotion_first` selections
- **Tool completion rate** — `tool_completed` count / `tool_opened` count
- **Outcome positivity rate** — (calmer + clearer + hopeful) / total `outcome_response` events
- **Retention by days_since_install** — unique users at D0, D1, D7, D30 buckets

The dashboard auto-refreshes every 5 seconds.

## Data Storage

Events are persisted to `received_events.json` in the server directory. This file is created automatically on first received batch. Delete the file or use `DELETE /events` to reset.

## Workflow

1. Start the mock server: `npm run mock-analytics`
2. Start the app in development mode: `npm start`
3. The app's analytics transmitter sends batches to `http://localhost:3001` by default in dev builds
4. Use the in-app stress test to generate multi-user data
5. Open `http://localhost:3001/dashboard` to review KPIs
6. Use `DELETE /events` or the dashboard "Clear All Events" button to reset between test runs
