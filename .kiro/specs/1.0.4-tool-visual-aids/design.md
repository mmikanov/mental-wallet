# Design Document — Tool Visual Aids (1.0.4)

## Overview

Add a calming, on-brand animated breathing visual to the **Box Breathing** curated tool
(`lib-box-breathing`). The visual paces the 4-4-4-4 rhythm (inhale expand, hold, exhale
contract, hold) and complements, not replaces, the existing textual steps.

The central constraint (Requirement 2) is that the visual must **actually animate on both
iOS and Android**. The investigation below shows that neither existing media path in the app
reliably auto-animates cross-platform. The chosen approach is therefore an **in-app
Reanimated component**, not a media asset routed through `display_media`.

## Investigation: why not a GIF or a video?

Findings from the current codebase (anchors in the requirements doc):

1. **RN `<Image>` GIF gap.** `DisplayMediaControl` renders `mediaFileType: 'image'` with
   React Native's `<Image>`. RN `<Image>` animates GIFs on iOS but **not on Android** by
   default. Shipping a GIF-as-image would show a frozen frame to every Android user. This is
   the exact pitfall Requirement 2 exists to avoid.

2. **`VideoPlayer` is a placeholder.** `src/components/media/VideoPlayer.tsx` does not play
   video. Its own header says "Uses a placeholder implementation" and `togglePlayback` has a
   `// TODO: Integrate expo-av` with no actual playback. The `mediaFileType: 'video'` path
   therefore renders a play button over a dark box, nothing moves.

3. **No video / GIF-capable / animation-asset library is installed.** `package.json` has no
   `expo-av`, `expo-video`, `expo-image`, `react-native-video`, `react-native-fast-image`, or
   `lottie`. Choosing a video or Android-GIF approach would mean adding and wiring a new
   native dependency (new build config, new failure modes, larger bundle) for a single small
   ambient visual.

4. **Reanimated is already a dependency.** `react-native-reanimated ~4.1.0` is present (used
   across the app). It runs animations on the UI thread and works identically on iOS and
   Android. It is the lowest-risk way to guarantee cross-platform motion.

### Decision

Build an **in-app Reanimated `BoxBreathingAnimation` component** and render it inside the Box
Breathing card via a new lightweight control type `breathing_animation`.

Why this over the media paths:
- **Animates on both platforms by construction** (Reanimated UI-thread animation), satisfying
  Req 2.1/2.2 without a "verify GIF animates on Android" gamble.
- **Zero new dependencies**, no native build changes, no bundle bloat from a video/asset. The
  "asset" is code, so it is IP-free by construction (Req 3.1) and its source lives in the repo
  and is trivially tweakable (Req 3.4).
- **No dependency on the placeholder `VideoPlayer`** and no need to fix real video playback in
  a release focused elsewhere.
- **No cached-file / download / persistent-path machinery** (`display_media` carries
  `mediaSourceType`, `downloadAndCache`, `resolveImageUri`); none of that applies to a
  code-drawn animation, so overloading `display_media` would be a poor fit.

Trade-off accepted: this adds one small control type rather than reusing `display_media`. That
is intentional, the animation is not "media loaded from a source", it is a rendered component.
The parked richer idea (a configurable interactive pacer control) remains out of scope.

## Architecture

```
lib-box-breathing (curatedLibrary.ts)
  controls: [
    { type: 'breathing_animation', position: 0, config: { pattern: '4-4-4-4' } },  // NEW, on top
    { type: 'static_text',        position: 1, config: { ...existing steps... } }, // kept
  ]
        │
        ▼
ControlRenderer.tsx  ── switch(control.type)
        │  case 'breathing_animation':
        ▼
BoxBreathingAnimation.tsx  (NEW, Reanimated)
  - expanding/contracting square + phase label ("Breathe in" / "Hold" / "Breathe out" / "Hold")
  - loops seamlessly; slow, calm easing; brand palette
  - respects reduce-motion; accessible fallback
```

### New control type: `breathing_animation`

- Add `'breathing_animation'` to the `ControlType` union in `src/types/index.ts`, with a
  `BreathingAnimationConfig` (`{ pattern: '4-4-4-4'; label?: string }`). Kept minimal and
  fixed for 1.0.4 (only 4-4-4-4 is needed); the config shape leaves room to parameterize
  later without another type.
- Add a `case 'breathing_animation'` to `ControlRenderer.tsx` that renders
  `<BoxBreathingAnimation />`. It is display-only (like `static_text`): no `value`/`onChange`,
  not part of completion capture.
