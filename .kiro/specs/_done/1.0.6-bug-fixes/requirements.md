# Requirements Document — 1.0.6 Bug Fixes

## Introduction

This spec collects bug fixes targeted for the 1.0.6 release:

- **Bug 1 — tip content consistency** across the three places a tip appears (website, email,
  in-app).
- **Bug 2 — the "Create your own tool" deep link** opens the wrong screen (library instead of
  the Create Tool builder).
- **Bug 3 — an archived tool's reminder still fires** (app; a recurrence of a bug believed
  fixed, still seen on 1.0.5).
- **Bug 4 — an unsubscribed person is mislabeled "waiting"** in the operator drip summary email.

The guiding principle for the content work (Bug 1), stated by the product owner:

> A tip's actual content — its title, hero image, body, and call-to-action — should be the
> **same everywhere it appears**. What changes between surfaces is only the surrounding
> **context**: the website wraps it in site header/footer, the email wraps it in a greeting and
> signature, and the in-app view shows it inside the app. The content itself should not differ.

Today that principle is violated: the website shows the full tip, but the email shows only a
short excerpt, and the in-app view is missing the call-to-action. This spec makes the three
surfaces render the same tip content.

### Background

A tip is authored once as a single source file (a title, a short **summary** excerpt, a longer
**body**, an optional **hero image**, and a **call-to-action** link). Three surfaces present it:

- **Website tip page** — renders the full tip (title, hero, full body, CTA), wrapped in the
  site's header/footer. This is the most complete rendering today.
- **Drip email** — currently renders only the title, the short summary, the hero, and the CTA.
  It is **missing the body**, so the email is noticeably thinner than the website page for the
  same tip.
- **In-app tip view** — currently shows the tip but is **missing the call-to-action**, so a
  reader in the app can't take the action the tip is about.

The reason the email and app are thin is structural, not a deliberate choice: the email and the
app both read a shared published summary/index of tips that was built to carry only the short
excerpt and the CTA, **not** the full body. Only the website build reads the full authored body.
So "make them consistent" means the full body (and the CTA) must reach all three surfaces, not
just the website. (The original tip spec explicitly intended the email to be able to carry the
body; the summary-only behavior crept in from that shared-index limitation.)

### Glossary

- **Tip** — a single authored piece of guidance (e.g. "Build your own tool"). Has a title, a
  short **summary**, a longer **body**, an optional **hero image**, and a **call-to-action**.
- **Summary** — a short standalone excerpt of a tip, suitable for a list/feed card or a preview.
  Distinct from the body.
- **Body** — the full tip content (several paragraphs). This is what the website tip page shows
  in full today.
- **Call-to-action (CTA)** — the tip's action link/button (e.g. "Create your own tool") that
  opens the relevant place in the app.
- **Surfaces** — the three places a tip is shown: the website tip page, the drip email, and the
  in-app tip view.
- **Deep link** — a link that opens a specific screen inside the app.

> The technical mechanism (where tip content is published, how each surface fetches it, the
> deep-link route table, and the native link configuration) lives in `design.md`, not here.
> This document stays in product language per the `workflow` steering rule.

## Requirements

### Bug 1 (+ consistency change): A Tip Renders the Same Content Everywhere

**User Story:** As a reader, I want a tip to show the same real content whether I see it on the
website, in an email, or in the app, so my experience is consistent and I'm never shown a
thinner or incomplete version depending on where I happen to be.

#### Acceptance Criteria

1.1 A tip's **content** — title, hero image (when set), full body, and call-to-action — SHALL be
rendered consistently on all three surfaces: the website tip page, the drip email, and the
in-app tip view.

1.2 THE drip email SHALL include the tip's **full body**, not only the short summary, so the
email matches the website tip page in substance.

1.3 THE in-app tip view SHALL include the tip's **call-to-action**, so a reader in the app can
take the same action the website and email offer.

1.4 Differences between surfaces SHALL be limited to the surrounding **context**, not the tip
content: the website wraps the tip in its header/footer; the email wraps it in a greeting and
signature; the in-app view shows it within the app. The title, hero, body, and CTA themselves
SHALL match.

1.5 A tip SHALL remain authored once as a single source of truth; the consistent rendering
SHALL be driven from that single source, not by re-authoring the content per surface.

1.6 WHERE a surface genuinely cannot present an element (for example, if a specific surface has
no sensible place for the hero image), that exception SHALL be deliberate and documented, not an
accidental omission. (The default is: show the same content.)

