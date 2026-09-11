# Implementation Plan

Post-1.0.3 user-reported bug fixes. Structured **per-bug sequentially** — each bug is a
self-contained cycle (reproduce/verify it exists → fix → verify fixed → checkpoint) that is
completed fully before starting the next. Bugs are independent and each is shippable on its
own.

Testing note: these fixes are largely visual/native/behavioral. Automated tests are added
only where there's a cheap, meaningful unit seam (noted inline). Manual on-device
verification is the primary gate, using the two running simulators/emulators and the repro
steps in `docs/rtl-testing.md` (RTL) and the per-bug notes below.

---

## Bug 1 — Force LTR layout so RTL devices render correctly (Req 1)

- [x] 1.1 Reproduce the bug on-device (baseline)
  - Set Android emulator to Hebrew (`he-IL`) via per-app locale; confirm the wallet mirrors
    (kebab/title swapped, right-aligned bullets, clipped text, FAB bottom-left).
  - Confirm iOS also mirrors under a Hebrew locale / forced text direction.
  - Captured before-state screenshots as the verification baseline.
  - _Req: 1.1, 1.4_

- [x] 1.2 Add the JS `I18nManager` LTR lock at app startup
  - In `App.tsx`, at module load (before render): `allowRTL(false)` and guarded
    `forceRTL(false)` when `isRTL`, wrapped in try/catch. Cross-platform (covers iOS).
  - _Req: 1.1, 1.2_

- [x] 1.3 Add the Android native LTR lock
  - `android/app/src/main/AndroidManifest.xml`: `android:supportsRtl="true"` → `"false"`.
  - _Req: 1.3_

- [x] 1.4 Keep text input multilingual + content-aligned
  - Add `textAlign: 'auto'` to user-authored free-text inputs: KPI custom "Other" input
    (`KpiSelectionScreen`), `TextInputControl`, `TextAreaControl`, and Card Creator
    title/description (`Step1Shell`, via a `contentAligned` style — NOT the icon-URL/hex
    fields, which stay LTR).
  - _Req: 1.5, 1.6, 1.7_

- [x] 1.5 Verify the fix on-device (both platforms) + checkpoint
  - Rebuilt Android (`npm run android`) so the native manifest change applies; with `he-IL`
    still set, confirmed the wallet renders correct LTR.
  - Confirmed iOS renders LTR under a real Hebrew system locale (status bar flips → env is
    RTL; app stays LTR).
  - Typecheck clean for edited files. Reverted both environments to English.
  - Wrote `docs/rtl-testing.md` (repro/verify/revert commands for future use).
  - _Req: 1.1, 1.2, 1.3, 1.4_

---

## Bug 2 — Android "Open app" uses the correct platform store (Req 2)

- [x] 2.1 Reproduce the bug on-device (baseline)
  - Confirmed the buggy path: external-app `link_button` `fallbackUrl` is a hardcoded
    `apps.apple.com` URL opened with no `Platform.OS` branch, so Android would open the Apple
    App Store. Expected Android target is Play Store `bot.touchkin`.
  - _Req: 2.1_

- [x] 2.2 Add a platform-aware store-fallback unit seam + test (exploration)
  - Exported `deepLinkService.getStoreUrl`; added `resolveStoreFallbackUrl` (store → affiliate
    → web). Added `src/services/__tests__/deepLinkService.storeUrl.test.ts` (7 tests, passing):
    iOS → `apps.apple.com/app/id{appStoreId}`, Android → `play.google.com/...?id={playStoreId}`,
    null when the platform id is missing, and the fallback priority.
  - _Req: 2.3, 2.5_

- [x] 2.3 Route external-app card store fallback through platform logic
  - `ExpandedContent` computes `externalApp` for app-origin cards and passes it via
    `ControlRenderer` → `LinkButtonControl`, which uses `resolveStoreFallbackUrl(externalApp)`
    for its fallback. Generic user-created link buttons (no `externalApp`) keep their literal
    `fallbackUrl` unchanged. Also wired through `LibraryToolPreview` (session try surface).
    Affiliate priority + web fallback preserved.
  - _Req: 2.1, 2.2, 2.4, 2.5, 2.6_

- [x] 2.4 Verify data + analytics
  - Confirmed all 7 external-app cards in `externalAppCards.ts` have a `playStoreId`. The
    `external_resource_opened` event still fires (logic unchanged; now logs the resolved URL).
  - _Req: 2.3, 2.7_

- [x] 2.5 Verify on-device (both platforms) + checkpoint
  - Unit test passes; typecheck clean for edited files; Android app rebuilt/installed.
  - Confirmed on the Android emulator by the user: "Open Wysa" now opens Google Play
    (`bot.touchkin`), not the Apple App Store. Generic link buttons unchanged.
  - _Req: 2.1, 2.2, 2.4_

---

## Bug 3a — Clarify KPI single-select in onboarding (Req 3)

- [x] 3.1 Reproduce/confirm the ambiguity (baseline)
  - View the KPI step; confirm the only single-select hint is the small subheading.
  - _Req: 3.1_

- [x] 3.2 Strengthen instruction copy + a11y hint
  - Make single-select prominent near the options; add an `accessibilityHint` conveying one
    selection. Do not change options, the "I'll decide later" default, or downstream storage.
  - _Req: 3.1, 3.2, 3.3, 3.4_

- [x] 3.3 Verify + checkpoint
  - Typecheck clean for `KpiSelectionScreen.tsx`. Copy/a11y-only change; no behavior change.
  - MANUAL (fresh onboarding): confirm the "Pick one" pill shows above the options; predefined
    tap still advances; "Other" still reveals the input; TalkBack/VoiceOver reads the hint.
  - _Req: 3.1, 3.2, 3.3_