- **Creator surface:** this is a curated-only control for 1.0.4. Do **not** add it to the
  Step 2 control picker (`getDefaultConfig` / creator UI), so users cannot add it to custom
  tools (explicitly out of scope). It only appears because it is compiled into the curated
  card. Confirm the creator preview and read-only render paths tolerate an unknown-to-picker
  control gracefully (the renderer's `default: return null` already guards unknown types).

### `BoxBreathingAnimation` component

`src/components/controls/BoxBreathingAnimation.tsx`

- **Motion:** a rounded square whose scale animates on a 16s loop: 4s expand (inhale), 4s hold
  (stay large), 4s contract (exhale), 4s hold (stay small). Use `withSequence` +
  `withTiming` (calm easing, e.g. `Easing.inOut(Easing.ease)`), wrapped in `withRepeat(..., -1)`
  for a seamless loop. Scale range kept gentle (e.g. 0.6 → 1.0), no flashy motion (Req 1.2).
- **Phase label:** a text label under/over the square that changes with the phase
  ("Breathe in", "Hold", "Breathe out", "Hold"). Drive it from the same clock so it stays in
  sync with the scale.
- **Palette:** sage `#788d75` for the animated square, cream `#f5f2eb` backdrop, per
  `src/utils/cardColors.ts` conventions (Req 1.3 / 3.2). Reads clearly at the card's render
  width; fixed, contained height consistent with other controls (~200pt block).
- **Reduce motion / accessibility (Req 1.4):**
  - If the OS "reduce motion" setting is on (`AccessibilityInfo.isReduceMotionEnabled` +
    change listener), render a **static** square (largest or mid state) with the label, no
    looping animation.
  - Provide an `accessibilityLabel` describing the pacer ("Box breathing pacer, 4 seconds in,
    4 hold, 4 out, 4 hold") and mark decorative sub-views appropriately. The textual
    `static_text` steps remain the authoritative instructions for screen-reader users.
- **Lifecycle:** cancel/settle the animation on unmount (Reanimated cleans shared values, but
  ensure no `withRepeat` leak / warning). Pause is not required (ambient visual), but it must
  not keep animating work when the card is not mounted.

### Box Breathing card change (`curatedLibrary.ts`)

- Prepend a `breathing_animation` control at `position: 0`, shift the existing `static_text`
  to `position: 1` (visual above the steps; both visible, Req 1.4). Keep everything else
  (rationale, tags, colors) unchanged.

## Ship & propagation model (Req 1.5)

- Curated cards are compiled into the build; there is no OTA card update. The new control
  ships with the 1.0.4 app build.
- Per the admin/deploy model, cards already in a user's wallet keep their **own DB copy** from
  when they were added, so the visual reaches an existing wallet copy **only if the user
  re-adds Box Breathing** from the library. New adds get it immediately. This is acceptable
  for 1.0.4 and is documented here as a known limitation (no backfill/migration of existing
  wallet copies in this spec).

## Testing strategy

- **Unit (logic-level):** a small test that `lib-box-breathing` includes a
  `breathing_animation` control at position 0 and still includes its `static_text` steps
  (guards Req 1.1 / 1.4 and prevents a future edit from dropping either).
- **Component render:** `BoxBreathingAnimation` renders without throwing; with reduce-motion
  mocked on, it renders the static branch (no `withRepeat`); exposes the expected
  `accessibilityLabel`.
- **Typecheck:** `tsc --noEmit` clean for the new type, renderer case, component, and card.
- **MANUAL, both platforms (Req 2.2, the whole point):**
  - iOS simulator/device: open Box Breathing, confirm the square expands/holds/contracts/holds
    on a smooth ~16s loop with synced phase labels, brand colors, calm motion.
  - **Android emulator/device: confirm it actually animates** (this is the case a GIF would
    have failed). Confirm loop is seamless and labels stay in sync.
  - Reduce-motion ON (both OSes): confirm static, non-animating render + label.
  - Confirm the textual steps still show below the visual.

## Requirements coverage

| Requirement | Addressed by |
|---|---|
| 1.1 add visual to Box Breathing | new `breathing_animation` control on `lib-box-breathing` |
| 1.2 calm 4-4-4-4 motion | 16s slow loop, gentle scale, `Easing.inOut` |
| 1.3 brand palette, legible | sage/cream, ~200pt contained block |
| 1.4 keep textual steps / a11y | `static_text` retained; reduce-motion + a11y label |
| 1.5 ships with build, wallet-copy caveat | compiled control; limitation documented |
| 2.1 animate both platforms | Reanimated UI-thread animation |
| 2.2 verify on real Android | manual Android check in test plan |
| 2.3 (video autoplay/loop/muted) | N/A, no video path used (documented) |
| 2.4 reliable load / bundled | code, no network fetch or asset file |
| 3.1 produced by us, IP-free | animation is our own code |
| 3.2 brand + calm motion | palette + easing above |
| 3.3 small, seamless loop | no asset bytes; `withRepeat` seamless loop |
| 3.4 source kept in repo | component source in repo, tweakable |
