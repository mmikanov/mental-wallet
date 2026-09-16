# Design Document

## Overview

Four independent, user-reported defects fixed after the 1.0.3 release. Each is small and
self-contained; this document gives the concrete technical approach, the files touched, and
the verification strategy for each, so the work can be implemented and shipped one bug at a
time.

The bugs and their root causes (established from the code):

| Bug | Root cause | Fix surface |
| --- | --- | --- |
| 1. RTL layout mirrors on Android | No `I18nManager` lock; `AndroidManifest.xml` has `android:supportsRtl="true"`. RN mirrors all physical `left/right` styles under an RTL locale. | `App.tsx` (JS lock), `AndroidManifest.xml` (native lock), `textAlign="auto"` on user free-text inputs. |
| 2. Android "Open app" opens Apple store | The rendered button (`LinkButtonControl`) opens a hardcoded `apps.apple.com` `fallbackUrl` with no platform branch. The correct `playStoreId` exists in card data but is unused. | `LinkButtonControl` + a small platform-aware store resolver; `externalAppCards.ts` data. |
| 3a. KPI single-select unclear | Only a small subheading conveys "choose one". | `KpiSelectionScreen.tsx` copy + a11y hint. |
| 3c. Keyboard hides custom KPI input on "Other" | Screen uses a plain `ScrollView` with no keyboard avoidance; the "Other" input sits below all options and the keyboard covers it. | `KpiSelectionScreen.tsx` — wrap in `KeyboardAvoidingView` + scroll input into view. |
| 3b. Missing Back on Privacy Notice | Screen has no Back control; other steps do. | `PrivacyNoticeScreen.tsx`. |
| 4a. Collapsed stack hard to see on Android | `focusedCardArea` is `flex:1`; collapsed stack is intrinsically ~52px. No platform branch. | `CollapsedStack.tsx` sizing (Android). |
| 4b. Users don't know where cards went | No hint exists. | New one-time Android hint reusing `TooltipOverlay` + a persisted flag in `onboardingStore`. |

Guiding principles: minimal, targeted changes; reuse existing patterns (the coachmark
overlay, the onboarding persistence, the existing platform-aware `deepLinkService`); no new
dependencies; preserve current iOS behavior.

---

## Bug 1: Force LTR layout (Requirements 1)

### Root cause
React Native honors the device locale's direction via `I18nManager`. On a Hebrew/Arabic
device, `I18nManager.isRTL` is `true`, so the layout engine mirrors every physical style
(`flexDirection: 'row'`, `left/right`, `marginLeft/Right`, default `textAlign`). The app has
no `I18nManager` configuration and `AndroidManifest.xml` declares
`android:supportsRtl="true"`, so the OS opts the app into mirroring. The screenshots confirm
pure direction-mirroring (kebab and drag handle on the wrong side, right-aligned bullets,
"blank" clipped off a flipped row) — there are no non-directional layout bugs to chase.

### Approach
Two layers, both needed for a reliable lock in the bare workflow:

1. **JS runtime lock (`App.tsx`, at module load).** Add, immediately after imports and
   before the component definition, so it runs as early as possible:
   ```ts
   import { I18nManager } from 'react-native';

   // The UI is English-only — lock layout to LTR so RTL device locales
   // (e.g. Hebrew) don't mirror the interface.
   try {
     if (I18nManager.allowRTL) I18nManager.allowRTL(false);
     if (I18nManager.isRTL && I18nManager.forceRTL) I18nManager.forceRTL(false);
   } catch {
     // I18nManager unavailable — safe to ignore.
   }
   ```
   `allowRTL(false)` prevents RTL from being enabled on fresh installs; the guarded
   `forceRTL(false)` flips an already-RTL install back. (A `forceRTL` change only fully
   applies after a reload, but with `allowRTL(false)` present at first launch on a fresh
   install `isRTL` is already false — the native lock below removes the edge case entirely.)

2. **Native Android lock (`android/app/src/main/AndroidManifest.xml`).** Change the
   `<application>` attribute `android:supportsRtl="true"` → `android:supportsRtl="false"`.
   This stops the OS from mirroring at the native level, guaranteeing the lock without
   depending on a JS reload. This is a committed-native-folder edit (bare workflow); it does
   not touch app version numbers.