1.7 THE change SHALL preserve the existing email compliance and consent behavior (unsubscribe
header/footer, opt-in enforcement) and SHALL NOT alter who receives a tip.

1.8 WHEN the reader is already in the app and taps a tip's call-to-action, the app SHALL take
them to the right in-app destination **directly**, without depending on a web link that has to
"escape" an in-app browser back into the app. (See the constraint below — this is why the in-app
CTA must behave differently from the website/email CTA even though it points at the same
destination.)

#### Constraint: the in-app tip CTA must navigate natively, not via a web link

Today the app shows a tip by opening its **website article in an in-app browser**
(the system in-app browser / custom tab). A call-to-action on that web page is a link back into
the app. When the reader is **already inside the app**, a link that tries to re-enter the app
from the in-app browser is unreliable: the in-app browser typically does **not** hand the link
back to the app, so it falls through to the app's not-installed fallback web page — a dead end —
instead of opening the intended screen. (This is the same class of problem as Bug 3, but it
happens *from inside the app*.)

Therefore, for the **in-app** surface specifically:

1.9 THE in-app tip's call-to-action SHALL open the intended screen by **navigating within the
app directly** (the app already knows it is the app), NOT by opening the tip's web link and
hoping it routes back in.

1.10 Consequently, for the content and a working CTA to coexist in the app, the in-app tip view
SHALL present the tip's content **within the app** (so the CTA can be a native action), rather
than delegating the whole tip to a web page in an in-app browser where the CTA cannot reliably
act. The website and email surfaces are unaffected by this constraint — their CTAs are ordinary
links as today.

#### Follow-up criteria discovered in on-device testing (added after the first build)

1.11 THE in-app tip view SHALL NOT display raw markup from the tip's content. Tip content
includes embedded media markup authored for the website; the in-app view SHALL render readable
text and omit that markup rather than showing it as literal on-screen code. (On the first build,
tips showed raw angle-bracket markup as text.)

1.12 THE in-app tip's lead image SHALL be shown at a sensible, legible size — large enough to be
useful but capped so it does not fill the screen and push the tip text out of view. It SHALL NOT
be cropped awkwardly or shrunk to a tiny thumbnail. (On the first build the image was either
cropped to a fixed box or rendered very small.)

### Bug 2: The "Create your own tool" Deep Link Opens the Wrong Screen

**User Story:** As a reader who taps "Create your own tool," I want to land on the screen that
lets me build a custom tool, so the action matches what the tip told me to do.

#### Background

The "Build your own tool" tip's call-to-action is meant to open the app's **Create Tool**
builder (the flow for building a custom tool from scratch). Today, tapping it opens the **Add
Tool** library browser instead — a different screen, for adding existing library tools. The two
are easy to confuse by name but are different destinations, and the tip is specifically about
creating a tool, so it lands the reader in the wrong place.

#### Acceptance Criteria

2.1 WHEN a reader taps the "Create your own tool" call-to-action (from the email, the website, or
the in-app tip) THE app SHALL open the **Create Tool** builder screen, not the Add Tool library
browser.

2.2 THE existing "Add Tool" / library deep link SHALL continue to open the library browser as it
does today (this fix adds a correct Create-Tool destination; it does not change the library
link).

2.3 WHEN the app is not installed and the link is opened, the reader SHALL land on the existing
not-installed fallback experience with a message appropriate to creating a tool, consistent with
how other tip links behave when the app is absent.

2.4 THE fix SHALL work for the tip's link wherever it appears (email CTA, website CTA, and the
in-app CTA added in Bug 1), so all three send the reader to the Create Tool screen.

### Bug 3: An Archived Tool's Reminder Still Fires

**User Story:** As a user, when I archive a tool that had a reminder, I expect the reminder to
stop, so I'm not nudged to use a tool I've put away.

#### Background

When a user sets a reminder on a tool and then archives that tool, the reminder notification
should stop. This was reported and believed fixed in a past release, but it is **still
happening** — observed on a real iPhone running the current shipped app (1.0.5). So a prior fix
either did not fully take or does not cover the real case on-device. Because the symptom is a
device-level notification behavior, the cause is not obvious from reading the code, and a
speculative fix risks repeating the "thought it was fixed" cycle.

#### Acceptance Criteria

3B.1 WHEN a user archives a tool that has an active reminder THE reminder's scheduled
notifications SHALL stop firing; the user SHALL NOT receive further reminder notifications for
an archived tool.

