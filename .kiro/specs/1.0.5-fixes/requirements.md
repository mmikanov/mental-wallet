# Requirements Document

## Introduction

This spec covers three defects found after the 1.0.4 release, to be fixed in **1.0.5**:

1. **Android deep links fail on a physical device** (they work on iOS TestFlight and worked on the Android emulator, but not on a real Android installed from the Play Store). This affects both an externally-authored HTTPS link like `https://mentalhealthwallet.productsforgood.co/app/checkin` and the in-app per-card reminder tap.
2. **The Insights "Practice time" series always shows 0.** The duration-tracking feature (store + service + AppState tracker) was fully built and unit-tested but was never wired into the card lifecycle, so `duration_records` is never written in normal use — only the dev seeder populates it.
3. **The Outcome Trends graph renders the label "1m" twice** on the right (duration) axis when the duration range is near-zero, because the top and midpoint ticks both round to 1.

Each bug is treated as a self-contained fix. Bugs 2 and 3 are pure-JS and shippable independently; Bug 1 is native/on-device and depends on the Play-Store signing key and the deployed `assetlinks.json`, so it requires an on-device verification pass and (per the debugging steering) an instrumentation step before any speculative code fix.

## Glossary

Terms used in plain language below (the technical detail lives in the design document):

- **Web link**: A normal `https://…` link (e.g. `…/app/checkin`) that, when tapped or shared, should open the app on a specific tool.
- **App's private link**: The app's own `mentalwallet://…` link format, used internally (e.g. by a reminder). Works without any website setup, so it's a dependable way to test.
- **Website ownership file**: A small file our website serves that tells Android "this app is allowed to open my links." Android only opens web links directly in the app if this file matches the app as it was published.
- **Practice time**: How long a user actively spends in a tool while it's open on screen. Shown as one of the lines on the Insights graph.
- **Session**: One stretch of using a tool, from opening it to closing/finishing it. Each session's practice time is what feeds the graph.

## Requirements

---

## Bug 1 — Android deep links fail on a physical device

**Note:** This bug shows up as two separate cases that both fail on a real Android phone but need different fixes. We treat them as two sub-bugs:
- **1a — Shared/typed web links:** a link like `https://mentalhealthwallet.productsforgood.co/app/checkin` should open the app on the right tool, not bounce to the browser.
- **1b — Reminder taps:** tapping a tool's reminder notification should open the app on that tool.

### Requirement 1: Confirm what's actually failing on a real device before fixing

**User Story:** As the team, we want to see what actually happens on a real Android phone before we change any code, so we fix the real cause instead of guessing (this kind of problem can only be proven on a physical device, not in the repo or an emulator).

#### Acceptance Criteria

1.1 BEFORE any fix is written, THE team SHALL gather evidence from a real Android phone running the Play Store build, and confirm which of the two cases (1a, 1b) is failing and why.

1.2 For the web-link case (1a), THE team SHALL confirm whether Android recognizes our app as the verified owner of the website link, and whether the ownership file the website serves matches the app as published through the Play Store. (Note: the emulator used a different app signature, which is likely why it worked there but not on the store build.)

1.3 For the reminder-tap case (1b), THE team SHALL confirm, on the device, whether tapping the notification actually reaches the app and carries the information needed to identify which tool to open.

1.4 Any temporary diagnostic logging added to gather this evidence SHALL be removed before the fix ships.

### Requirement 2: Shared and typed web links open the app (case 1a)

**User Story:** As a user, I want a link like `…/app/checkin` to open the app on the check-in tool, so links I tap or share work on my Android phone the same way they do on iPhone.

#### Acceptance Criteria

2.1 Tapping a supported web link (e.g. `…/app/checkin`) on Android SHALL open the app directly on the intended tool, without first going to the browser or showing an app-chooser dialog.

