# Requirements Document — Tool Visual Aids (1.0.4)

## Introduction

Some curated tools are purely instructional text today. For example, **Box Breathing**
(`lib-box-breathing`) is a single `static_text` control listing the 4-4-4-4 steps, with no
visual guide. A simple animated visual aid (like a square-breathing animation that expands
on inhale, holds, contracts on exhale) makes these tools clearer and more calming to use.

This spec adds **visual aids to curated tools**, starting with **Box Breathing**, using the
app's **existing `display_media` control** (already shipped: image/video/audio via local
file, direct URL, or platform embed). No new control type is required.

**Decisions (from product):**
- Start with **Box Breathing** only. Other tools (and other visual ideas) are a follow-up we
  prioritize together later.
- The asset must be **on-brand and IP-free** (produced by us, not reused from third parties
  like the Healthy Monday GIF). Brand palette: sage `#788d75`, cream `#f5f2eb`, app card
  colors from `src/utils/cardColors.ts`.

## Requirements

### Requirement 1: Add a visual aid to Box Breathing

**User Story:** As a user opening the Box Breathing tool, I want a calming animated visual
that paces my breathing, so that I can follow along without counting in my head.

#### Acceptance Criteria

1. THE Box Breathing curated card (`lib-box-breathing` in `src/data/curatedLibrary.ts`)
   SHALL include a **`display_media` control** presenting an on-brand square/box breathing
   animation, in addition to (or integrated with) its existing instructional text.
2. THE animation SHALL convey the 4-4-4-4 rhythm visually (inhale expand, hold, exhale
   contract, hold), calm and slow (no flashy/urgent motion; this audience may be activated).
3. THE visual SHALL use the brand palette (sage `#788d75` / cream `#f5f2eb` / app card
   colors) and read clearly at the size it renders in the card.
4. THE existing textual steps SHALL remain available (the visual complements, not replaces,
   the instructions), preserving accessibility for users who can't/don't view the animation.
5. THE change SHALL ship with the app build (curated cards are compiled in; there is no OTA
   card update). Note per the admin/deploy model: cards already in a user's wallet keep their
   own DB copy, so the visual reaches existing wallet copies only if re-added — acceptable
   for 1.0.4; document this limitation.

### Requirement 2: The visual must actually animate on BOTH iOS and Android

**User Story:** As a user on either platform, I want the visual to actually move, so that it
guides my breathing rather than showing a frozen frame.

#### Acceptance Criteria

1. THE chosen media format SHALL animate on **both iOS and Android**. This is a known
   pitfall: React Native's `<Image>` (used by `DisplayMediaControl` for `mediaFileType:
   'image'`) **animates GIFs on iOS but not on Android by default**. The design MUST choose an
   approach that animates on both, e.g. one of:
   - a short **looping video** (MP4/WebP) via the control's video path (`mediaFileType:
     'video'`, which uses `VideoPlayer`), OR
   - an **animated-GIF-capable image** approach that works on Android (verify the app's image
     stack animates GIFs on Android; if not, do not rely on GIF-as-image), OR
   - a **hand-built animated component** (Reanimated) if a media asset can't animate reliably
     on both (fallback approach; larger change).
2. THE design SHALL explicitly verify the chosen approach animates on a real Android build,
   not assume it (the GIF-on-Android gap is the whole reason this requirement exists).
3. IF a looping video is used, it SHALL autoplay, loop, be muted, and not show intrusive
   player chrome (it's an ambient visual, not a media player the user operates).
4. THE asset SHALL be bundled/hosted so it loads reliably (a bundled local asset is preferred
   over a network fetch for an always-present onboarding-critical visual; confirm in design).

### Requirement 3: Produce an on-brand, IP-free asset

**User Story:** As the operator, I want the breathing visual to be our own, brand-consistent,
and free of third-party IP, so that we can ship it without licensing concerns.

#### Acceptance Criteria

1. THE asset SHALL be **produced by us** (e.g. a CSS/SVG/Reanimated animation rendered to a
   looping video/GIF via the existing `website/tools/capture-tip-gif.js`-style pipeline, or an
   in-app Reanimated component), NOT copied or hotlinked from a third party.
2. THE asset SHALL match the brand palette and the calm motion guidance in Requirement 1.
3. THE asset SHALL be reasonably small (loads quickly, doesn't bloat the app bundle) and
   loop seamlessly.
4. THE asset's source (the animation definition, if generated) SHALL be kept in the repo so
   it can be regenerated/tweaked later, following the tip-media convention.

## Out of Scope

- Adding visuals to tools other than Box Breathing (a prioritized follow-up).
- A configurable/interactive breathing **pacer control type** (the richer parked idea) — this
  spec uses the existing `display_media` control, not a new control.
- Letting users add animated visuals to their own custom tools beyond what `display_media`
  already supports.
- AI-generated backgrounds (tracked in `tool-customization-enhancements`).

## Notes / Traceability (implementation anchors)

- `src/data/curatedLibrary.ts` — `lib-box-breathing`: add the `display_media` control.
- `src/components/controls/DisplayMediaControl.tsx` — renders image (RN `<Image>`) / video
  (`VideoPlayer`) / platform embeds; note the Android GIF-animation gap for the image path.
- `src/components/media/VideoPlayer.tsx` — the video path if a looping MP4/WebP is chosen.
- Brand: `src/utils/cardColors.ts`; tip-media asset pipeline: `website/tools/capture-tip-gif.js`.

## Open Questions (design)

- Format decision: looping **video** (most reliable cross-platform) vs. animated GIF (Android
  risk) vs. in-app **Reanimated** component (no asset, fully controllable, but more code).
  Recommend confirming which of the three during design after a quick Android animate test.
- Whether the visual sits above or below the textual steps in the card, and its size.
- Bundled local asset vs. hosted URL (bundled preferred for reliability; affects app size).