### Text input remains fully multilingual (Req 1.6, 1.7)
Locking direction does **not** restrict input. All `TextInput`s still accept and store
Hebrew/Arabic/any Unicode; bidi rendering *within* a line is a text-shaping concern
independent of `I18nManager`. To give user-authored content natural alignment without
affecting the English chrome, add `textAlign="auto"` (RN maps this to content-based
alignment) to the free-text inputs that hold user content:

- `KpiSelectionScreen.tsx` — the custom "Other" `TextInput`.
- The text-input control renderer (`TextInputControl` / equivalent used by tools).
- Card Creator fields: tool title, description, and control-label inputs (Step 1 Shell /
  Step 2 Controls).

Fixed UI labels (headings, buttons, badges) are left as-is; they should stay LTR.

`textAlign="auto"` is applied per-field (not globally) so it cannot alter the app's overall
LTR layout. Where a field already sets an explicit `textAlign`, `auto` replaces only that
input's value.

### Files
- `App.tsx` — add the `I18nManager` block.
- `android/app/src/main/AndroidManifest.xml` — `supportsRtl` false.
- `src/screens/onboarding/KpiSelectionScreen.tsx`, the text-input control component, and the
  Card Creator shell/controls inputs — add `textAlign="auto"`.

### Verification
- Set an Android emulator/device to Hebrew, launch, and confirm the Welcome screen bullets
  are left-aligned with bullets on the left, "All questions can be left blank" is not
  clipped, the kebab is on the left and title on the right as designed, and a focused card
  matches the LTR screenshots. Re-check against the two provided screenshots as the baseline.
- Confirm typing Hebrew into the custom KPI field and a new tool's title stores and re-opens
  correctly, and that the Hebrew text aligns to the right within its own field while the rest
  of the screen stays LTR.

---

## Bug 2: Android "Open app" uses the correct store (Requirements 2)

### Root cause
The button users tap is `LinkButtonControl` (`src/components/controls/LinkButtonControl.tsx`),
rendered via `ControlRenderer` → `ExpandedContent`. Its `handlePress` tries
`config.targetUrl` (e.g. `wysa://open`), then `config.fallbackUrl`, which for external-app
cards is a hardcoded `https://apps.apple.com/...` URL. `tryOpenUrl` just calls
`Linking.openURL` with no `Platform.OS` awareness. So on Android without the app installed,
the fallback opens the Apple App Store.

A correct, platform-aware implementation already exists in
`src/services/deepLinkService.ts` (`getStoreUrl` returns Play Store on Android, App Store on
iOS; `launchExternalApp` runs the full chain), but it is **not wired to the button** —
`ExpandedContent` only uses `externalApp` for analytics and affiliate disclosure.

### Design decision: fix at the store-URL layer, keep the generic control generic
`LinkButtonControl` is a **generic** control used by user-created tools too, not only
external-app cards, and it only receives `config.targetUrl` / `config.fallbackUrl` (no
`externalApp` block). We must not break the generic link button. Two viable options:

- **Option A (chosen): make the store fallback platform-aware inside the link-button path.**
  Add a tiny helper that, given a URL, detects an Apple App Store URL and rewrites it to the
  platform-correct store when an Android package is known. Since the control doesn't have
  `playStoreId`, we source the Play Store id from the card's `externalApp` data at the point
  where the control is configured/rendered for external-app cards, and pass a
  platform-resolved `fallbackUrl` into the control. Concretely: when `ExpandedContent`
  renders an external-app card, compute the platform-appropriate store URL from
  `curatedCard.externalApp` (reusing `deepLinkService.getStoreUrl`) and inject it as the
  effective fallback for that card's link button. User-created link buttons (no
  `externalApp`) are untouched and keep their literal `fallbackUrl`.

- **Option B (rejected): reroute the whole tap through `launchExternalApp`.** Cleaner in
  isolation but duplicates the control's existing deep-link/analytics/`onChange('opened')`
  behavior and risks regressions in the generic control. Rejected to keep the change small
  and low-risk for a post-launch patch.

**Data cleanup (supporting):** update `externalAppCards.ts` so external-app cards no longer
rely on an Apple-only URL as the *store* fallback. The per-platform ids
(`appStoreId`/`playStoreId`) already exist in each `externalApp` block; the fix derives the
store URL from those at runtime. For cards whose `link_button` `targetUrl` itself is an
`apps.apple.com` link (e.g. Mindfulness.com, Insight Timer noted in the data), keep behavior
correct on Android by ensuring the platform resolver applies to those too, or point their
`targetUrl` at the cross-platform web/deep-link and let the store step handle the platform
split.

