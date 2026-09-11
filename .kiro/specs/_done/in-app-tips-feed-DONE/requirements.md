# Requirements Document

## Introduction

Phase D of the messaging & content plan (`docs/messaging-and-content-plan.md`): an in-app
**tips feed** so the curated tips are useful to everyone with the app, not only people who
opted into email. It reuses the exact same content already produced for the web (Phase C2),
"author once, render many."

Core architecture (decided in the plan): the feed is a **thin index, not a content
renderer**. The app fetches the generated JSON index the website already serves
(`https://mentalhealthwallet.productsforgood.co/content/index.json`, live, 8 tips today),
renders a searchable / sortable / filterable native list of tip cards, and opens a tapped
tip's full article in an **in-app browser** (the article page on the marketing site). The
app never renders tip bodies itself; the website remains the single content home, so tip
edits ship via a website deploy with no app release.

In scope: a native feed screen (list of tip cards with search/filter/sort), fetching +
caching the JSON index, opening articles in an in-app browser, and a navigation entry
point. Out of scope: rendering article content natively, any change to the messaging
worker or website build, and the app-side email opt-in (that belongs to the separate
`app-deep-linking` spec).

Requires an app release. Stack context (per steering): React Native 0.81 / Expo SDK 54,
React Navigation 7, `@shopify/flash-list`, `expo-web-browser`, and the SafeAreaView /
accessibility conventions used elsewhere in the app.

## Requirements

### Requirement 1: Fetch and display the tips index

**User Story:** As a user, I want to browse the app's tips inside the app, so that I can
find helpful ideas without needing email.

#### Acceptance Criteria

1. THE app SHALL fetch the tips index from the website's published JSON index
   (`/content/index.json`) and render each tip as a card showing at least its title,
   summary, type, and topics.
2. THE feed SHALL be a native screen (using the app's existing list stack, e.g.
   `@shopify/flash-list`), NOT a WebView of the website index.
3. THE app SHALL NOT render tip article bodies itself; full content lives on the website.
4. WHEN the index is empty or unavailable, THE feed SHALL show a clear, friendly empty/error
   state rather than a blank screen.

### Requirement 2: Search, filter, and sort (client-side)

**User Story:** As a user, I want to search and filter the tips, so that I can find
something relevant to how I feel or what I want to do.

#### Acceptance Criteria

1. THE feed SHALL support client-side search over at least title, summary, and topics.
2. THE feed SHALL support filtering by tip type (feature / problem_solving / come_back) and
   by topic.
3. THE feed SHALL support sorting (at least by newest and by title).
4. Search/filter/sort SHALL run locally on the loaded index (no server round-trip per
   keystroke).

### Requirement 3: Open a tip's full article

**User Story:** As a user, I want to read the full tip, so that I can act on it.

#### Acceptance Criteria

1. WHEN a user taps a tip card, THE app SHALL open that tip's article URL (from the index
   entry) in an **in-app browser** (`expo-web-browser`), keeping the user in the app's
   context with a clean return to the feed.
2. THE app SHALL NOT kick the user out to an external browser (Safari/Chrome) for tip
   articles.
3. THE behavior SHALL be consistent with the app's existing external-link pattern (e.g.
   the 3rd-party app cards).

### Requirement 4: Caching and connectivity

**User Story:** As a user, I want the feed to still show something if I open it offline
after having used it, so that it feels reliable.

#### Acceptance Criteria

1. THE app SHALL cache the fetched index locally after a successful load, so the list is
   not blank when offline or when the fetch fails.
2. THE app SHALL refresh the index on open (and/or support pull-to-refresh), showing the
   latest tips when online.
3. THE article bodies remain online-only (opened in the in-app browser); this connectivity
   dependency is acceptable for a tips/KB feature and SHALL be handled gracefully (a clear
   message if a user taps an article while offline).
4. THE feed's network use SHALL be modest (one small JSON fetch per open/refresh); it does
   NOT touch the app's local SQLite data.

### Requirement 5: Navigation entry point

**User Story:** As a user, I want to find the tips feed easily, so that I actually use it.

#### Acceptance Criteria

1. THE tips feed SHALL be reachable from a clear, discoverable place in the app's
   navigation.
2. THE entry point SHALL fit the existing navigation model (React Navigation 7:
   native-stack + bottom-tabs) without disrupting the primary wallet flow.
3. THE entry point SHALL be the **Wallet kebab (⋮) menu** (alongside Add Tool / Create Tool
   / Insights / Archive / Settings), NOT buried in the already-dense Settings screen and NOT
   a bottom tab (the tab bar is hidden by design). This keeps it discoverable on the primary
   screen without crowding Settings.

### Requirement 6: Consistency, accessibility, and privacy

**User Story:** As a user, I want the feed to look and behave like the rest of the app and
respect my privacy.

#### Acceptance Criteria

1. THE feed SHALL follow the app's visual design and accessibility conventions (SafeAreaView
   from `react-native-safe-area-context`, labelled controls, adequate contrast, screen-reader
   friendly cards).
2. THE feed SHALL NOT collect or transmit any personal data; fetching the public JSON index
   and opening public article URLs involves no PII, consistent with the app's no-personal-data
   posture.
3. Any analytics for the feed (e.g. a "tip opened" event) SHALL, if added, use the existing
   anonymous analytics pattern and be treated as a separate decision (see open questions).

## Open Questions (design)

- **Entry point placement** (Req 5.3): DECIDED — the Wallet kebab (⋮) menu (not Settings,
  not a tab).
- **Index source URL** config: hardcode the production URL vs. an app config value (so dev
  builds could point elsewhere). Likely a small config constant.
- **Cache mechanism**: simple persisted cache (AsyncStorage / a file) vs. the app's existing
  storage patterns; and cache TTL / staleness handling.
- **Analytics**: whether to emit an anonymous "tip opened" / "tips feed viewed" event to
  learn which tips resonate (would reuse the analytics worker; privacy-preserving), or ship
  the feed with no tracking first.
- **Deep-link alignment**: once `app-deep-linking` ships, a tip's CTA (currently a store
  link) could deep-link into the app; the in-app feed opening the web article is
  independent of that and fine as-is for now.
