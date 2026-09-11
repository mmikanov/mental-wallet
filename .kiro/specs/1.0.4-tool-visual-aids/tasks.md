# Tasks — Tool Visual Aids (1.0.4)

Approach (from design): an in-app **Reanimated** `BoxBreathingAnimation` rendered via a new
curated-only control type `breathing_animation`. No new dependencies, no video/GIF asset, no
change to the placeholder `VideoPlayer`. Order: type → component → renderer wiring → card →
tests/verify (incl. the mandatory real-Android animate check).

## Task 1: Add the `breathing_animation` control type

- [x] 1.1 Extend the control model in `src/types/index.ts`
  - Add `'breathing_animation'` to the `ControlType` union and a `BreathingAnimationConfig`
    (`{ pattern: '4-4-4-4'; label?: string }`). Keep it minimal/fixed for 1.0.4; shape leaves
    room to parameterize later without a new type. Display-only (no value in completions).
  - _Req: 1.1_

## Task 2: Build the animation component

- [x] 2.1 Add `src/components/controls/BoxBreathingAnimation.tsx`
  - Reanimated square: 16s loop = 4s expand (inhale) → 4s hold → 4s contract (exhale) → 4s
    hold, via `withSequence`/`withTiming` (calm `Easing.inOut(Easing.ease)`) wrapped in
    `withRepeat(-1)`. Gentle scale (~0.6→1.0), no flashy motion. Phase label in sync
    ("Breathe in" / "Hold" / "Breathe out" / "Hold"). Palette: sage `#788d75` square on cream
    `#f5f2eb`, ~200pt contained block, legible at card width.
  - _Req: 1.2, 1.3, 3.1, 3.2, 3.3, 3.4_
- [x] 2.2 Reduce-motion + accessibility branch
  - Read `AccessibilityInfo.isReduceMotionEnabled()` + subscribe to changes; when ON, render a
    **static** square + label (no `withRepeat`). Provide an `accessibilityLabel` describing the
    pacer; keep decorative sub-views out of the a11y tree. Cancel/settle animation on unmount
    (no `withRepeat` leak/warning).
  - _Req: 1.4, 2.4_

## Task 3: Wire the control into the renderer

- [x] 3.1 Add `case 'breathing_animation'` to `ControlRenderer.tsx`
  - Render `<BoxBreathingAnimation />` (display-only, like `static_text`, no `value`/`onChange`).
    Do NOT add it to the Step 2 creator picker/`getDefaultConfig` (curated-only, per scope);
    confirm the renderer's `default: return null` still guards unknown types so creator/preview
    paths don't break.
  - _Req: 1.1, 2.1_

## Task 4: Add the visual to Box Breathing

- [x] 4.1 Update `lib-box-breathing` in `src/data/curatedLibrary.ts`
  - Keep the `static_text` steps at `position: 0`; add the `breathing_animation` control at
    `position: 1` (steps first, visual below so the user reads the instructions then scrolls to
    the pacer; both kept, both visible). Leave rationale, tags, colors unchanged. Document inline
    (or via the release notes) the wallet-copy caveat: existing wallet copies get the visual only
    on re-add; no backfill in 1.0.4.
  - _Req: 1.1, 1.4, 1.5_

## Task 5: Tests + verification

- [x] 5.1 Unit / component tests
  - Card test: `lib-box-breathing` includes a `breathing_animation` control (below the
    `static_text` steps) AND still includes those steps (guards Req 1.1/1.4 against future edits).
  - Component test: `BoxBreathingAnimation` renders without throwing; with reduce-motion mocked
    ON it renders the static branch (no repeating animation) and exposes the expected
    `accessibilityLabel`.
  - _Req: 1.1, 1.4_
- [x] 5.2 Verify + checkpoint (automated) — MANUAL device checks still OPERATOR TODO
  - DONE: `npm run typecheck` shows no new errors in the touched files (pre-existing
    unrelated errors confirmed identical on `main`). Automated tests pass:
    `boxBreathingVisual.test.ts`, `BoxBreathingAnimation.test.tsx` (incl. reduce-motion
    branch), and `curatedLibrary.test.ts` (ControlType validity updated for the new type).
  - OPERATOR TODO (needs a real build, cannot be automated here):
    - MANUAL iOS: open Box Breathing → square expands/holds/contracts/holds on a smooth ~16s
      loop, phase labels synced, brand colors, calm motion, steps still shown below.
    - **MANUAL Android (the whole reason for Req 2): confirm it actually animates** (not a
      frozen frame), loop seamless, labels synced.
    - MANUAL reduce-motion ON (both OSes): static, non-animating render + label.
  - _Req: 1.2, 1.3, 1.4, 2.1, 2.2, 2.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1"] },
    { "wave": 2, "tasks": ["2.1", "2.2"] },
    { "wave": 3, "tasks": ["3.1"] },
    { "wave": 4, "tasks": ["4.1"] },
    { "wave": 5, "tasks": ["5.1", "5.2"] }
  ],
  "notes": "1.1 defines the control type/config the component (2.x), renderer (3.1), and card (4.1) all depend on. Component before renderer wiring; renderer before adding the control to the card so the card renders when added. 5.x closes out automated tests plus the mandatory manual iOS + real-Android animate verification (Req 2.2)."
}
```
