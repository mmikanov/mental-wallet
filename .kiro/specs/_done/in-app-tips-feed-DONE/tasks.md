# Tasks

## Task 1: Tip type + config URL

- [x] Add `src/types/tips.ts` with the `Tip` interface (mirroring an `index.json` entry:
      slug, title, summary, type, topics, heroImage, cta, url, publishedAt)
- [x] Add `TIPS_INDEX_URL` to `src/config/appInfo.ts`
      (`https://mentalhealthwallet.productsforgood.co/content/index.json`)
- [x] Verify: typecheck; constant importable
- _Requirements: 1.1, 4.4_

## Task 2: tipsService (fetch + cache)

- [x] `src/services/tipsService.ts`: `getTips()` fetches the index, validates shape, caches
      the raw JSON to a file via `expo-file-system`; on failure falls back to the cached
      file; `resolveTipUrl(tip)` builds the absolute article URL from the site origin
- [x] Verify: unit tests for success (parse+cache), failure-with-cache (returns cached),
      failure-without-cache (throws), and URL resolution
- _Requirements: 1.1, 4.1, 4.2, 4.4_

## Task 3: TipsFeedScreen — list + states

- [x] Build `src/screens/TipsFeedScreen.tsx`: SafeAreaView root, custom header, FlatList of
      tip cards (title, summary, type badge, topic chips), loading / empty / error(+retry)
      states, pull-to-refresh; app palette + accessibility labels
- [x] Verify (dev/simulator against live index.json): lists all tips; loading/empty/error
      render; pull-to-refresh works
- _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2, 6.1_

## Task 4: Search, filter, sort (client-side)

- [x] Add search (title/summary/topics), type filter, topic filter, and sort (newest/title)
      operating in-memory over the loaded tips (useMemo-derived list)
- [x] Verify: each control narrows/sorts correctly; combined filters work; no per-keystroke
      network
- _Requirements: 2.1, 2.2, 2.3, 2.4_

## Task 5: Open article in in-app browser

- [x] On card tap, `WebBrowser.openBrowserAsync(resolveTipUrl(tip))`; graceful message if a
      tap fails while offline
- [x] Verify: opens the correct article in-app (not external); offline tap handled
- _Requirements: 3.1, 3.2, 3.3, 4.3_

## Task 6: Navigation entry

- [x] Add `Tips: undefined` to `RootStackParamList` and register the stack screen in
      `RootNavigator` (push presentation)
- [x] Add an optional `onTipsPress?` menu item to `WalletHeader` and wire it in
      `WalletScreen` to `navigation.navigate('Tips')` (the wallet kebab menu — NOT Settings)
- [x] Verify: reachable from the wallet menu; back returns cleanly; core wallet flow
      unaffected
- _Requirements: 5.1, 5.2, 5.3_

## Task 7: Optional analytics + finalize

- [x] (Optional) Add `tips_feed_viewed` / `tip_opened` to `AnalyticsEventType` and emit via
      `logEvent` (fire-and-forget, opt-out honored). May defer.
- [x] `npm run typecheck` + `npm run lint`; confirm no existing screen/nav behavior changed
- [x] Manual pass: full feed flow on a simulator against the live content
- _Requirements: 6.2, 6.3_

## Deferred / not in this pass

- Adding a real bottom tab (tab bar is hidden by design; Tips is a stack screen instead).
- Server-side search/pagination (client-side is fine at this catalog size).
- App store release itself: build/submit + version bump across the 4 version files +
  release notes (per the release-checklist steering) happen when shipping, outside this
  spec's build tasks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4", "5", "6"] },
    { "id": 4, "tasks": ["7"] }
  ]
}
```
