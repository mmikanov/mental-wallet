# Requirements: Version Release Tracking

## Background
Both app stores run a build while it is in review, and the operator tests builds before they are public. Usage from those builds is not real-user usage, but it lands in the analytics dashboard. Instead of deleting data each release, we record when each version went live on each platform and the dashboard metrics ignore usage from before that moment.

This is a data-quality measure: store-review and tester traffic is not real users.

## Glossary
- **Go-live time**: the moment a version became publicly available on a store.
- **Metrics**: the numbers and breakdowns on the operator dashboard.
- **Raw event view**: the unfiltered list of every received event, used for diagnosis.

## Requirements

1. As the operator, I can record the go-live time for a version separately for iOS and Android, because the two stores publish at different times.
   - Recording again for the same platform and version replaces the earlier time.
2. As the operator, once a go-live time is recorded, the dashboard metrics ignore that version's usage that was received before that time on that platform.
   - A time recorded for one platform never hides the other platform's usage of the same version.
   - Usage received exactly at or after the go-live time counts.
3. As the operator, if no go-live time is recorded for a version and platform, all of its usage shows in the metrics.
   - Why: I want to watch a new release working while it is still in review, and this keeps all earlier versions intact until their dates are filled in.
   - There is no placeholder time entered at submission.
4. Usage with missing platform, version, or receipt time is never hidden.
5. Nothing is deleted. The raw event view and the overall stored-event total are unaffected by this filter.
6. As the operator, I see a "Releases" table at the very bottom of the dashboard with one row per platform and version: platform, version, go-live time, status, users, events, and how many pre-live events are hidden.
   - Newest version first, then platform.
   - Go-live times show in US Eastern time, with the exact UTC time on hover.
   - Status reads "Live", "Scheduled" (go-live is in the future), or "Not recorded — showing all events".
   - Versions with a recorded time but no usage yet still appear.
   - The table is not changed by the dashboard's phase, user, or channel selectors.
   - If the table cannot load, the rest of the dashboard still works and a short message appears.
7. When store dates for earlier versions are available, the operator can backfill them with the same recording step.