2.2 IF the cause is that the website's ownership file doesn't match the app as published on the Play Store, THEN that file SHALL be corrected (and the copy kept in our codebase SHALL be updated to match), so Android verifies the app as the link's owner.

2.3 THE app's private link format (the `mentalwallet://…` scheme) SHALL keep working as a dependable way to test, since it doesn't rely on website verification.

2.4 This case can only be confirmed on a real phone using the store-signed build (not the repo or an emulator). THE exact steps to verify SHALL be written down and handed to whoever tests on-device.

### Requirement 3: Reminder taps open the right tool on Android (case 1b)

**User Story:** As a user, I want tapping a tool's reminder on Android to open that specific tool, so my reminders are actually useful — the way they already work on iPhone.

#### Acceptance Criteria

3.1 THE fix SHALL be based on the on-device evidence from Requirement 1, not guesswork. We SHALL NOT ship a second guess for this without first confirming (via a log/observation) that the first attempt didn't work.

3.2 Tapping a tool's reminder notification on Android SHALL open the app on that tool — whether the app was fully closed or already running in the background — matching iPhone behavior.

3.3 A safeguard test SHALL cover the part that was actually broken, so this specific failure can't quietly come back.

3.4 This case can only be confirmed on a real phone. THE exact on-device test steps SHALL be written down and handed to whoever tests on-device.

---

## Bug 2 — Insights "Practice time" always shows 0

### Requirement 4: Practice time reflects real tool usage

**User Story:** As a user, I want the "Practice time" line in Insights to show how long I actually spend using a tool, so the graph is meaningful instead of always sitting at zero.

**Background:** The app was already designed to time how long a tool is open and in front of the user, but that timing was never switched on, so no usage was ever recorded and the line always reads zero. This requirement is about turning that timing on and connecting it to the moments a tool is opened and closed.

#### Acceptance Criteria

4.1 WHEN a user opens a tool into active use, THE app SHALL begin timing that session.

4.2 WHEN a user finishes a tool, THE app SHALL record the session as **completed**. WHEN a user closes or leaves a tool without finishing, THE app SHALL record the session as **closed without finishing**.

4.3 THE app SHALL only count time while the tool is actually open and on screen. Time while the app is in the background (e.g. the user switched apps) SHALL NOT be counted.

4.4 IF a user leaves a tool open and walks away, THE app SHALL automatically end the session after a period of inactivity (see Requirement 5), counting only the on-screen time up to that point.

4.5 Very brief opens (a few seconds, e.g. an accidental tap) SHALL NOT be recorded, so the graph isn't cluttered with noise.

4.6 AFTER a user spends a meaningful amount of time in a tool and finishes it, THE "Practice time" line in Insights SHALL show a non-zero value for that period. (The way minutes are calculated and drawn is already correct and SHALL NOT change — this requirement only ensures usage is actually recorded.)

4.7 Switching directly from one tool to another SHALL NOT double-count time or attribute one tool's time to another.

### Requirement 5: Auto-ended sessions are saved, not silently lost

**User Story:** As a user, I don't want any of my real practice time to disappear just because I left a tool open and walked away, so my usage history stays accurate.

**Background:** A session can end three ways — the user finishes the tool, the user closes it without finishing, or the user leaves it open and the app auto-ends it after a period of inactivity ("timed out"). Today the app can only save the first two; a timed-out session gets rejected when saved and its time is silently lost. This becomes a real problem the moment timing is switched on (Requirement 4), so it's fixed in the same release.

#### Acceptance Criteria

5.1 THE app SHALL be able to save all three kinds of session ending — finished, closed without finishing, and auto-ended (timed out) — without any of them being silently dropped.

5.2 An auto-ended session SHALL record only the real on-screen time the user spent before walking away (it SHALL NOT assume the full inactivity period was active use).

5.3 Saving these sessions SHALL NOT disturb or lose any usage already recorded on a user's device.