### Platform-store resolution (reused)
```ts
// deepLinkService.getStoreUrl(config) — already exists:
// iOS  → https://apps.apple.com/app/id{appStoreId}
// Android → https://play.google.com/store/apps/details?id={playStoreId}
// null when the platform's id is missing → caller falls back to web/affiliate URL.
```
The fallback chain for external-app cards becomes: deep link → platform store (from
`getStoreUrl`) → affiliate URL (if any) → web URL. This preserves affiliate priority (Req
2.6) and the graceful web fallback when a store id is missing (Req 2.5).

### Analytics & affiliate (unchanged)
- The `external_resource_opened` event in `LinkButtonControl` and the
  `logExternalAppLaunched` call in `ExpandedContent` both continue to fire (Req 2.7).
- Affiliate disclosure logic in `FocusedCardView`/`ExpandedContent`/`CardPreviewSheet` is
  untouched (Req 2.6).

### Files
- `src/components/wallet/ExpandedContent.tsx` — compute platform store URL from
  `curatedCard.externalApp` and provide it as the external-app card's effective link-button
  fallback.
- `src/components/controls/LinkButtonControl.tsx` — accept/prefer the platform-resolved
  fallback for external-app cards (without changing behavior for generic link buttons).
- `src/services/deepLinkService.ts` — reuse `getStoreUrl` (no change, or export if needed).
- `src/data/externalAppCards.ts` — ensure store fallbacks are not hardcoded Apple-only;
  verify every card has a correct `playStoreId`.

### Verification
- On an Android device/emulator without Wysa installed, tap "Open Wysa" and confirm it opens
  the Google Play listing for `bot.touchkin`, not the Apple App Store.
- On iOS without Wysa, confirm it still opens the Apple App Store (`id1166585565`).
- With the app installed, confirm the deep link still opens the app directly on both
  platforms.
- Confirm a user-created tool with a generic link button still opens its literal target/
  fallback URLs unchanged.
- Confirm the `external_resource_opened` analytics event still fires.

---

## Bug 3a: Clarify KPI single-select (Requirements 3)

### Root cause
`KpiSelectionScreen` is single-select (single `selectedIndex`; tapping a predefined option
immediately persists and advances). The only hint is the small gray subheading "Choose one
focus for your daily check-in", which is easy to miss — the reported confusion.

