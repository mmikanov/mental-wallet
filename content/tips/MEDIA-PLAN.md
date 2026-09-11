# Tips — Media Plan

Per-article recommendation for the **best media asset** to develop, so visual learners can
*see* how a tip works rather than read it. Companion to the articles in `content/tips/` and
the `heroImage` frontmatter field.

## Ownership & status (who builds what)

What the agent (Kiro) can produce in-repo vs. what needs you to capture, and where each tip
stands. "Agent" = hand-authored CSS animation + generated GIF/poster via
`tools/capture-tip-gif.js`, wired into web + email + feed. "You" = screen recordings / real
screenshots of the app (Kiro can't record the simulator to production quality); Kiro then
wraps/annotates and wires them in.

| Tip | Ideal asset | Who produces | Status | Campaign ID (status) |
| --- | --- | --- | --- | --- |
| [welcome](#rec-welcome) | Animation (cards fan into a wallet) | **Agent** | ✅ Done — live (web anim + email GIF + feed) | `0d9c7f07-d16d-437d-878e-b06fbd4989e8` (sent) |
| [come-back-reset](#rec-come-back-reset) | Animation (calm breathing card) | **Agent** | ✅ Done — live (web anim + email GIF + feed) | `b204b503-5b02-47c8-b401-c302825ce1f9` (draft · reminders scope) |
| [outcome-capture](#rec-outcome-capture) | Screen video (check-in → Insights payoff) | **You** (recording, seed data first) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Full flow: complete a tool → "How do you feel" check-in → Calmer selected → ⋮ menu → Insights → staggered Best Tools/Outcome Trends reveal. | `dcb6f7db-6876-46c0-ba0e-343e187c47fb` (draft) |
| [feeling-anxious](#rec-feeling-anxious) | Screen video (real app flow — no fabricated pacer) | **You** (video) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Option 1 (real flow, no fabricated pacer): held wallet → amber pulse-ring tap on "Start from how I feel" → Anxious → amber pulse-ring tap on 5-4-3-2-1 Grounding → land in the tool (held) → fill SEE + TOUCH → fade out. | `7e5dc61d-9039-4fcd-bbbb-445adf245a13` (draft) |
| [emotion-based-session](#rec-emotion-based-session) | Screen-recorded video (flagship flow) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero) | `3c8bb564-402c-4354-b092-39772bb13a8c` (draft) |
| [discover-third-party-apps](#rec-discover-third-party-apps) | Screen video (iOS) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Ends on "Open in Headspace / Link opened" (store-launch not simulator-demoable). | `96a6931f-c862-4321-bae4-e84765c470fb` (draft) |
| [personal-kpi-check-in](#rec-personal-kpi-check-in) | Short screen video or screenshot | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Held wallet → amber pulse on 🌱 seedling → Daily check-in → rate 8/10 → note + Save → amber pulse on ⋮ kebab → Card actions → amber pulse on Insights → Insights payoff (Daily Check-In Impact + Outcome Trends) → fade out. | `a1ba2d2d-933b-4876-979f-a778321d877e` (draft) |
| [learn-more-evidence](#rec-learn-more-evidence) | Animated 2-beat (screenshot + pulse highlight → sheet) | **You** (screenshots) + **Agent** (animate/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Card w/ pulse ring on "Learn more" → cross-fades to the rationale sheet. | `b237f76e-5d42-4515-bb26-a252410dffb4` (draft) |
| [add-your-own-app](#rec-add-your-own-app) | Screen-recorded video (Create Tool → Link Button flow) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Finch example: wallet → ⋮ (pulse) → Create Tool (pulse) → Step 1 shell → Step 2 empty → +Add block (pulse) → Link Button (pulse) → URLs → Step 3 Preview → Save → wallet with new card → expanded card + Open button (pulse) → fade. | — |
| [add-your-own-tool](#rec-add-your-own-tool) | Screen video (Create Tool → input blocks → use it) | **You** (recording) + **Agent** (clean/GIF/wire) | ⬜ Not started — tip text drafted (needs review), needs recording. Most complex flow. | — |
| [reorder-tools](#rec-reorder-tools) | Short screen video (long-press → Reorder Cards → ▲/▼ → Done) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Wallet (amber pulse hint on top card) → Reorder Cards panel → ▲/▼ moves → Done → wallet with new order → fade. | — |
| [archive-restore-tools](#rec-archive-restore-tools) | Screen video (⋮ → Archive card → Archive screen → Restore) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Minimal edit of the real recording (trim+speed+fade); single amber pulse on Archive in the wallet ⋮ menu (the only hard-to-see tap). Focus card → ⋮ → Archive card → confirm → wallet → ⋮ → Archive → Archive screen → Restore to Wallet → confirm → wallet with card back. | — |

**What "Agent can do" means precisely:**
- ✅ Hand-authored CSS/SVG animations (concept/feeling pieces) — web + derived email GIF + poster.
- ✅ The GIF/poster conversion pipeline (`tools/capture-tip-gif.js`), wiring into `heroImage`,
  the inline `<figure>`, `styles.css`, and deploy.
- ✅ Annotation overlays / device frames *around* a screenshot you provide.
- ❌ Cannot record app screen video or capture production-quality real screenshots.
- ❌ Cannot produce photorealistic/brand artwork.

**Split-asset tip (feeling-anxious):** the flow is your screen recording, but the *animated
beat* (a breathing pacer) is a CSS animation Kiro can build and drop in — so it's a
collaboration. (Note: outcome-capture was initially planned as a split asset with an
"animated data reveal," but its payoff — the Insights "Best Tools" ranking — is a real app
screen, so it's a straight recording. See its per-tip entry for the required seeding prep.)

## Standard workflow for each asset (agent)

Follow these steps for every new tip asset so review is consistent:
1. **Build/clean the asset.** CSS animation → author + `tools/capture-tip-gif.js`. Screen
   recording → trim head/tail, speed up if needed (~1.3–1.5×), and **hold the final payoff
   frame ~2s** (`tpad`) so the ending is readable before the loop; scale to ~300px source,
   ~12fps; emit GIF + first-frame poster PNG.

   **⚠️ EDITING RULES — keep it minimal (the recording is already good; lightly clean it,
   don't re-direct it).** Over-editing (many pulses, redrawn/recolored UI, spliced clips,
   multi-segment restructuring) made later videos worse and burned credits. Defaults:
   1. **Trim + speed only.** Cut head/tail (incl. black frames), speed up slow stretches,
      hold the final real frame ~1.5s, fade out. That is usually the entire job.
   2. **At most ONE highlight per video**, and ONLY when it's genuinely hard to see that the
      user tapped something. Prefer zero. Highlight = the amber pulse ring (`#E6A700`,
      ~2.4s) positioned over the target; verify centering with one frozen-frame capture.
   3. **Never redraw, recolor, or cover UI.** If an item looks greyed from a tap-fade, LEAVE
      it — that's how the app really looks mid-tap. (This intentionally reverses the old
      "redraw the greyed item" rule, which caused over-editing.)
   4. **Never fabricate/splice** transitions or stitch in separate recordings. Use only the
      single recording, in its real order.
   5. **No multi-segment restructuring.** One continuous pass with light speed changes beats
      many stitched clips.
   6. **One preview, one round.** Build → show the preview page → expect ONE round of
      feedback. If it needs more than one substantive fix, the recording should be redone,
      not endlessly patched.

   **⚠️ BUDGET RULES (stop burning credits):**
   7. **Cap frame-sampling:** ~6 thumbnails to map the flow, build the GIF, ~3 frames to
      sanity-check. No exhaustive frame-by-frame hunting.
   8. **If two attempts don't land it, STOP** and ask a specific question rather than
      iterating blindly.

   Set the GIF **poster** to a frame that reads well on its own (if a pulse is used, one
   where the ring is visible).
2. **Always build a review preview page** (`assets/tip-media/<slug>-preview.html`, dev-only,
   excluded from deploy by the `*.html` glob) showing: the asset at a few **candidate display
   widths** (200/240/300) AND **rendered inside the real email layout** (greeting → media →
   title → summary → CTA). Open it in a browser for sign-off. This is the standard review the
   operator relies on — do it every time.
3. **Wire the tip** once approved: `heroImage` → GIF URL (email + feed); website body → inline
   `<figure class="tip-media">` (GIF) or `<figure class="…-anim">` (CSS animation) at the
   chosen `width`; bump frontmatter `version`.
4. **Rebuild + verify** (`npm run build:content`): article shows inline media, no duplicate
   top hero (build auto-skips it), `index.json` carries the GIF hero, other tips unaffected.
5. **Deploy + verify live**: assets 200, article renders inline media, preview HTML 404.
6. **Update the status table** above.

## How to read this

For each tip we pick the asset type that best matches what the tip is teaching, and give
concrete production direction (video shot-list, animation concept, or screenshot spec).

**Asset-type decision rule (why each choice):**
- **Screen-recorded video (muted, looping)** — when the tip teaches a *multi-step action or
  navigation flow* ("open X, tap Y, pick Z"). Motion shows the sequence far better than words.
- **Annotated screenshot (static)** — when the tip points at *one specific place/element*
  ("look for the Learn more link"). A single framed still with a callout is faster to grasp
  and cheaper to produce than video.
- **Lightweight animation (Lottie/looping)** — when the tip conveys a *concept or feeling*
  rather than a literal UI path (re-engagement, "your data over time", welcome warmth).
- **Static illustration/photo** — for newsletter/emotional tips with no UI to show.

**Three surfaces the media serves (recap):**
1. **Website article body** — the richest surface. Full **CSS/HTML animation** (loops,
   reduced-motion aware), or a step sequence of screenshots / an embedded video. This is
   where the "how to use it" demo really lives, and it ships *with the content* (the
   `build-content.js` pipeline passes raw HTML in the markdown body straight through `marked`).
2. **Email body** — email clients do **not** run CSS keyframes, JS, or (reliably) `<video>`.
   The one motion format that works is an **animated GIF** in a plain `<img>`. The tip email
   already renders the `heroImage` field as `<img>` (`messaging-worker/src/index.ts`), so the
   email path is: **put an animated GIF in `heroImage`.** It autoplays in Gmail/Apple
   Mail/Yahoo/mobile; **Outlook desktop shows only the GIF's first frame**, so frame 1 must
   stand alone.
3. **In-app feed card** — small lead image only. A **static PNG poster** (or the same GIF)
   in `heroImage`. (In-app animation is deferred — decided web-first.)

**One source, three renderings.** Author the animation once as the **web CSS animation**,
then generate the email/feed assets from it with the dev tool
`website/tools/capture-tip-gif.js` (`npm run capture:tip-gif` in `website/`). It renders the
CSS in headless Chrome, records one loop, and emits:
- `<name>.gif` — animated GIF for the email `heroImage` (and optionally the in-app feed), and
- `<name>.png` — the first frame as a poster / static fallback (Outlook, feed).

So each animated tip needs, per surface:
- **Web:** the CSS animation embedded in the article body (full fidelity).
- **Email:** a GIF (≤ ~1MB; lower fps/width if larger) whose **first frame** is a clean still, set as `heroImage`.
- **Feed:** the poster PNG (or the GIF) as `heroImage`.

**Static-fallback rule:** because Outlook and the in-app feed may show only a still, every
animation must be designed so its **first frame is meaningful on its own** (not an empty
stage mid-fly-in). Capture `--start` is tuned so frame 1 is the settled/legible state.

**Global production specs**
- **Device frame:** record on a clean iPhone (and one Android capture for store-link/collapsed-stack topics if reused). Portrait, 9:19.5.
- **Video:** 6–12s, silent, seamless loop, `.mp4` (H.264) + `.webp`/`.gif` fallback; also export a **poster frame** (first meaningful frame) as the `heroImage` for email/feed.
- **Screenshots:** 2x/3x retina PNG, real (not mocked) UI, use the seeded demo cards, no personal data.
- **Feed hero crop:** design for a ~16:9 or 3:2 card thumbnail; keep the key element in the center-safe area.
- **Accessibility:** every asset needs alt text / a caption; never rely on color alone for callouts; keep motion gentle (no fast flashing).
- **Privacy:** use placeholder content, never real user entries.

---

## Per-article recommendations

<a id="rec-welcome"></a>
### 1. welcome — *"Welcome to Mental Health Wallet"* (feature; welcome, getting-started)
- **Best asset:** **Lightweight animation** (concept, not a UI path) + a poster still for email.
- **Why:** This is a warm intro, not a how-to. There's no single flow to demo; the job is tone + "a small toolkit ready when you need it."
- **Concept:** A gentle animated wallet where 3–4 tool cards fan/stack into place (Apple-Wallet-style), settling calmly. Soft palette matching the app. 3–5s loop.
- **Fallback hero:** the settled end-frame (wallet with a few cards) as a static image.
- **Alt text:** "A wallet filling with a few coping-tool cards."

<a id="rec-emotion-based-session"></a>
### 2. emotion-based-session — *"Not sure what you need? Start from how you feel"* (feature; emotions, getting-started)
- **Best asset:** **Screen-recorded video** (multi-step flow) — the flagship demo.
- **Why:** This is a navigation flow with a clear payoff; motion sells it.
- **Video steps (8–12s):**
  1. Wallet with the "Start from how I feel" card visible.
  2. Tap it → emotion picker appears.
  3. Tap an emotion (e.g. "Anxious").
  4. Suggested tools list slides in.
  5. Brief pause on a suggested tool (don't need to open it).
- **Also show the branch (optional 2nd short clip or article screenshot):** the "guided check-in" path for when you can't name the feeling.
- **Feed hero:** poster frame of the emotion picker mid-selection.
- **Alt text:** "Tapping Start from how I feel, choosing an emotion, and getting suggested tools."

<a id="rec-outcome-capture"></a>
### 3. outcome-capture — *"See which tools actually help you"* (feature; tracking, reflection)
- **Best asset:** **Screen-recorded video** (straight recording — no fabricated animation). The
  "payoff" (step 3) is a REAL app screen: Insights → "Best Tools for You" ranked list. Same
  pipeline as emotion-based-session / discover (clean → speed → hold on the payoff).
- **Why:** Two beats — the one-tap check-in (UI action) AND the payoff (Insights shows which
  tools help most). Both are real screens, so we record, not animate.
- **⚠️ Recording prep (required — the payoff is empty on a fresh account):** the Insights
  "Best Tools" ranking only populates at the **confident** tier (~14+ check-ins, 10+ tool uses,
  2+ distinct tools). So on a **dev build + demo account**:
  1. Wallet has 3+ distinct tools (add a couple if needed).
  2. Settings → Developer → **"🧪 Insights Mock Data"** → enter `60` → **Seed Mock Data**
     (seeds ~60 days of correlated data → confident tier). NOTE: this WIPES existing
     completions/KPI/outcome data — demo account only, never a real one.
  3. In Insights, set the time-period selector to **"All"** so no "not enough activity in this
     range" empty state shows.
  (Seeder is `__DEV__`-only; reveal the Developer section via triple-tap on the Settings
  header if hidden. Source: `SeedInsightsButton` / `devInsightsMockData.ts`.)
- **Video steps (~10–14s, one continuous take; agent trims/speeds/holds):**
  1. Finish a tool → the "How do you feel now?" prompt appears (calmer / clearer / hopeful / same / worse).
  2. One tap on "Calmer".
  3. Wallet → ⋯ menu → **Insights** → land on **"Best Tools for You"** (numbered ranked list).
     Optionally scroll a touch to the "Outcome Trends" chart. Hold on the ranking (the payoff).
- **Feed hero:** poster of the 5-option check-in prompt (very recognizable, one-tap), OR the
  Best Tools ranking — pick whichever reads best as a still.
- **Alt text:** "Answering how you feel after a tool, then seeing which tools help most."
- **Note:** the "Best Tools" payoff is a numbered ranked list (not bar charts), so no
  agent-built data animation is needed — recording the real screen is better and simpler.

<a id="rec-personal-kpi-check-in"></a>
### 4. personal-kpi-check-in — *"Track the thing that matters to you"* (feature; tracking, goals)
- **Best asset:** **Screen-recorded video** (short) OR **annotated screenshot** if budget is tight.
- **Why:** Centers on one recognizable control — the seedling check-in button — plus a trend over time.
- **Video steps (6–9s):**
  1. Wallet with the seedling (🌱) check-in button highlighted.
  2. Tap it → log where you're at against your personal measure.
  3. Dissolve to a simple trend line ("some days up, some down").
- **Screenshot alt:** annotate the seedling button with a "Tap to check in" callout; second frame shows the trend.
- **Feed hero:** the seedling button in context with a subtle callout ring.
- **Alt text:** "Tapping the seedling check-in and seeing your personal trend."

<a id="rec-discover-third-party-apps"></a>
### 5. discover-third-party-apps — *"Keep the apps you already use, all in one place"* (feature; discovery, apps)
- **Best asset:** **Screen-recorded video** (navigation flow) — note: capture on **both iOS and Android** given the recent store-link fix, or at least verify the launch looks right per platform.
- **Why:** It's a discover→add→launch flow across screens; motion shows how the app cards live alongside the rest.
- **Video steps (9–12s):**
  1. Wallet → tap menu → "Add Tool".
  2. Library browser; scroll to the app cards (Headspace, Calm, Insight Timer logos visible).
  3. Add one to the wallet ("Added" confirmation).
  4. Back on the wallet, tap the new app card → it launches the external app (or shows the launch handoff).
- **Feed hero:** the library row of recognizable app logos (strong visual, brand-recognizable).
- **Alt text:** "Adding a wellness app like Calm as a card and launching it from the wallet."

<a id="rec-learn-more-evidence"></a>
### 6. learn-more-evidence — *"Why does this tool work? Tap Learn more"* (feature; trust, evidence)
- **Best asset:** **Annotated screenshot** (points at one element) — with an optional 5s video of the sheet opening.
- **Why:** The core message is "the Learn more link exists and here's what's behind it." That's a *location + reveal*, well served by a still with a callout; motion is a nice-to-have.
- **Screenshot spec:**
  - Frame 1: a tool's description with the **Learn more** link circled/arrowed.
  - Frame 2: the rationale sheet open — "In a nutshell", evidence level badge, "what research shows".
- **Optional video (5s):** tap Learn more → sheet slides up → rest on the evidence badge.
- **Feed hero:** the rationale sheet with the evidence badge (communicates "trust/credibility").
- **Alt text:** "The Learn more link on a tool and the evidence explanation it opens."

<a id="rec-feeling-anxious"></a>
### 7. feeling-anxious — *"Feeling anxious right now? Try this"* (problem_solving; anxiety, grounding, in-the-moment)
- **Best asset:** **Screen-recorded video** (in-the-moment flow) — reuse/trim the emotion-session capture, ending on the suggested tool the app actually shows today.
- **Why:** The promise is "don't decide, let the app point you," ending in relief. Motion through the flow conveys the "you don't have to figure it out" payoff.
- **⚠️ Decision (resolved): record the REAL app, no fabricated pacer.** The original plan
  ended on "the exercise animates (a breathing pacer expanding/contracting)." **That pacer
  does not exist in the app** — Box Breathing and every anxious-tagged tool are static
  instruction text (no animated/timer control type exists). A pacer GIF would promise
  behavior the app doesn't do, and the tips feed can't be gated to an app release (it's
  read at runtime by all installs), so the mismatch would hit most users. Chose **Option 1**:
  record what the app genuinely does today.
- **Video steps (8–12s):**
  1. Tap "Start from how I feel".
  2. Choose "Anxious".
  3. Open a suggested short grounding tool (pick whichever reads best as a still/end frame).
  4. Land on the real tool card. End calm — optionally a subtle on-brand highlight, NOT a fake animated pacer.
- **Feed hero:** the emotion picker mid-selection, or the suggested-tools list (calming, on-brand).
- **Alt text:** "Choosing anxious and opening a suggested grounding tool."
- **Care note:** keep it soothing and slow; this audience is activated. No urgent/flashy motion.
- **Future (parked, not blocking this tip):** if/when a real **breathing-pacer control** ships
  in the app (see Parking Lot below), re-record step 3–4 to end on the live pacer. Gate that
  re-record on adoption or a `minAppVersion` tip field (also parked).

<a id="rec-come-back-reset"></a>
### 8. come-back-reset — *"Here whenever you need it"* (come_back; re-engagement, reminders)
- **Best asset:** **Lightweight animation** or **static illustration** (concept, no UI path).
- **Why:** A re-engagement nudge with an explicitly low-pressure, "no streak to protect" message. Showing UI steps would feel like a demand; a warm, calm visual matches the tone.
- **Concept:** A single calm loop — e.g. one card gently glowing/breathing in an otherwise quiet wallet, or a soft "60 seconds" motif. Understated, no urgency.
- **Fallback hero:** a calm still of the wallet with one inviting card.
- **Alt text:** "A calm wallet with one tool waiting."

<a id="rec-add-your-own-app"></a>
### 9. add-your-own-app — *"Can't find your app? Add it yourself"* (feature; discovery, apps, customization)
- **Best asset:** **Screen-recorded video** (Create Tool → Link Button flow). Pairs with discover-third-party-apps as the "it's not in the library" escape hatch.
- **Why:** It's a multi-step build flow (menu → Create Tool → name it → Add block → Link Button → fill Label/Target URL → save → launch). Motion shows the sequence far better than prose, and it reassures users the builder isn't intimidating.
- **Example app to use (recommended): Finch** (the self-care pet app). It's recognizable as a
  mental-health app, warm/non-clinical (matches the brand tone), and is **NOT already in the
  library** (library apps: Headspace, Calm, Talkspace, BetterHelp, Wysa, Mindfulness.com,
  Insight Timer) — so the "can't find your app" premise stays honest. Target URL:
  `https://finchcare.com` (or its App Store link as fallback). Alternatives if preferred:
  Daylio, Sanvello, I Am, Moshi.
- **Custom icon (optional, advanced):** you *can* paste a URL to the app's logo for the icon,
  but that's a fiddly step for most users (they'd have to go find the image URL). Fine to show
  for a polished demo; skip it if it slows the video down. (Future: an AI setup assistant could
  fetch the logo + fill these fields automatically — see Parking Lot.)
- **Finch details for the demo (verified via iTunes lookup):**
  - App name: "Finch: Self-Care Pet"
  - **Stable icon URL** (App Store CDN, no expiry — use this, NOT a LinkedIn `media.licdn.com`
    URL which carries an expiry token and will go blank later):
    `https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/9d/82/5c/9d825ca0-6344-d476-d716-eb7c9d699da9/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg`
  - Target/website: `https://finchcare.com`; App Store fallback:
    `https://apps.apple.com/us/app/finch-self-care-pet/id1528595748`
- **Video steps (~10–14s, will be sped up + hold on payoff):**
  1. Wallet → open the ⋮ menu → tap **Create Tool**.
  2. Step 1: type a title, pick an icon (keep it quick).
  3. Step 2: tap **Add block** → choose **Link Button**.
  4. Fill **Label** ("Open my app") and **Target URL** (a website https://…); optionally a **Fallback URL**.
  5. Preview & Save → the new card appears in the wallet.
  6. End on the saved card in the wallet with its launch button (do NOT tap it — avoids the simulator dead-end / false "completed", same lesson as discover-third-party-apps).
- **Feed hero:** the saved custom card in the wallet, or the Link Button config filled in.
- **Alt text:** "Creating a custom tool with a Link Button that launches your own app."
- **Note:** simulator can't actually open the app, so end on the saved card (don't show the launch tap). Capture on iPhone.

<a id="rec-add-your-own-tool"></a>
### 10. add-your-own-tool — *"Build your own tool, exactly how you want it"* (feature; customization, tools, journaling)
- **Best asset:** **Screen-recorded video** (Create Tool → add input blocks → save → use it). The most complex flow of the set — a real builder walkthrough.
- **Why:** This is the app's deepest differentiator (build a self-contained coping tool from controls, used *inside* the app). Distinct from add-your-own-app, which builds a **Link Button launcher** for an external app. Motion is essential to show the block-stacking and that the result is a usable in-app card.
- **Video steps (~12–16s, will be sped up + hold on payoff):**
  1. Wallet → ⋮ menu → **Create Tool** (amber pulse-ring on the menu / Create Tool, house style).
  2. Step 1 (Shell): type a title + pick an icon (keep quick).
  3. Step 2 (Controls): tap **Add block** → add a couple of INPUT blocks (e.g. **Mood Slider**, **Text Area**, **Checkbox**) — NOT a Link Button (that's the other tip). Fill a label or two so it reads.
  4. Preview & Save → the new card appears in the wallet.
  5. **Open the saved card and fill it in** (the payoff — this is a tool you USE in-app, so show it being used, unlike add-your-own-app which ends on the launcher card). Hold on the filled tool.
- **⚠️ Complexity note:** this flow has the most steps of any tip. Expect heavy speed-up on the typing/config, pulse-ring highlights on the key taps (Create Tool, Add block), and possibly a jump-cut past the slowest config to keep it ~13–15s. Same discipline as feeling-anxious/personal-kpi.
- **Feed hero:** the finished custom tool card in the wallet (its stacked controls visible), or the Step 2 block list mid-build.
- **Alt text:** "Building a custom coping tool from blocks and using it inside the app."
- **Distinction to preserve:** add-your-own-**app** = Link Button that launches an external app; add-your-own-**tool** = input controls you use in-app. Keep the two assets visually different (this one shows filling in the tool; that one ends on a launcher card).

<a id="rec-reorder-tools"></a>
### 11. reorder-tools — *"Put your go-to tools right on top"* (feature; customization, organization)
- **Best asset:** **Short screen-recorded video** — the reorder interaction is quick and satisfying to watch.
- **Why:** Shows a small, delightful bit of control most users won't discover on their own (it's a long-press, no visible button).
- **⚠️ Accuracy (code-verified):** reordering is **NOT drag-and-drop**. Entry is a **long-press (~500ms) on a card** → opens a **"Reorder Cards"** panel → move each tool with **▲/▼ arrow buttons** → tap **Done** to save (tap outside = cancel). The ☰ icon in the panel is decorative, not draggable. Do not depict dragging.
- **Video steps (~7–10s):**
  1. Wallet (held a beat). Long-press a card — optionally an amber pulse-ring hint on a card first, house style.
  2. "Reorder Cards" panel opens.
  3. Tap ▲/▲ on a lower card to move a favorite toward the top (a couple of moves, each with the brief row "lift").
  4. Tap **Done** → back on the wallet with the new order.
- **Feed hero:** the "Reorder Cards" panel mid-move, or the reordered wallet.
- **Alt text:** "Long-pressing a card, moving it up with the arrows, and saving the new order."

<a id="rec-archive-restore-tools"></a>
### 12. archive-restore-tools — *"Tidy your wallet without losing anything"* (feature; customization, organization)
- **Best asset:** **Screen-recorded video** covering both halves (archive, then restore) — the reassurance is "it's reversible."
- **Why:** Encourages tidying by making clear archive is safe/reversible and distinct from delete. Two beats (hide, then bring back).
- **⚠️ Accuracy (code-verified labels):** tap a card to focus → **⋮** → **"Archive card"** (red) → confirm **Archive**. Archived cards live in the **Archive** screen, reached via the wallet's **top-right ⋮ → Archive**. Restore via **"Restore to Wallet"** → confirm **Restore**. Archive preserves history; only the separate **Delete** on the Archive screen is permanent — do NOT show Delete (avoid implying data loss).
- **Video steps (~10–14s):**
  1. Focus a card → ⋮ (amber pulse-ring on ⋮, house style) → **Archive card** → confirm. Card leaves the wallet.
  2. Wallet top-right ⋮ → **Archive** (pulse-ring on the Archive menu item).
  3. Archive screen → tap **Restore to Wallet** on that card → confirm **Restore**.
  4. Back on the wallet with the card returned. Hold on the payoff.
- **Feed hero:** the Archive screen with a card's "Restore to Wallet" button, or the ⋮ "Card actions" sheet showing "Archive card".
- **Alt text:** "Archiving a tool from its menu, then restoring it from the Archive screen."

---

## Priority order (suggested build sequence)

Highest leverage first (most-used feature + strongest visual payoff):
1. **emotion-based-session** (flagship flow; asset reusable for feeling-anxious).
2. **outcome-capture** (unique, recognizable one-tap + data payoff).
3. **feeling-anxious** (trim of #1 + a running exercise).
4. **discover-third-party-apps** (brand-recognizable logos; verify per-platform launch).
5. **learn-more-evidence** (cheap: annotated screenshots).
6. **personal-kpi-check-in** (short clip or screenshot).
7. **welcome** (animation; nice-to-have, evergreen).
8. **come-back-reset** (animation/illustration; lowest urgency).

## Email assets (per tip)

For every tip we send by email, produce a GIF for the `heroImage` from its web animation
(or from a screenshot sequence for the screen-recorded tips). Guidance:

- **Animation tips (welcome, come-back-reset, and the animated beats of outcome-capture /
  feeling-anxious):** build the web CSS animation, then run
  `npm run capture:tip-gif -- --in <html> --out <base> --duration <one-loop-ms> --fps 12 --width 300`
  to emit the GIF + poster PNG. Set `heroImage` to the GIF. **Keep GIFs email-light:** ~12fps
  / ~300px / ≤5s keeps the welcome GIF around ~580KB; bump down further if a busier animation
  exceeds ~600KB. (Puppeteer's bundled Chromium download is flaky on Apple Silicon — if
  launch fails with "-88", pass `--executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  or set `PUPPETEER_EXECUTABLE_PATH`; the tool auto-detects system Chrome by default.)
- **Screen-recorded tips (emotion-based-session, discover-third-party-apps,
  personal-kpi-check-in):** the email GIF is a short, trimmed capture of the same recording
  (you produce the recording; convert to GIF with the same ffmpeg recipe the tool prints).
  Keep it ≤ ~1MB.
- **Screenshot tips (learn-more-evidence):** no GIF needed — a single annotated PNG as
  `heroImage` is enough for email.
- **Always:** the GIF's **first frame** must be a clean, self-explanatory still (Outlook shows
  only that). Provide `alt` text (already listed per tip above).
- **Sizing (important):** the email hero `<img>` must carry an explicit `width` attribute
  (e.g. `width="300"`), not just `max-width:100%`. Outlook desktop ignores `max-width` and
  renders at the image's intrinsic pixel size, so without a fixed `width` the animated GIF and
  its static first-frame fallback can display at different sizes. Capture the GIF and poster in
  the **same run at the same `--width`** so their dimensions match, and set the `<img> width`
  to that value.

Email rendering reality (why GIF): `messaging-worker/src/index.ts` renders `heroImage` as a
plain `<img>`. CSS/JS/video won't animate in most clients; GIF autoplays broadly and
degrades to frame 1 in Outlook.

## Notes on wiring the assets in later
- **Website (primary):** embed the CSS animation (or screenshot sequence) inline in the tip's
  markdown body — `build-content.js` passes raw HTML through `marked`, so an inline
  `<figure class="tip-anim">…</figure>` block renders in the article. Mid-content placement is
  supported (media doesn't have to be a single hero at the top).
- **`heroImage`:** set to the **GIF** (email + optionally feed) or the **poster PNG** (feed).
  The field is already parsed by the website build, the email worker, and the app's tips
  service.
- **Tooling:** `website/tools/capture-tip-gif.js` (dev-only) converts a web animation to
  `<base>.gif` + `<base>.png`. Requires `puppeteer` (dev dep) and `ffmpeg` on PATH; it prints
  a manual ffmpeg command if ffmpeg is missing.
- **Consistency:** keep one palette (brand sage `#788d75`, cream `#f5f2eb`, app card colors),
  device frame, and motion style across all assets so the set looks like a family.
- **Reduced motion:** web animations honor `prefers-reduced-motion` (show the settled state);
  GIFs can't, which is another reason frame 1 must read on its own.

## POC status
- **welcome** — web CSS animation built: `website/assets/tip-media/welcome-wallet.html`
  (loops; reduced-motion aware; brand palette). Email GIF POC pending: run the capture tool
  once `puppeteer` + `ffmpeg` are available, then wire the GIF as `welcome`'s `heroImage`.
---

## Parking lot (future, not blocking any current tip)

These came up while working on the tips. None are prioritized yet.

### 1. Real breathing-pacer control in the app
- **Idea:** Add a genuine animated breathing pacer (an expanding/contracting square or circle
  guiding inhale/hold/exhale/hold), so tools like **Box Breathing** actually pace the user
  instead of just showing static 4-4-4-4 text. Visual reference the user likes:
  the Healthy Monday "square breathing" GIF —
  https://healthymonday.com/wp-content/uploads/2024/01/healthy-monday-SU-square-breathing.gif
- **Why parked:** it's a real product feature, not a marketing asset. Scope: new
  `breathing_pacer` control type = TS union + config interface (`src/types/index.ts`), new
  `BreathingPacerControl.tsx` renderer (Reanimated already a dep), a case in
  `ControlRenderer.tsx`, a SQLite CHECK-constraint **table-rebuild migration** for the
  `controls` table (template exists: `runIconTypeCheckMigration` in `migrations.ts`), and
  creator-UI wiring (`Step2Controls.tsx`). Then swap `lib-box-breathing`'s `static_text` for it.
- **Payoff if built:** better in-app experience for everyone AND lets feeling-anxious (tip #7)
  end on a live pacer instead of static text.

### 2. `minAppVersion` field on tips
- **Idea:** Add an optional `minAppVersion` to tip frontmatter so the in-app feed can hide
  version-specific tips from older installs. Tips currently ship continuously (feed reads
  `index.json` at runtime, no release gate), so a tip can reference a feature a user's build
  doesn't have yet.
- **Why it matters:** it's the general fix for "a tip describes behavior that only exists in
  newer builds" — exactly the mismatch that blocked showing a breathing pacer in feeling-anxious.
- **Why parked:** no immediate need; resurface when a tip must reference a build-gated feature.

### 3. Store-lookup prefill in Create Tool (the pre-AI step)
- **Idea:** A "Fetch from App Store" button in the Create Tool flow (external-app path). The
  user types an app name or picks a result, and the app pre-fills the card fields — name,
  icon, description, and store/launch URLs — instead of the user hunting for a logo URL and
  typing everything by hand.
- **Feasibility (verified):**
  - **iOS: easy.** Apple's **iTunes Search/Lookup API** is free, public, no key. Search by name
    (`https://itunes.apple.com/search?term=<app>&entity=software`) or lookup by id
    (`https://itunes.apple.com/lookup?id=<id>`). Returns `trackName`, `description`,
    `artworkUrl512` (icon), `trackViewUrl` (store URL), etc. (This is the exact API used to get
    Finch's stable icon for the add-your-own-app demo.)
  - **Android: no clean equivalent.** Google Play has **no official public lookup API** (the
    Play Developer API only manages *your own* apps). Options are scraping the Play page
    (fragile, against ToS) or a paid third-party service. So Android-side lookup is NOT
    reliably doable the same way.
  - **Cross-platform payoff anyway:** the created card is platform-agnostic — name/icon/
    description are just display data and the launch is a URL. So an **iOS-only lookup still
    benefits Android users**: the fetched icon/name display correctly on both platforms once
    the card exists. Per-platform launch already handled via `appStoreId`/`playStoreId` in
    `externalAppCards`.
- **Why it's the right first step (before AI):** it's deterministic and small — a button, one
  API call, prefill logic, and a graceful fallback to manual entry. It de-risks the eventual
  AI assistant (which would orchestrate this same fetch plus reasoning). Do this first.
- **Scope note:** Create Tool is currently fully offline/local. This adds the builder's first
  outbound network call — handle loading/error/offline states and never block tool creation if
  the lookup fails (fall back to manual entry).
- **Why parked:** not urgent; strong candidate once we invest in the Create Tool experience.

### 4. AI-assisted tool/app setup
- **Idea:** An in-app AI helper that sets up a new tool or external-app card *for* the user,
  instead of making them fill the builder out by hand. The user says what they want (e.g. "add
  Finch" or "make me a nightly wind-down journal"), and the assistant fetches the details
  (app website/deep link, logo/icon URL, sensible controls) and pre-fills the Create Tool
  flow — user just reviews and saves.
- **Why it matters:** the manual Create Tool flow (especially finding a logo URL or the right
  deep link for an external app) is the fiddly part that only more sophisticated users will
  bother with. An AI setup step would make add-your-own-app / add-your-own-tool approachable
  for everyone, and is a natural differentiator.
- **Why parked:** larger feature (LLM integration, fetching/validating third-party metadata,
  review UX). Surfaced while choosing the add-your-own-app demo (custom icon URL is too fiddly
  for most users). Resurface when investing in onboarding/customization depth.
