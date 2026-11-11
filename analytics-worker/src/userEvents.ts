/**
 * Per-user event timeline drill-down query (GET /details/user-events).
 *
 * Pulled into its own pure module (like releases.ts / channel.ts) so the exact query and cap
 * are a single source of truth shared by the Worker handler and the SQL-level tests, without
 * the tests having to import the whole Worker (index.ts pulls in the dashboard HTML).
 *
 * Filtering decision (intentional — differs from every other /details/* endpoint): this is a
 * RAW per-user forensic timeline, so it deliberately does NOT apply the global
 * phase/cohort/channel filters, NOR the clock-skew / release read-time exclusions that
 * buildDetailFilter adds. The operator wants the user's FULL history in the exact order it was
 * recorded; hiding clock-skewed or pre-live rows here would leave unexplained gaps. The
 * endpoint is still auth-gated and capped.
 *
 * `userId` is passed as a positional bind param (?), NEVER string-interpolated, so it is
 * injection-safe regardless of contents. ORDER BY timestamp ASC gives the chronological
 * sequence. `properties` is returned as the raw stored JSON string (the frontend pretty-prints
 * it). The LIMIT bounds rows_read; the (anonymous_user_id, timestamp) index (idx_events_user)
 * makes the lookup a per-user range scan, not a full-table scan.
 */

// Cap the number of events returned to bound D1 row reads for very active users.
export const USER_EVENTS_LIMIT = 2000;

export const USER_EVENTS_SQL = `
    SELECT
      timestamp,
      event_type,
      session_id,
      platform,
      app_version,
      channel,
      country,
      properties
    FROM events
    WHERE anonymous_user_id = ?
    ORDER BY timestamp ASC
    LIMIT ?
  `;