### Approach
Copy + accessibility, no behavior change:
- Strengthen the instruction so single-select is unmistakable and prominent (e.g. "Pick
  one" styled clearly near the options, keeping the friendly existing subheading context).
  Exact wording finalized in implementation; intent per Req 3.1.
- Add an accessibility hint on the options conveying single selection (Req 3.2), e.g. an
  `accessibilityHint` such as "Selects one focus" on each option, complementing the existing
  `accessibilityState.selected`.
- Do not change `KPI_OPTIONS`, the "I'll decide later" default, or downstream storage/use
  (Req 3.4). "Other" still reveals the custom text input (Req 3.3).

### Files
- `src/screens/onboarding/KpiSelectionScreen.tsx` — instruction copy + `accessibilityHint`.

### Verification
- Manually read the KPI step: the single-select instruction is prominent.
- VoiceOver/TalkBack announces the single-select hint on options.
- Selecting a predefined option still advances immediately; "Other" still shows the input;
  "I'll decide later" still seeds the default.

---

## Bug 3c: Keyboard hides the custom KPI input on "Other" (Requirements 7)

### Root cause
`KpiSelectionScreen` renders its content in a plain `ScrollView` with no keyboard handling.
The "Other" custom `TextInput` (and its Continue button) sit below all seven options, so when
the keyboard opens it covers them — the reported bug.

### Approach
Layout/keyboard only, no behavior change:
- Wrap the ScrollView in a `KeyboardAvoidingView` (`behavior="padding"` on iOS, `"height"` on
  Android), reusing the same pattern as `Step2Controls.tsx` / `FocusedCardView.tsx` (Req 7.2).
- Add a `ScrollView` ref and call `scrollToEnd({ animated: true })` when "Other" is selected
  (alongside focusing the input) and on the input's `onFocus`, so the input + Continue button
  scroll above the keyboard whether reached by tapping "Other" or the field directly
  (Req 7.1, 7.3).
- Do not change `KPI_OPTIONS`, single-select, the "I'll decide later" default, validation, or
  downstream storage/use (Req 7.4).

### Files
- `src/screens/onboarding/KpiSelectionScreen.tsx` — `KeyboardAvoidingView` wrap + ScrollView
  ref + `scrollToEnd` on select/focus.

### Verification
- Simulator with software keyboard on (hardware keyboard disconnected): tap "Other" → the
  input and Continue button stay visible above the keyboard while typing; also works when
  tapping the field directly. iOS and Android. (Confirmed working by operator.)
- Typecheck clean for the file.

---

## Bug 3b: Add Back to Privacy Notice (Requirements 4)

### Root cause
Onboarding steps hand-roll their own Back control (headers hidden). Intent Selection, KPI
Selection, and Privacy Explanation each render a top-left "← Back". **Privacy Notice** does
not, so a user cannot return to Welcome from it (and Android has no gesture fallback).

### Approach
Add the same Back affordance to `PrivacyNoticeScreen`, mirroring the existing pattern:
a top-left `Pressable`/`TouchableOpacity` "← Back", min 44×44 touch target,
`accessibilityRole="button"`, calling `navigation.goBack()` (Req 4.1, 4.2). Reuse the
`backButton`/`backButtonText` style shape used by `IntentSelectionScreen`
(`#4A90D9`, weight 500).

**Resumed-route safety (Req 4.4):** the onboarding navigator can resume directly onto
`PrivacyNotice` (via `getInitialRoute`) with no previous screen. To avoid a broken-looking
no-op Back, guard the control with `navigation.canGoBack()` — render Back only when
`canGoBack()` is true (or make the handler a safe no-op). Welcome remains without Back (Req
4.3).

### Files
- `src/screens/onboarding/PrivacyNoticeScreen.tsx` — add guarded Back control + styles.

### Verification
- From Welcome → Continue → Privacy Notice, tap Back and confirm return to Welcome.
- Simulate resume directly onto Privacy Notice (no prior screen) and confirm Back is hidden/
  safe, not a broken button.
- Confirm forward flow, seeding, and completion are unchanged.

---

## Bug 4a: Taller collapsed stack on Android (Requirements 5)

### Root cause
In the focused layout (`WalletScreen`), `focusedCardArea` is `flex:1` and the
`CollapsedStack` is intrinsically sized (`TOP_CARD_HEIGHT = 52` + `EDGE_HEIGHT = 6` per extra
card), so it reads as a thin strip at the very bottom. No `Platform.OS` branch exists in
these dimensions today.

### Approach
Increase the collapsed stack's visual prominence on **Android** via platform-branched
sizing in `CollapsedStack.tsx`:
- Raise `TOP_CARD_HEIGHT` (the partially-visible top card) on Android so more of the top
  card shows (e.g. ~52 → a taller value, tuned to look right without crowding).
- Optionally raise `EDGE_HEIGHT` slightly on Android so multiple cards read as a deck.
- Optionally set a `minHeight` on `collapsedStackArea` in `WalletScreen` so the stack
  reserves more space against the `flex:1` focused card.

Use `Platform.OS === 'android'` (or `Platform.select`) for the branch; iOS keeps current
values (Req 5.2). Keep the whole stack a single tappable `TouchableOpacity` with its
existing accessibility label conveying the number of other cards (Req 5.3). Tune values so
the focused card's primary content/actions are not crowded on common Android sizes (Req
5.4).

### Files
- `src/components/wallet/CollapsedStack.tsx` — platform-branched `TOP_CARD_HEIGHT` /
  `EDGE_HEIGHT`.
- `src/screens/WalletScreen.tsx` — optional `collapsedStackArea` `minHeight` (Android).

### Verification
- On Android with a focused card and several others, confirm the collapsed stack is clearly
  taller/more noticeable and still tappable to return.
- On iOS, confirm no visual regression (unchanged).
- Confirm the focused card content/actions aren't crowded on a small Android device.

---

## Bug 4b: First-time hint pointing at the collapsed cards (Requirements 6)

### Root cause
There is no hint telling users where the other cards go when one is focused. Android users
in particular miss the collapsed strip.

### Approach
Reuse the existing coachmark stack and persistence, gated to Android and shown once.

1. **Persisted "seen" flag (`onboardingStore.ts`).** Add `collapsedStackHintSeen: boolean`
   to `OnboardingState`, `PersistedState`, and `DEFAULT_STATE`; include it in
   `getPersistedFields`; read with `?? false` in `loadState` (backward-compatible with
   existing rows); add a `markCollapsedStackHintSeen()` action that mirrors `dismissBanner()`
   (optimistic `set` then `await persistState`). This persists in the SQLite `settings` JSON
   blob and survives restarts (Req 6.2).

