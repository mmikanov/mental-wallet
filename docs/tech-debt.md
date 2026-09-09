# Tech Debt & Future Improvements

A running list of known refactors and improvements that are safe to defer. These are not
bugs — the app works — but addressing them reduces future maintenance risk. Add new items
at the top of the relevant section with a short rationale and the files involved.

---

## Onboarding state reset should use a shared default (avoid per-field drift)

**Type:** Refactor / maintainability
**Priority:** Low
**Discovered:** During post-1.0.3 fixes (Bug 4b — the new `collapsedStackHintSeen` flag was
not reset by the developer "Reset Onboarding" action because the reset hardcoded each field).

**Problem:** The developer reset handlers in `src/screens/SettingsScreen.tsx`
(`handleResetOnboarding` and `handleResetEntireApp`) reset the Zustand onboarding store by
listing every field explicitly in `useOnboardingStore.setState({ ... })`. `src/stores/onboardingStore.ts`
also defines a `DEFAULT_STATE` object separately. Whenever a new onboarding flag is added to
the store, it must be manually added in **three** places (the store's `DEFAULT_STATE`, and
both reset handlers). Forgetting the reset handlers means the flag persists in memory after a
reset — exactly the bug that surfaced with `collapsedStackHintSeen`.

**Proposed fix:** Export a single canonical default from the store (e.g. `DEFAULT_STATE` plus
its derived fields, or a `resetOnboardingState()` action on the store) and have both
`SettingsScreen` handlers call that instead of re-listing fields inline. New flags then only
need to be added in one place.

**Files:**
- `src/stores/onboardingStore.ts` (export a default/reset)
- `src/screens/SettingsScreen.tsx` (`handleResetOnboarding`, `handleResetEntireApp`)

**Risk if deferred:** Low but recurring — each new onboarding flag risks the same
reset-doesn't-clear-it bug until the reset paths are consolidated.

---

## Duplicated tip-frontmatter parser + web-only-block strip across send scripts

**Type:** Refactor / DRY
**Priority:** Low
**Discovered:** During tip media work (adding email GIF + stripping the website-only
`<figure class="tip-anim">` from email bodies).

**Problem:** `messaging-worker/scripts/send-tip.ts` and `messaging-worker/scripts/run-campaign.ts`
each carry their own copy of the tip frontmatter parser (`parseTipFile`) and now also their
own copy of `stripWebOnlyBlocks()`. A third, slightly different parser exists in
`website/build-content.js`. Any change to the tip schema or to what counts as "web-only"
markup must be made in multiple places, which is error-prone.

**Proposed fix:** Extract a single shared tip-parsing/normalization helper (frontmatter parse
+ `stripWebOnlyBlocks`) used by both messaging scripts (and ideally aligned with the website
build's parser). Keep the "strip web-only blocks before email" rule in exactly one place.

**Files:**
- `messaging-worker/scripts/send-tip.ts`
- `messaging-worker/scripts/run-campaign.ts`
- `website/build-content.js` (parser alignment, optional)

**Risk if deferred:** Low but recurring — schema/markup changes can silently diverge between
the single-send and campaign paths (e.g. a new web-only block type stripped in one but not the
other).

---

## Email body renders as plain text (no inline media/formatting)

**Type:** Feature / limitation (spec'd)
**Priority:** Medium (when inline email media is wanted)
**Discovered:** Wiring the welcome tip — the website shows an inline animation, but the email
can only show media via the top `heroImage` GIF; inline HTML in the body is escaped to text,
so we strip it for email.

**Status:** Requirements written — see `.kiro/specs/email-inline-media/requirements.md`.

**Summary:** `messaging-worker/src/index.ts` renders the tip body with `escapeHtml` (plain
text) and hardcodes `heroImage` at the top. The interim `stripWebOnlyBlocks()` keeps email
bodies clean, but authors can't place media mid-email. The spec covers rendering the body as
sanitized HTML so a single authored tip can position media anywhere in both web and email.

---

## Email links should match the sending domain (deliverability polish)

**Type:** Improvement / email deliverability
**Priority:** Low
**Discovered:** First real tip email batch — Resend's "Insights" flagged: "Ensure link URLs
match sending domain. Mismatched URLs can trigger spam filters." The flagged link was the
App Store URL (`https://apps.apple.com/app/mental-health-wallet/id6800036822`).

**Assessment:** Low risk as-is. The mismatched link is the Apple App Store — a highly
trusted domain — and it's the obvious CTA for an app's email, so it's unlikely to hurt
placement. Sending domain (`productsforgood.co`) auth (SPF/DKIM/DMARC), list quality, and
complaint rate matter far more. We chose to ship the batch without changing this.

**Proposed improvement (when convenient):** Route email store links through our own domain so
the link domain matches the sender. The website tip articles already do this — the article
CTA uses `/#hero` + `app-cta.js` to redirect to the right store per platform. The email CTA
and any in-body store links, however, use the raw `apps.apple.com` / Play Store URLs. Point
the email CTA at a `https://mentalhealthwallet.productsforgood.co/…` download/redirect URL
(reusing the same per-platform redirect logic) so all links share the sending domain. This
removes the Resend warning and is marginally better for deliverability.

**Files:**
- `messaging-worker/src/index.ts` (tip email CTA + any store links)
- `content/tips/*.md` (tip `cta.url` values point directly at stores today)
- `website/app-cta.js` (existing per-platform redirect logic to reuse)

**Risk if deferred:** Low — a cosmetic Resend warning; no known deliverability problem for a
trusted store link.
