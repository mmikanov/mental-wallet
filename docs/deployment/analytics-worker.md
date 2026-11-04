# Analytics Worker (Cloudflare Workers)

The production analytics backend runs on Cloudflare Workers with D1 (SQLite) storage. It receives events from production app builds and serves the analytics dashboard.

**Live dashboard URL:**
```
https://mental-wallet-analytics.<your-subdomain>.workers.dev/dashboard?secret=<DASHBOARD_SECRET>
```

> Full setup instructions (first-time database creation, migrations, etc.) are in `analytics-worker/README.md`.

---

## Deploy Updates

```bash
cd analytics-worker
npm run deploy
```

This pushes the latest worker code to Cloudflare. Takes ~10 seconds. The dashboard URL stays the same.

### When to deploy

- After any change to `analytics-worker/src/index.ts` or `analytics-worker/src/dashboard.ts`
- After adding new migrations (run the migration first, then deploy)
- After changing `wrangler.toml` environment variables

---

## Run New Migrations (Production)

If you've added a new migration file in `analytics-worker/migrations/`:

```bash
cd analytics-worker
npx wrangler d1 execute analytics-db --remote --file=./migrations/<filename>.sql
```

Always run the migration before deploying the code that depends on the new schema.

---

## Record a Version's Go-Live Time (Release Filter)

Store review and tester (TestFlight / internal track) traffic arrives before a version is public. Metrics ignore a version's events **received before** its recorded go-live time, per platform. No row for a (platform, version) means all its events are shown (so you can watch a release during review, and history stays intact). Nothing is deleted, and the raw `/events` view and the D1 health total are not filtered.

Once a version is public on a store, record it (run the migration first if `version_releases` does not exist yet: `0006_create_version_releases.sql`):

```bash
CLOUDFLARE_ACCOUNT_ID=<id> npx wrangler d1 execute analytics-db --remote --command "INSERT INTO version_releases (platform, app_version, live_at, created_at, updated_at) VALUES ('android','1.0.6','2026-11-05T14:00:00Z', datetime('now'), datetime('now')) ON CONFLICT(platform, app_version) DO UPDATE SET live_at=excluded.live_at, updated_at=excluded.updated_at;"
```

`CLOUDFLARE_ACCOUNT_ID` is required for `wrangler d1 execute --remote` in this setup. `platform` is `ios` or `android`; `live_at` is ISO-8601 UTC. Re-running with a new time updates it.

Where to find the go-live time:
- **App Store Connect**: the version's Activity tab, the status change to Ready for Sale.
- **Google Play Console**: Production, Releases, or the Publishing overview.
- A console may show only a date. Use the start of that day (UTC) as a conservative boundary.

**Skipped versions (never shipped publicly).** When a version number is consumed but never released on a platform (e.g. to keep iOS and Android versions in sync), record it with the sentinel `live_at = '9999-12-31T00:00:00Z'`. All of its events are then hidden from metrics, and the Releases table shows it as "Never released":

```bash
CLOUDFLARE_ACCOUNT_ID=<id> npx wrangler d1 execute analytics-db --remote --command "INSERT INTO version_releases (platform, app_version, live_at, note, created_at, updated_at) VALUES ('android','1.0.2','9999-12-31T00:00:00Z','Skipped - never released', datetime('now'), datetime('now')) ON CONFLICT(platform, app_version) DO UPDATE SET live_at=excluded.live_at, note=excluded.note, updated_at=excluded.updated_at;"
```

Do NOT use this for a version that is merely in store review: leave it without a row so its early traffic stays visible until you record the real go-live time.

The **Releases** table at the bottom of the dashboard lists every version per platform with its go-live time, status, and how many pre-live events are hidden.

## Set or Update Secrets

```bash
cd analytics-worker
npx wrangler secret put DASHBOARD_SECRET
# Enter a strong random string when prompted
```

---

## Set Launch Phase Milestone Dates

Edit `analytics-worker/wrangler.toml` and fill in the dates:

```toml
[vars]
MILESTONE_RELEASE = "2026-09-01T00:00:00Z"    # When app goes live on stores
MILESTONE_WARM_END = "2026-09-15T00:00:00Z"   # When warm-only window closes
MILESTONE_COLD_START = "2026-09-15T00:00:00Z" # When cold acquisition begins
```

Then deploy:

```bash
cd analytics-worker
npm run deploy
```

The dashboard phase filter buttons will activate once dates are set.

### How milestones map to dashboard filters

```
Timeline:  ──────────|──────────────────|──────────────────────────→
                MILESTONE_RELEASE   MILESTONE_COLD_START
                                    (MILESTONE_WARM_END)
```

| Button | Shows data from | To |
|--------|----------------|-----|
| **All Time** | Beginning | Now (no filter) |
| **Pre-Release** | Beginning | `MILESTONE_RELEASE` |
| **Post-Release** | `MILESTONE_RELEASE` | Now (covers Warm + Cold together) |
| **Warm Launch** | `MILESTONE_RELEASE` | `MILESTONE_WARM_END` or `MILESTONE_COLD_START` (whichever is set) |
| **Cold Acquisition** | `MILESTONE_COLD_START` | Now |

In practice, `MILESTONE_WARM_END` and `MILESTONE_COLD_START` will usually be the same date (the warm phase ends when cold begins). You can set just `MILESTONE_COLD_START` and skip `MILESTONE_WARM_END` — the dashboard will use `MILESTONE_COLD_START` as the warm window's end.

**Minimum to get started:** Set `MILESTONE_RELEASE` to the day both stores are live. That gives you Pre-Release vs Warm Launch filtering immediately. Add `MILESTONE_COLD_START` later when you begin public outreach.

---

## Exclude Your Own Devices from KPIs

Your test usage will skew metrics. To exclude your device(s):

1. Open the app → triple-tap Settings header → Event Viewer
2. Tap the User ID to copy it to clipboard
3. Paste it into `analytics-worker/wrangler.toml`:

```toml
[vars]
EXCLUDED_USER_IDS = "3bcf9ef4-a3b6-456a-a998-c0afd8b7a123"
```

For multiple devices, comma-separate the IDs:

```toml
EXCLUDED_USER_IDS = "uuid-device-1,uuid-device-2"
```

4. Deploy: `cd analytics-worker && npm run deploy`

Excluded IDs are shown on the dashboard for reference. Events from excluded users are still stored — they're just filtered out of all KPI calculations.

---

## View Live Logs

```bash
cd analytics-worker
npm run tail
```

Shows real-time request logs (useful for debugging event ingestion issues).

---

## Verify It's Running

```bash
curl https://mental-wallet-analytics.<your-subdomain>.workers.dev/health
# → {"status":"ok","service":"mental-wallet-analytics"}
```

---

## Costs

Cloudflare Workers free tier: 100K requests/day, D1 free tier: 5M row reads/day, 100K writes/day, 5GB storage. Comfortably handles thousands of DAUs.