3B.2 THE reminder definition SHALL be preserved (not deleted) so that restoring the tool can
re-arm the reminder, consistent with today's intended archive/restore behavior.

3B.3 WHEN an archived tool is restored THE reminder SHALL resume as before (this existing
behavior SHALL NOT regress).

3B.4 BEFORE a fix is proposed, the actual on-device cause SHALL be established by instrumenting
the archive→reminder path on a real device (confirming whether the stored notification
identifiers match what is actually scheduled, whether cancellation runs and succeeds, and
whether anything reschedules it) — rather than shipping another speculative fix. (Per the
debugging steering rule: get ground truth first.)

3B.5 THE fix SHALL be covered by a regression test at the layer the bug is actually in (not only
the layer that was already green), so this specific recurrence cannot silently return.

### Bug 4: An Unsubscribed Person Is Reported as "Waiting" in the Operator Summary

**User Story:** As the operator, I want the daily drip summary to correctly reflect people who
have unsubscribed, so I'm not told someone is "waiting" for a campaign when they have actually
opted out and will never receive it.

#### Background

The daily operator summary email classifies each considered subscriber as sent, failed,
waiting, or finished. A person who has **unsubscribed** from the drip is currently shown as
**waiting** — but they are not waiting for anything; they opted out and are not an eligible
audience at all. "Waiting" implies "will receive it once eligible," which is misleading for
someone who has left.

#### Acceptance Criteria

4.1 A subscriber who has unsubscribed (opted out of the relevant scope) SHALL NOT be reported as
"waiting" in the operator summary, because they are not awaiting any send.

4.2 THE summary's counts and per-subscriber classification SHALL treat an unsubscribed person as
not part of the eligible/awaiting audience — either excluded from the considered set or shown
under a clearly distinct label (for example, "unsubscribed"), not folded into "waiting".
(Which of exclude-vs-label is chosen is a design decision recorded in `design.md`, but the
outcome SHALL be that "waiting" means only genuinely-awaiting subscribers.)

4.3 THE change SHALL only affect how people are **classified/reported** in the summary; it SHALL
NOT change who actually receives email (consent enforcement already prevents sending to
unsubscribed people — this is a reporting-accuracy fix).

4.4 THE "waiting", "finished", and "sent" classifications for still-subscribed people SHALL
remain correct and unchanged.

### Success Verification (all bugs)

**User Story:** As the operator, I want to confirm these fixes before relying on them in 1.0.6.

#### Acceptance Criteria

V.1 FOR Bug 1: the same tip SHALL be shown on the website, in a sent email, and in the app, and
the title, hero, body, and CTA SHALL match across all three (only the surrounding context
differs).

V.2 FOR Bug 2: tapping "Create your own tool" SHALL open the Create Tool builder on a build that
has the fix; and the Add Tool library link SHALL still open the library.

V.3 THE deep-link behavior that depends on the installed native app SHALL be verified on a real
device/build (it cannot be fully proven by automated tests alone); the route-resolution layer
SHALL be covered by automated tests.

V.4 FOR Bug 3 (archived-tool reminder): on a real device, archiving a tool with a reminder SHALL
stop its notifications, and restoring SHALL resume them. Because this is a device-level
notification behavior, the fix SHALL be confirmed on-device (not claimed from unit tests alone),
with a regression test added at the layer the root cause is found.

V.5 FOR Bug 4 (unsubscribed → "waiting"): a summary generated over a set including an
unsubscribed person SHALL NOT classify that person as "waiting"; this SHALL be covered by an
automated test over a representative plan, and the summary-builder logic is unit-testable
(no device needed).

## Out of Scope

- **Website Universal Link not opening the installed app (the original "bug 3" from the report).**
  The web association files are already served and authorize the app's link paths; when the
  website CTA opens the install page instead of the app, the cause is device/native-side (link
  association caching, the app's associated-domains configuration, or how the link was opened)
  and must be **diagnosed on a real device first**, per the debugging steering rule. It is
  tracked separately and intentionally not bundled into this spec's fixes until there is a
  confirmed root cause from on-device instrumentation. (Not to be confused with this spec's
  **Bug 3 = archived-tool reminder**.)
- Authoring new tip content or changing any tip's wording (this is about rendering existing
  content consistently, not rewriting it).
- Changing the set of tips in the drip sequence or who receives them.
- Any change to channel attribution, analytics, or the dashboard.

## Notes

