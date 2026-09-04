# Store Listing Copy

> App name: "Mental Health Wallet" (branded as Mental Health Wallet™)

---

## Apple App Store

### Subtitle (30 chars max)
```
Coping Tools & Insights
```
(25 characters)

### Promotional Text (170 chars max, can be updated without new build)
```
Your personal toolkit for building coping habits. 20+ evidence-informed tools, custom card builder, personal insights — all private, all on your device.
```
(153 characters)

### Description (4000 chars max)
```
Mental Health Wallet puts your coping tools in one place — like a wallet for the techniques that help you feel better.

Browse a library of 20+ curated cards covering grounding, cognitive reframing, breathwork, body awareness, self-compassion, and daily check-ins. Each tool is based on established therapeutic approaches, with clear explanations of why it works.

Build your own cards too. Combine sliders, text inputs, choice buttons, and outcome trackers to create custom tools that match how you think and what you need.

WHAT YOU GET

• Curated Library — Grounding exercises, reframing prompts, breathing techniques, gratitude practices, and more. Each card explains the approach behind it.

• Custom Card Builder — Design your own coping tools with flexible controls. Make them as simple or detailed as you want.

• Connect Other Apps — Link cards to your favorite wellness, meditation, or breathing apps. Mental Health Wallet becomes the home base for your entire toolkit.

• Personal Insights — See usage streaks, outcome patterns, and which tools actually help. Discover what works for you over time.

• Reminders — Set per-tool reminders so your practice becomes a habit, not an afterthought.

• Card Wallet — Organize your tools in a swipeable stack. Focus on one, expand it, use it, done.

• Privacy First — No accounts, no cloud sync, no data collection. Everything stays on your phone.

WHO IT'S FOR

Mental Health Wallet is for anyone who wants to:
- Build consistent coping habits
- Organize techniques from therapy, books, or self-discovery
- Understand which tools actually help them
- Have go-to tools ready when stress hits

It's not a replacement for therapy — it's a toolkit to complement it.

IMPORTANT NOTES

• Mental Health Wallet is not a substitute for professional mental health care
• If you are in crisis, please contact the 988 Suicide & Crisis Lifeline or your local emergency services
• Crisis resources are accessible within the app at all times
• Currently in beta — free to download and use
```

### Keywords (100 chars max, comma-separated)
```
coping,mental health,wellness,self-care,anxiety,mindfulness,journal,habit,grounding,insights
```
(92 characters)

---

## Google Play Store

### Short Description (80 chars max)
```
A card-based toolkit to build coping habits and discover what works for you.
```
(76 characters)

### Full Description (4000 chars max)
```
    Mental Health Wallet puts your coping tools in one place — like a wallet for the techniques that help you feel better.

    Browse a library of 20+ curated cards covering grounding, cognitive reframing, breathwork, body awareness, self-compassion, and daily check-ins. Each tool is based on established therapeutic approaches, with clear explanations of why it works.

    Build your own cards too. Combine sliders, text inputs, choice buttons, and outcome trackers to create custom tools that match how you think and what you need.

    WHAT YOU GET

    ✦ Curated Library — Grounding exercises, reframing prompts, breathing techniques, gratitude practices, and more. Each card explains the approach behind it.

    ✦ Custom Card Builder — Design your own coping tools with flexible controls. Make them as simple or detailed as you want.

    ✦ Connect Other Apps — Link cards to your favorite wellness, meditation, or breathing apps. Mental Health Wallet becomes the home base for your entire toolkit.

    ✦ Personal Insights — See usage streaks, outcome patterns, and which tools actually help. Discover what works for you over time.

    ✦ Reminders — Set per-tool reminders so your practice becomes a habit, not an afterthought.

    ✦ Card Wallet — Organize your tools in a swipeable stack. Focus on one, expand it, use it, done.

    ✦ Privacy First — No accounts, no cloud sync, no data collection. Everything stays on your phone.

    WHO IT'S FOR

    Mental Health Wallet is for anyone who wants to:
    • Build consistent coping habits
    • Organize techniques from therapy, books, or self-discovery
    • Understand which tools actually help them
    • Have go-to tools ready when stress hits

    It's not a replacement for therapy — it's a toolkit to complement it.

    IMPORTANT

    • Mental Health Wallet is not a substitute for professional mental health care
    • If you are in crisis, please contact the 988 Suicide & Crisis Lifeline or your local emergency services
    • Crisis resources are accessible within the app at all times
    • Currently in beta — free to download and use
```