2. **Trigger (`WalletScreen`).** When a card becomes focused (`focusedCardId` transitions
   `null → value`) AND `otherCards.length > 0` AND `Platform.OS === 'android'` AND
   `!collapsedStackHintSeen` AND the onboarding micro-tutorial is not active
   (`!tutorial.isActive`, and ideally `tutorialComplete`), show the hint. This reuses the
   existing `prevFocusedRef` transition tracking already in the screen.

3. **Target measurement.** Measure the collapsed stack area to get the `targetLayout` rect,
   reusing the existing `onLayout` + `measure(...)` relative-to-`containerRef` pattern used
   for `frontmostCardLayout`. Add a ref/`onLayout` on the `collapsedStackArea` view.

4. **Render (`TooltipOverlay`).** Reuse `TooltipOverlay` with `position="above"` (the stack
   is at the bottom, so the bubble points down to it from above), hint text like "Your other
   cards are here — tap to see them all", and `onTargetPress`/`onSkip` both calling
   `markCollapsedStackHintSeen()` and hiding the hint (Req 6.3, 6.4).

5. **No collision with the micro-tutorial (Req 6.5).** The initial micro-tutorial targets the
   stacked deck before any card is focused; this hint targets the collapsed stack after a
   focus. Gating on `!tutorial.isActive` (and preferring `tutorialComplete`) ensures they
   don't co-fire. Only one `TooltipOverlay` shows at a time; since the tutorial's targets are
   `frontmost_card`/`action_button`, drive this hint via separate state so their
   `targetLayout`/`visible` don't conflict (either a second `TooltipOverlay` instance for the
   hint, or a small local state machine — implementation detail).

6. **Android only (Req 6.6).** iOS never shows it (users know the Apple Wallet metaphor).

### Files
- `src/stores/onboardingStore.ts` — new persisted `collapsedStackHintSeen` flag + action.
- `src/screens/WalletScreen.tsx` — trigger, measurement of the collapsed-stack target, and a
  `TooltipOverlay` for the hint (Android-gated).
- (Reuse) `src/components/onboarding/TooltipOverlay.tsx` — no change expected.

### Verification
- Fresh Android install: focus a card with others present → the hint appears pointing at the
  collapsed stack; dismiss it; focus again → it does not reappear; restart the app → still
  does not reappear (persisted).
- Confirm it does not appear during the initial onboarding micro-tutorial.
- iOS: confirm the hint never appears.
- Confirm the hint is dismissible and doesn't block interaction.

---

## Cross-cutting concerns

### No new dependencies
All fixes use existing APIs (`I18nManager`, `Platform`, `Linking`, `deepLinkService`,
`TooltipOverlay`, `onboardingStore`). No packages added.

### Testing strategy
Per the bugfix workflow, each bug is implemented as its own sequential cycle
(exploration test that fails on unfixed code → preservation test for baseline behavior →
fix → re-verify). Unit-testable seams:
- Bug 2: a pure store-URL resolver (platform → correct store URL; missing id → null/web
  fallback) is unit-testable with mocked `Platform.OS`; the affiliate-priority ordering can
  be asserted.
- Bug 4b: `onboardingStore` flag persistence/rehydration (set → persist → load) is
  unit-testable like existing store tests; the "seen once" gating logic can be asserted.
- Bug 1 (RTL), 3a (copy/a11y), 3b (Back button), 4a (platform sizing) are primarily
  visual/behavioral and verified manually per the per-bug verification sections; where a
  component seam is cheap to assert (e.g. Back control hidden when `!canGoBack()`), add a
  focused RTL/component test.

Jest via `jest-expo`; `Platform.OS` and `I18nManager` are mockable. Type-check with
`npm run typecheck` and lint with `npm run lint` after each bug.

### Release / versioning
These changes require an app release (native `AndroidManifest.xml` edit + JS). Follow the
release checklist (marketing version bump across the four synced locations, release notes)
when building — that is a release-time step, not part of these code fixes.

### Risk & sequencing
Bugs are ordered low-risk → higher-touch for implementation: RTL lock (1) and Back button
(3b) are smallest; KPI copy (3a) trivial; store link (2) is contained but touches shared
control wiring; collapsed stack (4a) is visual tuning; the first-time hint (4b) is the most
involved (state + persistence + measurement). Each is shippable independently.