5.4 **Decision for 1.0.5:** auto-ended (timed-out) sessions SHALL be saved but SHALL NOT be included in the "Practice time" line for now. Rationale: we know the tool was open, but not that the user was engaged the whole time, so counting it could overstate practice time. This is a deliberate, revisitable choice — once we see real data we can decide whether to include them. Only **finished** sessions count toward the "Practice time" line in 1.0.5.

### Requirement 6: Tell users what practice time does (and doesn't) include

**User Story:** As a user, I want to know that "Practice time" measures time spent in the app on a tool and doesn't include time I spend in an external app or on external media, so I understand the number and don't think it's wrong.

**Background:** Some tools link out to other apps (e.g. Headspace, Calm) or open external media. Because that activity happens outside our app, we can't measure it, and time spent there isn't part of "Practice time." Rather than build external-time tracking now, we simply tell the user this up front. (Bringing users back from a third-party app, and any related time accounting, is deferred to a future spec.)

#### Acceptance Criteria

6.1 THE Insights pages SHALL show a short, plain-language note near the practice-time graph explaining that practice time reflects time spent using a tool inside the app and does not include time spent in external apps or on external media.

6.2 THE note SHALL appear on BOTH places the graph is shown — the per-tool Insights page and the whole-wallet Insights page.

6.3 THE note SHALL be brief and unobtrusive (a caption/subtext near the graph), not a blocking dialog.

### Requirement 7: Insights help text stays honest

**User Story:** As a user, I want the Insights explanations to match what the graph actually shows, so I keep trusting it.

#### Acceptance Criteria

7.1 This work turns on existing behavior; it does NOT change how insights are calculated (the correlation method, scoring, or thresholds). No methodology is changing.

7.2 THE team SHALL confirm the "Practice time" tooltip and help text still accurately describe the now-working line, and update the wording only if it implied a different source of the data. (Note: if any calculation or threshold ever does change, the explainability steering requires updating the tooltips, help page, tier hints, and wireframes in the same change — not expected here.)

---

## Bug 3 — Duplicate "1m" label on the Outcome Trends graph

### Requirement 8: The graph never shows the same label twice

**User Story:** As a user, I want the graph's minute labels to read clearly and not repeat, so the graph looks trustworthy rather than broken.

**Background:** The "Practice time" side of the graph shows three minute markers (top, middle, bottom). When there's little or no practice time, two of those markers can round to the same value and both display "1m", which looks like a glitch. (The screenshot shows "1m" appearing twice.)

#### Acceptance Criteria

8.1 WHEN there is little or no practice-time data, THE graph's minute markers SHALL NOT display the same label twice.

8.2 This SHALL hold on its own, even before real practice time is recorded (i.e. even with an empty graph, no duplicate label appears) — so it's fixed independently of Requirement 4.

8.3 THE fix SHALL be limited to the minute (practice-time) labels. The left-side check-in score labels and the "Felt better" line SHALL be unaffected.

8.4 THE fix SHALL be checked against three cases — no practice time at all, a small amount (under a couple of minutes), and a normal multi-minute amount — and none SHALL show a repeated label.

8.5 THE fix SHALL apply everywhere this graph appears — both the per-tool Insights screen and the wallet-level insights section.

---

## Out of Scope

- The full Expo **prebuild migration** (single-source-of-truth for native config) remains a separate spec (`.kiro/specs/prebuild-migration/`).
- Making a hand-typed/shared web link able to open one *specific* user-added tool by its private ID. That ID is unique per phone, so a link authored elsewhere can't reliably point to it. The tools reachable by shareable links (like the check-in) already work by name, which covers the common cases. Noted as a possible future improvement only.
- Any change to the correlation/insights **methodology** (formulas, thresholds, tiers).
- **Measuring time spent in external apps or on external media.** We can't track activity that happens outside our app, so it isn't counted in practice time. For 1.0.5 we simply disclose this to the user (Requirement 6). Bringing users back from a third-party app, and any related time accounting, is deferred to its existing future spec.