---

## Version History — "What's New" (Apple App Store)

Track the release notes submitted for each Apple version here. Newest first.

### Unreleased (next version — not yet built)

Running list of changes landed in the repo since 1.0.3 but NOT yet shipped to any store. Finalize the version number and "What's New" copy when building. Bump the marketing version in all four places (see the release checklist) since 1.0.3 is already live.

**Changes landed (developer-facing):**
- **Fix: emotion sessions were being over-counted.** The active emotion session ended (and re-logged its analytics `session_ended` event) on transient iOS foreground interruptions (Control Center, app switcher, permission prompts, call banners), and `endSession()` had no re-entrancy guard — so a single session could log many endings. Now `endSession()` fires at most once per session, and the app only ends a session on a real background transition, not on `inactive`. Files: `src/stores/sessionStore.ts`, `src/navigation/RootNavigator.tsx` (+ `sessionStore.endSessionIdempotency.test.ts`).
  - **User-facing angle (optional for notes):** more accurate session/insights data; sessions are no longer cut short by momentary interruptions.
  - **Not user-visible enough to require a "What's New" bullet** — reviewer/internal note is enough. Include a line only if we want to signal "improved reliability."
  - **Data caveat:** only events from this build onward are clean; historical `session_ended` data stays duplicated. The analytics dashboard's emotion-sessions drill-down still carries a "read as proportions" note until this ships — remove that note after release.

_(Analytics-worker dashboard changes — Emotion Sessions card/drill-down, Active/New users filter — are already deployed server-side and do NOT depend on an app release.)_

**Draft "What's New" (Apple) — fill in at build time:**
```
(TBD — add a reliability bullet if desired, e.g. "Emotion sessions are no longer interrupted by switching apps, and session data is more accurate.")
```

### 1.0.3

**Promotional Text (in use):**
```
Your personal toolkit for building coping habits. 20+ evidence-informed tools, custom card builder, personal insights — all private, all on your device.
```

**What's New in This Version:**
```
Thanks for trying Mental Health Wallet. This update brings one new capability and a round of polish:

• Media that plays inline — cards with a YouTube, Spotify, or other media link now play right inside the card, with a one-tap option to open the full app.
• Attached images now stick around reliably.
• Smoother scrolling in the guided check-in and tool previews.
• Layout and display fixes across the app.

Have feedback? We'd love to hear it — reach us from Settings.
```

**Notes:** First update since the initial App Store release (1.0.1). Apple version jumped from 1.0.1 to 1.0.3 to stay consistent with the Google Play version numbering (1.0.2 was skipped on the App Store).

### 1.0.1

Initial App Store release. (No "What's New" — first version.)

---

## Version History — Release Notes (Google Play)

Google Play release notes use `<en-US>...</en-US>` language tags and have a **500-character limit per language**. Set them per release in Play Console → Production → (release) → Release notes. Newest first.

### 1.0.3 (versionCode 6)

```
<en-US>
This update brings one new capability and a round of polish:

• Media that plays inline — cards with a YouTube, Spotify, or other media link now play right inside the card, with a one-tap option to open the full app.
• Attached images now stick around reliably.
• Smoother scrolling in the guided check-in and tool previews.
• Layout and display fixes across the app.

Have feedback? Reach us from Settings.
</en-US>
```

---

## Notes

- Apple uses bullet points (•), Google Play supports more symbols (✦, ★, etc.)
- Apple keywords are hidden metadata; Google Play uses the description text itself for search ranking
- The promotional text (Apple only) can be updated anytime without a new app build — useful for seasonal messaging or feature launches
- Replace "Mental Wallet" with final app name before submission