- **Per-bug task structure (for `tasks.md` later):** per the `workflow` steering rule for bugfix
  specs, each bug SHALL be implemented as a self-contained sequential cycle — an exploration
  test that reproduces the bug on unfixed code, a preservation test for the baseline, the fix,
  then a green checkpoint — completing one bug before starting the next.
- **Content-consistency root cause (for `design.md`):** the email and in-app surfaces read a
  shared published tips index that today omits the body; the website build reads the full
  authored body directly. The design must decide how the full body (and the CTA for the app)
  reaches all three surfaces from the single authored source — e.g. by including the body in the
  shared index, or another mechanism — without re-authoring per surface (Req 1.5).
- **In-app rendering is the big design decision (Req 1.8-1.10):** today the app opens each tip's
  **website article in an in-app browser** (`expo-web-browser` `openBrowserAsync` in
  `TipsFeedScreen`), and the app "never renders tip bodies." A CTA inside that in-app browser is
  a web link that cannot reliably route back into the app (iOS `SFSafariViewController` / Android
  Custom Tabs do not hand a Universal/App Link back to the presenting app — it hits the
  not-installed fallback instead). So "add a CTA to the in-app tip" is NOT a small change: for
  the CTA to work, the app must render the tip **natively** (title, hero, body, and a native CTA
  button that calls the app's own navigation to the Create Tool / target screen) rather than
  delegating to the web page. The design must choose how the app renders the body natively
  (it needs the body in the shared index per the point above, plus a markdown renderer or
  equivalent), and wire the CTA to in-app navigation keyed off the tip's CTA route — not off
  opening the URL. The website and email CTAs stay ordinary links.
- **Deep-link root cause (for `design.md`):** there is currently no "Create Tool" deep-link
  route; only an "Add Tool" → library route exists (`add-tool` → `LibraryBrowser` in
  `src/navigation/linking.ts`), and the tip's CTA (`content/tips/add-your-own-tool.md`) points
  at `.../app/add-tool`. The design must add a Create-Tool route to the app's deep-link table,
  point the tip's CTA at it (e.g. `.../app/create-tool`), and add the matching not-installed
  fallback message in `website/app-fallback.html`. Route parsing is unit-testable; the on-device
  open is the honest caveat (V.3).
- **Bug 3 (archived-tool reminder) — investigate before fixing (for `design.md`):** the code
  *appears* correct — `cardService.archive()` calls `reminderService.disableForCard(cardId)`,
  which cancels each stored notification id and marks the reminder inactive. Two suspicious
  seams to instrument on-device BEFORE proposing a fix (3B.4): (a) `archive()` wraps the
  `disableForCard` call in a `try/catch` that **silently swallows any error** ("best-effort"),
  so a cancellation failure would be invisible; (b) the stored `notification_id` (a JSON array)
  may not match the identifiers actually scheduled with the OS, so `cancelScheduled` could be
  cancelling nothing — and launch reconciliation / iOS repeating-notification behavior could
  re-register or retain it. Also rule out a stale 1.0.5 build vs. current code. Add a `__DEV__`
  log at the archive→disable→cancel points, confirm on the real device which seam fails, THEN
  fix that seam and add a regression test there (3B.5). Do not ship a third speculative fix.
- **Bug 4 (unsubscribed → "waiting") — root cause (for `design.md`):** in `messaging-worker`,
  `resolveNextStep` (`drip.ts`) returns `{ kind: 'waiting' }` when the earliest unreceived step
  exists but the subscriber "isn't eligible yet (gap/**scope**)" — so an unsubscribed person
  (scope flag off) collapses into `waiting`. The production run (`runDripPass` in `index.ts`)
  builds the plan and the summary counts from these kinds. The design must distinguish
  "unsubscribed / not in the audience" from "waiting" — either filter unsubscribed people out of
  the considered set before classification, or add an explicit status — so the summary
  (`dripSummary.ts`) never labels an opted-out person as waiting. This is pure-logic and
  unit-testable (no device); add a `dripSummary`/`drip` test with an unsubscribed entry (V.5).
- **Verification honesty (per workflow steering):** the deep-link and email-delivery paths that
  depend on a native build or a real send can only be fully confirmed on-device / in a real run;
  automated tests cover the route-resolution and content-assembly layers. Say which is which.
- **Related history:** the original tip schema (`messaging-content-batch-1`) intended the email
  to carry "summary and/or body"; `messaging-content-rendering` put the full body on the website
  page; the shared content index (consumed by the drip and the app) was built summary-only. This
  spec realigns all three to the single-source principle above.
