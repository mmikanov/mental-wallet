# Requirements Document — 1.0.6 Bug Fixes

## Introduction

This spec collects bug fixes targeted for the 1.0.6 release. They center on **tip content
consistency** across the three places a tip appears (website, email, and in the app) and on a
**deep link** that opens the wrong screen. The guiding principle for the content work, stated by
the product owner:

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

### Requirement 3: Success Verification

**User Story:** As the operator, I want to confirm these fixes before relying on them in 1.0.6.

#### Acceptance Criteria

3.1 FOR Bug 1: the same tip SHALL be shown on the website, in a sent email, and in the app, and
the title, hero, body, and CTA SHALL match across all three (only the surrounding context
differs).

3.2 FOR Bug 2: tapping "Create your own tool" SHALL open the Create Tool builder on a build that
has the fix; and the Add Tool library link SHALL still open the library.

3.3 THE deep-link behavior that depends on the installed native app SHALL be verified on a real
device/build (it cannot be fully proven by automated tests alone); the route-resolution layer
SHALL be covered by automated tests.

## Out of Scope

- **Bug 3 (Universal Link not opening the installed app from the website).** The web
  association files are already served and authorize the app's link paths; when the website CTA
  opens the install page instead of the app, the cause is device/native-side (link association
  caching, the app's associated-domains configuration, or how the link was opened) and must be
  **diagnosed on a real device first**, per the debugging steering rule. It is tracked
  separately and intentionally not bundled into this spec's fixes until there is a confirmed
  root cause from on-device instrumentation.
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
  route; only an "Add Tool" → library route exists, and the tip's CTA points at it. The design
  must add a Create-Tool route to the app's deep-link table, point the tip's CTA at it, and add
  the matching not-installed fallback message. Route parsing is unit-testable; the on-device
  open is the honest caveat (Req 3.3).
- **Verification honesty (per workflow steering):** the deep-link and email-delivery paths that
  depend on a native build or a real send can only be fully confirmed on-device / in a real run;
  automated tests cover the route-resolution and content-assembly layers. Say which is which.
- **Related history:** the original tip schema (`messaging-content-batch-1`) intended the email
  to carry "summary and/or body"; `messaging-content-rendering` put the full body on the website
  page; the shared content index (consumed by the drip and the app) was built summary-only. This
  spec realigns all three to the single-source principle above.