---

## Bug 3b — Add a Back control to onboarding steps missing one (Req 4)

- [x] 4.1 Reproduce/confirm missing Back (baseline)
  - Confirmed PrivacyNoticeScreen rendered only "Learn more" + "Continue"; no Back control.
  - _Req: 4.1_

- [x] 4.2 Add a guarded Back control to Privacy Notice
  - Added a top-left "← Back" (`TouchableOpacity`, 44×44, labelled, `navigation.goBack()`)
    matching the Intent/KPI pattern, guarded by `navigation.canGoBack()` so a resumed initial
    route doesn't show a broken/no-op Back. Welcome unchanged (still no Back).
  - _Req: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.3 Verify + checkpoint
  - Typecheck clean for `PrivacyNoticeScreen.tsx`. Forward flow/seeding untouched.
  - MANUAL: Welcome → Continue → Privacy Notice → Back returns to Welcome; a resumed
    onboarding that lands directly on Privacy Notice shows no Back button.
  - _Req: 4.1, 4.4, 4.5_

---

## Bug 4a — Make the collapsed card stack more noticeable on Android (Req 5)

- [x] 5.1 Baseline
  - Confirmed no platform branching in the collapsed-stack sizing; it rendered as a thin
    strip (`TOP_CARD_HEIGHT=52`, `EDGE_HEIGHT=6`).
  - _Req: 5.1_

- [x] 5.2 Platform-branch the collapsed-stack sizing (Android taller)
  - `CollapsedStack.tsx`: imported `Platform`; `TOP_CARD_HEIGHT` 52→76 and `EDGE_HEIGHT` 6→10
    on Android via `Platform.select` (iOS unchanged via `default`). Still a single tappable
    element with its "N other cards" accessibility label. No `WalletScreen` minHeight needed —
    the taller intrinsic size is enough against the `flex:1` focused card.
  - _Req: 5.1, 5.2, 5.3, 5.4_

- [x] 5.3 Verify + checkpoint
  - Typecheck clean for `CollapsedStack.tsx`.
  - MANUAL (Android): focus a card with others → collapsed stack noticeably taller and still
    tappable; focused card not crowded. iOS: unchanged.
  - _Req: 5.1, 5.2, 5.3, 5.4_

---

## Bug 4b — First-time hint pointing at the collapsed cards, Android only (Req 6)

- [x] 6.1 Add the persisted "seen" flag (+ store test)
  - Added `collapsedStackHintSeen` to `onboardingStore` (`OnboardingState`, `PersistedState`,
    `DEFAULT_STATE`, `getPersistedFields`, `loadState` with `?? false`) and a
    `markCollapsedStackHintSeen()` action mirroring `dismissBanner()`. New test
    `onboardingStore.collapsedStackHint.test.ts` (4 tests: default false, set+persist,
    rehydrate true, default-false for old rows) — passing. Existing property test still passes.
  - _Req: 6.2_

- [x] 6.2 Trigger + measure the collapsed-stack target (Android only)
  - `WalletScreen`: trigger effect (placed after `otherCards`) fires when
    `Platform.OS === 'android'` && `focusedCardId` && `!collapsedStackHintSeen` &&
    `!tutorial.isActive` && `otherCards.length > 0` (400ms delay for layout). Measures the
    `collapsedStackArea` via a ref + `onLayout` (`handleCollapsedStackLayout`) relative to
    `containerRef`, reusing the existing measure pattern.
  - _Req: 6.1, 6.5, 6.6_

- [x] 6.3 Render the hint via TooltipOverlay
  - Second `TooltipOverlay` (`position="above"`, `skipLabel="Got it"`) pointing at the
    collapsed stack; `onTargetPress`/`onSkip` → `markCollapsedStackHintSeen()` + hide. Driven
    by separate state (`showCollapsedStackHint`/`collapsedStackLayout`) so it never conflicts
    with the tutorial overlay.
  - _Req: 6.1, 6.3, 6.4, 6.5_

- [x] 6.4 Verify + checkpoint
  - Store test passes; typecheck clean for `WalletScreen.tsx` and `onboardingStore.ts`.
  - MANUAL (fresh Android): focus a card w/ others → hint appears pointing at the collapsed
    stack; dismiss → gone; re-focus → not shown; restart → still not shown (persisted). Not
    shown during the initial micro-tutorial. iOS: never shown.
  - _Req: 6.1, 6.2, 6.3, 6.5, 6.6_

---

## Final (all bugs)

- [x] 7. Full verification pass
  - `npm run typecheck`: NONE of the 15 edited source files have type errors. Remaining errors
    are all pre-existing and in untouched files (analytics/messaging workers, DualAxisChart,
    RationaleEntryPoint, SessionLauncherContent, analyticsStressTest, notificationService,
    sessionStore) plus the pre-existing jest-globals-in-tests noise — verified unchanged by
    stashing all changes (pristine tree shows the same errors).
  - New unit tests pass: `deepLinkService.storeUrl` (7), `onboardingStore.collapsedStackHint`
    (4); existing `onboardingStore.property` (3) still passes.
  - No temporary artifacts in the repo (screenshots live under `/tmp`).
  - REMAINING at ship time: the per-bug MANUAL on-device checks noted above, and an app
    release (Bug 1's native `AndroidManifest.xml` change) — follow the release checklist
    (marketing-version bump across the 4 synced locations + release notes).
