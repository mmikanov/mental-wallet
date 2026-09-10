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

| Tip | Ideal asset | Who produces | Status |
| --- | --- | --- | --- |
| [welcome](#rec-welcome) | Animation (cards fan into a wallet) | **Agent** | ✅ Done — live (web anim + email GIF + feed) |
| [come-back-reset](#rec-come-back-reset) | Animation (calm breathing card) | **Agent** | ✅ Done — live (web anim + email GIF + feed) |
| [outcome-capture](#rec-outcome-capture) | Screen video (check-in → Insights payoff) | **You** (recording, seed data first) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Full flow: complete a tool → "How do you feel" check-in → Calmer selected → ⋮ menu → Insights → staggered Best Tools/Outcome Trends reveal. |
| [feeling-anxious](#rec-feeling-anxious) | Screen video ending on a breathing pacer | **You** (video) + **Agent** (breathing-pacer anim) | ⬜ Not started |
| [emotion-based-session](#rec-emotion-based-session) | Screen-recorded video (flagship flow) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero) |
| [discover-third-party-apps](#rec-discover-third-party-apps) | Screen video (iOS) | **You** (recording) + **Agent** (clean/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Ends on "Open in Headspace / Link opened" (store-launch not simulator-demoable). |
| [personal-kpi-check-in](#rec-personal-kpi-check-in) | Short screen video or screenshot | **You** (Agent can annotate) | ⬜ Not started |
| [learn-more-evidence](#rec-learn-more-evidence) | Animated 2-beat (screenshot + pulse highlight → sheet) | **You** (screenshots) + **Agent** (animate/GIF/wire) | ✅ Done — live (web inline GIF + email/feed hero). Card w/ pulse ring on "Learn more" → cross-fades to the rationale sheet. |
| [add-your-own-app](#rec-add-your-own-app) | Screen-recorded video (Create Tool → Link Button flow) | **You** (recording) + **Agent** (clean/GIF/wire) | ⬜ Not started |

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

   **House style for highlights:** when you need to point at a specific UI element (a small
   link, a button), use a **subtle pulsing ring** around it (amber `#E6A700`, ~2.4s pulse) —
   NOT a cartoon hand/pointer (too playful, clashes with the clean screen-recording tips).
   Position the ring over the target and verify centering with a frozen-frame capture before
   generating the GIF (coordinates are px against the stage's authored width, so capture at
   that same `--width`). For a "tap X → see Y" story, use a **2-beat** animation: highlight
   the element, then cross-fade to what it opens and hold. Set the GIF **poster** to a frame
   where the ring is fully visible (the default first frame can catch it mid-pulse).
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
- **Best asset:** **Screen-recorded video** (in-the-moment flow) — reuse/trim the emotion-session capture, ending on a grounding exercise actually running.
- **Why:** The promise is "don't decide, let the app point you," ending in relief. Motion + a running exercise conveys the calm payoff.
- **Video steps (8–12s):**
  1. Tap "Start from how I feel".
  2. Choose "Anxious".
  3. Open a suggested short grounding/breathing tool.
  4. The exercise animates (e.g. a breathing pacer expanding/contracting) for a couple of cycles — end on calm.
- **Feed hero:** the breathing/grounding exercise mid-animation (calming, on-brand).
- **Alt text:** "Choosing anxious and starting a short guided breathing exercise."
- **Care note:** keep it soothing and slow; this audience is activated. No urgent/flashy motion.

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
