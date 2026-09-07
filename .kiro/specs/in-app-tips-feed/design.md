# Design Document

## Overview

A native "Tips" screen that fetches the website's published JSON index
(`/content/index.json`), renders a searchable/filterable list of tip cards, and opens a
tapped tip's full article in an in-app browser. The app never renders tip bodies; the
website stays the single content home, so tip edits ship with no app release.

This design is grounded in the app's actual conventions (verified in the codebase), not
generic React Native. Notably it corrects two assumptions from the requirements:
- **Lists:** the app uses `FlatList` everywhere (no `FlashList` usage exists), so the feed
  uses `FlatList` to match, not introduce a one-off dependency pattern.
- **Navigation:** the bottom tab bar is hidden (only a `Wallet` tab); every ancillary
  destination (Archive, Settings, Insights, About) is a **push stack screen** reached from
  a menu. The Tips feed follows the same pattern — a stack screen, not a tab.

## Architecture

```
TipsFeedScreen (native, FlatList of tip cards)
  → tipsService.getTips()  ─┬─ fetch {TIPS_INDEX_URL}  (network)
                            └─ cache to a local file (expo-file-system)
  → search / filter / sort  (in-memory over the loaded array)
  → tap a card → WebBrowser.openBrowserAsync(tip.url)  (in-app browser)
```

No backend/worker change. No SQLite involvement. One small JSON GET per open/refresh.

## Files (new + touched)

New:
- `src/screens/TipsFeedScreen.tsx` — the feed screen (header, search/filter/sort controls,
  FlatList of cards, loading/empty/error states).
- `src/services/tipsService.ts` — fetch + cache the index, expose a typed `getTips()`.
- `src/types/tips.ts` — the `Tip` type mirroring an `index.json` entry.

Touched:
- `src/config/appInfo.ts` — add `TIPS_INDEX_URL` constant.
- `src/navigation/types.ts` — add `Tips: undefined` to `RootStackParamList`.
- `src/navigation/RootNavigator.tsx` — register `<Stack.Screen name="Tips" .../>`.
- An entry point screen (e.g. `SettingsScreen.tsx` and/or the wallet menu) — add a "Tips"
  nav item (see Navigation entry).
- `src/types/analytics.ts` + caller — OPTIONAL `tips_feed_viewed` / `tip_opened` events.

## Data model

`src/types/tips.ts` mirrors an `index.json` entry (verified live shape):

```ts
export interface Tip {
  slug: string;
  title: string;
  summary: string;
  type: 'feature' | 'problem_solving' | 'come_back';
  topics: string[];
  heroImage: string;            // may be ""
  cta: { label: string; url: string } | null;
  url: string;                  // article path, e.g. "/tips/welcome"
  publishedAt: string;          // ISO date
}
```

Note `url` is a site-relative path (`/tips/<slug>`); the service resolves it against the
site origin when opening the in-app browser.

## Service: `tipsService.ts`

- `TIPS_INDEX_URL` in `appInfo.ts` = `https://mentalhealthwallet.productsforgood.co/content/index.json`
  (same base domain as the existing `PRIVACY_POLICY_URL`, etc.).
- `getTips(): Promise<{ tips: Tip[]; fromCache: boolean }>`:
  1. `fetch(TIPS_INDEX_URL)`. On success: parse, validate shape, write the raw JSON to a
     cache file, return `{ tips, fromCache: false }`.
  2. On network/parse failure: read the cache file; if present, return
     `{ tips, fromCache: true }`; else throw (screen shows error/empty).
- **Cache mechanism:** a single JSON file via `expo-file-system` (in the stack). Chosen over
  SQLite (the index isn't relational; a blob file is simpler) and over AsyncStorage (not
  used in this app). Cache key is just the file; overwrite on each successful fetch.
- Article URL resolution: `resolveTipUrl(tip)` = site origin + `tip.url`.
- No PII, no auth. Pure public read.

## Screen: `TipsFeedScreen.tsx`

Follows the app's screen conventions (verified against `ArchiveScreen`):
- Root `SafeAreaView` from `react-native-safe-area-context`.
- Custom in-component header (back button "← Back" → `navigation.goBack()`, centered title
  "Tips", spacer) — no native header (global `headerShown: false`).
- `useState` for `tips`, `isLoading`, `error`; `useEffect` loads on mount; pull-to-refresh.
- **List:** `FlatList` of tip cards (matching the app; not FlashList). Each card: title,
  summary, a type badge, topic chips. `keyExtractor={(t) => t.slug}`.
- **Controls:** a search `TextInput`, a type filter (all/feature/problem_solving/come_back),
  a topic filter (from the union of topics), and a sort (newest/title). All operate
  in-memory over the loaded `tips` via a `useMemo`-derived filtered list.
- **States:**
  - loading → centered `ActivityIndicator` (`#4A90D9`, the app's accent).
  - empty (no tips match filters) → friendly empty view (emoji + message), matching the
    Archive empty-state style.
  - error (fetch failed AND no cache) → a clear inline message with a retry button
    (this app has no inline-error convention, so we add a simple one here; action errors
    elsewhere use `Alert`, but a persistent inline retry is better for a whole-screen load).
- **Tap a card:** `WebBrowser.openBrowserAsync(resolveTipUrl(tip))` (the Settings pattern).
  If offline, `openBrowserAsync` will surface the browser's own error; we also guard with a
  friendly message when we already know we're showing cached data and the tap fails.
- Styling: `StyleSheet.create` with the app's hardcoded palette (`#F8F9FA` bg, `#FFFFFF`
  cards, `#4A90D9` accent, `#1A1A1A`/`#666` text, `borderRadius: 12`, `padding: 16`,
  44px touch targets), accessibility labels/roles on interactive elements.

## Navigation entry (resolves Requirement 5)

- Register `Tips` as a **push stack screen** in `RootStackParamList` (`Tips: undefined`) and
  `RootNavigator` (default push presentation), matching Archive/Settings/etc.
- **Entry point: the Wallet kebab (⋮) menu** (`src/components/wallet/WalletHeader.tsx`), NOT
  Settings. Settings is already dense, and burying a discovery feature there undercuts the
  goal of making tips discoverable. The wallet header menu is the menu users already open to
  manage their toolkit (Add Tool, Create Tool, Insights, Archive, Settings) — a "Tips" item
  there is discoverable, on the primary screen, and consistent with the existing pattern.
- Implementation: `WalletHeader` already supports optional menu items
  (`onAddToolPress?`, `onInsightsPress?`), so add an optional `onTipsPress?` prop and a
  corresponding menu item; wire it in `WalletScreen` to `navigation.navigate('Tips')`.
  Place "Tips" sensibly in the menu order (e.g. near Add/Create Tool, since it's about
  discovering helpful content). Not a tab — the tab bar is hidden by design.

## Analytics (optional, Requirement 6.3)

Optional and gated. If added:
- New `AnalyticsEventType` members `tips_feed_viewed` and `tip_opened` in
  `src/types/analytics.ts`.
- `void logEvent('tip_opened', { slug })` on card tap; `void logEvent('tips_feed_viewed')`
  on screen focus. Fire-and-forget, same as existing callers.
- Honors the existing opt-out (behavioral events suppressed when opted out) automatically.
- Ship-first option: no analytics initially; add later once the feed proves useful.

## Testing strategy

- Service: unit-test `getTips` success (parses + caches), network failure with cache
  (returns cached), failure without cache (throws); `resolveTipUrl` builds the right URL.
- Screen (manual/dev on simulator, plus component tests where practical):
  - loads and lists all 8 live tips; search/type/topic/sort work in-memory.
  - tapping a card opens the in-app browser to the correct article.
  - airplane mode after a first successful load → still shows cached list; tapping an
    article surfaces a graceful offline message.
  - empty-filter and error (no network + no cache) states render.
- Uses the LIVE `index.json` (already deployed), so most of this is testable by running the
  app against production content — no backend work needed.
- `npm run typecheck` and `npm run lint`; verify no existing screen/nav behavior changed.

## Release note

This is an app-side change → requires an app store release. Per the release-checklist
steering, bump the marketing version across all four files (app.json, Info.plist,
project.pbxproj, build.gradle) and prepare store release notes when shipping.
