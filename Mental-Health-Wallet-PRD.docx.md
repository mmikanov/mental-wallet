**Mental Health Wallet: Product Requirements Document**

**Updated January 19, 2026**

---

**Executive Summary**

**Mental Health Wallet** is a mobile-first application that unifies scattered mental health coping tools into a personalized, habit-forming toolkit. Users collect "cards" (coping tools, exercises, reminders, trackers) from a curated community library or create their own. The app uses a signature stacked card interaction (inspired by Apple Wallet) combined with reminders, habit tracking, and mood analytics to help users discover which tools work best for them.

The MVP targets general consumers interested in self-help and mental wellness, with a secondary path for therapists to bring structured tools into the app. The product emphasizes curation quality, user-generated tool discovery, and data-driven insights about tool effectiveness tied to mood improvement.

---

**1\. Problem Statement**

Users accumulate mental health and coping tools throughout their lives from therapists, books, social media, apps, and personal experiments. These tools are scattered across multiple platforms, notebooks, and devices, making it difficult to:

* **Discover and remember tools** when they need them.

* **Practice tools consistently** without external reminders.

* **Understand which tools actually work** for their unique situation.

* **Share or discover tools** from trusted sources.

This fragmentation reduces tool adoption and prevents users from building sustainable habits around the strategies most effective for them.

---

**2\. Product Vision**

Mental Health Wallet is a **personal operating system for mental health coping tools**—a single, delightful place to store, practice, and refine every technique that helps you feel better.

**Core Value Proposition**

* **One place for all tools**: Import from anywhere (therapist advice, apps, books, community) into your personal wallet.

* **Know what works**: Built-in analytics show which tools most improve your mood and resilience.

* **Build habits**: Reminders, streaks, and badges encourage consistent practice.

* **Share and grow**: Submit your own tools to the community library; discover new ones that fit your life.

---

**3\. Target Users**

**Primary User (MVP)**

**Profile**: Health-conscious general consumer, ages 18–55, interested in mental health, self-improvement, and psychology.

**Characteristics**:

* Uses journaling, meditation, or therapy.

* Interested in building better coping habits.

* Motivated by progress tracking and gamification.

* Active on social media; willing to share milestones.

* May use 2–3 existing mental health apps (mood trackers, meditation apps, journaling).

**Needs**:

* A single trusted place to centralize tools.

* Encouragement and reminders to practice.

* Insight into what actually helps.

* A sense of community and discovery.

**Secondary User (Post-MVP)**

**Profile**: Licensed therapist or trained counselor.

**Use case**:

* Bring structured tools (cognitive reframing exercises, coping cards) into the app and assign them to clients.

* Use the app as a structured companion to in-session therapy.

* Track client engagement with prescribed tools (optional analytics view for the therapist).

---

**4\. Key Features (MVP & Roadmap)**

**4.1 Wallet UI & Card Interaction**

**Overview**

The wallet is the core interface. It uses a **reverse-stacked card layout** (bottom-to-top visual stack) to show all tools at a glance while allowing focus on a single tool without modal navigation.

**States and Interactions**

**Default Stacked View**

* **Layout**: "My Wallet" header with kebab menu at top; reverse-stacked card deck directly below.

* **Visual**: The bottom card in the stack is closest to the header and most visible. Cards above are offset so only their top edge is visible, showing:

  * Card name/title.

  * Small icon or logo.

  * Background color or image hint for recognition.

* **Behavior**: Tap any visible card top to bring it into focus.

* **Stack size**: Dynamic. If many cards exist, only part of the stack is visible; enough edges show that users understand "there are more cards."

**Focused Card View**

When a user taps a card in the default stacked view:

* The tapped card animates up to a fully visible, centered position just under the "My Wallet" header (still in the upper portion of the screen).

* All other cards slide down together into a **collapsed stack at the bottom of the screen**, where only the top edge is visible (rest hidden off-screen).

* The collapsed bottom stack remains **tappable**: users can tap the visible edge to slide it up, revealing several card tops, and tap a different card to bring it into focus.

**Focused card displays**:

* Title.

* Short description / tagline.

* **Origin badge**: Visual indicator ("Library," "Community," or "My tool") showing card source and editability status.

* Category tag (e.g., "Grounding," "Journaling," "Self-Compassion").

* Quick stats: Total uses, current streak, last used date.

* Badges earned with this tool (small icon row; tap to see detail).

* Primary action button(s) (e.g., "Start," "Log Mood," "View Entry," "Done").

**Expanded Card (In-Place)**

* User taps the focused card or an "Expand" button to grow the card vertically.

* Card expands **downward** but does **not** become a modal or navigate to a new screen.

* Expanded card content includes:

  * Full tool instructions or prompts.

  * Input fields (mood slider, text entry, journaling template, etc.).

  * Any sub-actions specific to the tool type.

  * A "Save" or "Complete" action that logs the activity.

* The collapsed bottom stack **remains visible and clickable** at the bottom, allowing users to switch tools mid-activity.

* User can collapse the card by swiping down or tapping a collapse button, returning to the focused card view.

**Reorder Mode**

* Long-press any card in either the default stacked view or focused view to enter reorder mode.

* Visual feedback: Cards show a clearer list layout with drag handles, or a slight highlight to show they are movable.

* User drags a card up/down to reorder.

* On drop or "Done," the stack rebuilds in the new order.

* Reorder mode exit: Tap "Done" or tap outside the reordering area.

**Archive & Restore**

* From the focused card, or from the kebab menu:

  * Option to "Archive card." Archived cards are hidden from the main wallet.

  * Tap "Archive" from the kebab menu to view all archived cards.

  * In the archive view, user can tap "Restore to wallet" to bring a card back (it returns to its previous position or to the top of the stack).

**Card Layout Standard (Always Visible)**

Every card, at minimum, displays:

* **Title**: Name of the tool (e.g., "5-4-3-2-1 Grounding").

* **Icon/Logo**: Small visual identifier (can be emoji, simple icon, or user-uploaded).

* **Category**: Visual tag (e.g., color coding: blue for "Grounding," orange for "Journaling").

* **Background**: Color or subtle image (helps recognition in stack).

* **Description**: One-sentence overview or purpose (visible in focused and expanded states).

**Core Card Model Requirements**

All tools share a **common card shell** with four mandatory fields:

* **Title** (required): Name of the tool.

* **Description** (required): Short explanation of what the tool does and when to use it.

* **Icon** (required): Visual identifier (can be from icon library, emoji, or user-uploaded image).

* **Background** (required): Color theme or image (user-selectable via color picker or preset palettes).

These four properties are consistent across:

* Curated library cards

* Template-based cards (affirmation, instruction, mini-form, journaling, mood)

* Link Tools

* Custom tools built from controls

Every card must also include **at least one primary action** (e.g., "Start," "Complete," "Open link," "Save entry") to ensure users always have a clear next step for engagement.

---

**4.2 Card Types & Template System**

Users can add or create cards from templates. Each template defines:

* The data structure (what inputs/fields the card captures).

* How data is logged and displayed.

* What analytics are possible (e.g., mood tracking, frequency).

**MVP Card Types**

**Type 1: Affirmation / Reminder Card**

* **Purpose**: Display a text reminder, affirmation, or mantra.

* **Structure**:

  * Title, Description, Icon, Background (mandatory shell).

  * Main text (the affirmation or reminder, e.g., "You are capable of handling this").

  * Optional background image (user-uploaded or link).

  * Optional author/source attribution.

* **Interaction**: User opens the card, reads it, taps "Mark as done" or "Remind me later." Or just views and closes.

* **Data logged**: Completion (viewed, time), optional mood before/after.

* **Analytics**: Uses count, streak.

* **Primary action**: "Mark as done" button (always present).

**Type 2: Simple Instruction Card (Grounding / Breathing)**

* **Purpose**: Step-by-step instruction for a technique (e.g., "5-4-3-2-1 grounding," "Box breathing").

* **Structure**:

  * Title, Description, Icon, Background (mandatory shell).

  * Numbered steps or labeled sections (e.g., "Step 1: Name 5 things you see").

  * Optional timer for breathing exercises (embedded countdown if applicable).

  * Optional text field for reflection (e.g., "How do you feel now?").

* **Interaction**: User follows steps, optionally logs a quick note, marks as completed.

* **Data logged**: Completion, optional text note, optional mood before/after (mood input on completion).

* **Analytics**: Uses count, streak, mood improvement correlation.

* **Primary action**: "Complete" or "Done" button (always present).

**Type 3: Mini-Form / Check-In Card**

* **Purpose**: Quick structured input (mood check, brief journal prompt).

* **Structure**:

  * Title, Description, Icon, Background (mandatory shell).

  * 1–3 form fields (e.g., mood slider, short text input, multiple-choice buttons).

  * Example: "Daily Check-In" with fields:

    * Mood slider (1–10).

    * Prompt: "What's on your mind?" (text area).

    * Prompt: "What do you need right now?" (text area or template options).

* **Interaction**: Fill out fields, tap "Save entry."

* **Data logged**: All field values, timestamp.

* **Analytics**: Trends in mood, text analysis (future), streak.

* **Primary action**: "Save entry" button (always present).

**Type 4: Journaling / Reflection Card**

* **Purpose**: Longer-form writing with optional prompts.

* **Structure**:

  * Title, Description, Icon, Background (mandatory shell).

  * Prompt or theme (e.g., "Today's win," "What's worrying you?").

  * Large text input area.

  * Word count display (optional).

* **Interaction**: Write freely or prompted, tap "Save."

* **Data logged**: Full text, timestamp, optional mood tag.

* **Analytics**: Uses count, optional sentiment analysis (future), mood correlation.

* **Primary action**: "Save" button (always present).

**Type 5: Mood Tracker Card**

* **Purpose**: Standalone mood logging with optional context.

* **Structure**:

  * Title, Description, Icon, Background (mandatory shell).

  * Mood input: slider (1–10) or emoji picker.

  * Optional fields: "What triggered this?" (text), "What helped?" (text).

* **Interaction**: Log mood, optionally add context, save.

* **Data logged**: Mood value, context text, timestamp.

* **Analytics**: Mood trends over time, correlation with tool usage, mood improvement by tool.

* **Primary action**: "Log mood" or "Save" button (always present).

**Post-MVP Card Types (Roadmap)**

* **Expandable activity card**: "Move for 5 minutes" with integration to record the type of activity.

* **Progress tracker card**: Track a habit or goal over days/weeks with visual progress bar.

* **Therapy resource card**: Link to external resources (e.g., article, video, therapist profile).

* **Community shared card**: A card created and shared by another user.

---

**4.2.1 External App / Link Tools (MVP)**

**Purpose**

Allow users to add tools that act as **launchers** for existing apps or online resources they already use (e.g., meditation apps, YouTube videos, blogs, Notion journal pages), so the wallet becomes a hub rather than a replacement.

**Tool Behavior**

* **Link Tool card** behaves like any other card in the wallet:

  * Appears in the stacked UI with title, icon, category, and background.

  * Can be focused, expanded, reordered, archived, and restored.

  * Tracks uses, streaks, and optional mood logging like other cards.

* When activated (primary action in focused/expanded state), the card **opens a target**:

  * External mobile app via deep link / app URL scheme (e.g., calm://, notion://).

  * Web URL in the system browser (e.g., https://…).

* If the deep link fails (app not installed or unsupported):

  * The app attempts to open a provided web URL fallback, if present.

  * If no fallback, the app shows a friendly error and suggests the user edit the card.

**User Flow: Create a Link Tool**

1. User taps **"Add tool" → "Create new tool" → selects "Link Tool"**.

2. Configuration fields:

   * Title (required).

   * Description / "When to use this" (required).

   * Icon (choose from library or upload).

   * Background color (full color picker).

   * Category (e.g., Grounding, Journaling, Self-Compassion, etc.).

   * **Link type**:

     * "Open app / deep link" (e.g., calm://session?id=123).

     * "Open website" (e.g., https://example.com/article).

   * **Target URL** (required):

     * For apps: user pastes the deep link / app URL they obtained from a share function or documentation.

     * For websites: standard https:// URL.

   * Optional toggle: "Ask for mood after opening" (on/off).

3. Save behavior:

   * Card is added to the user's wallet with "My tool" origin badge.

   * On tap (focused or expanded), primary action triggers the link and logs a use.

**Technical Requirements (High Level)**

* Support opening:

  * https:// URLs in the default browser.

  * Custom URI schemes / deep links on iOS and Android using native APIs.

* Basic validation:

  * Ensure link starts with allowed schemes (e.g., https://, http://, or non-empty custom scheme including ://).

  * Reject obviously malformed strings at creation time with inline error.

* Error handling:

  * If OS has no handler for the deep link, show a non-technical message (e.g., "Couldn't open this app. It may not be installed. You can edit this tool to change the link.").

* Logging:

  * Internal logging of success/failure rates for deep links to inform UX improvements later.

---

**4.2.2 Generic Control System for Custom Tools (MVP)**

**Purpose**

Provide a **generic control system** so users can compose their own tools by combining reusable input and display elements, instead of being limited to rigid predefined tool types.

Each custom card is a small structured experience built from these controls.

**Control Definition**

A **control** is a configurable UI element with:

* Type (e.g., Static text, Text input, Mood slider).

* Label/prompt.

* Optional helper text / placeholder.

* Optional validation or constraints (e.g., max length, range).

Controls are arranged in an ordered list inside a card. Users can **drag-and-drop to reorder controls** within the editor using visible drag handles.

**MVP Control Types**

1. **Static text block**

   * Purpose: Instructions, psychoeducation, lists of steps.

   * Config:

     * Optional title.

     * Rich-text body (basic formatting: bold, italics, bullet/numbered list).

     * **Font size option: Small, Medium, Large** (Medium default).

   * Behavior: Read-only; completion of the card may still log a use, but the block itself stores no input.

2. **Single-line text input**

   * Purpose: Short responses (e.g., "One word for how you feel").

   * Config:

     * Label (prompt).

     * Placeholder.

     * Optional max length.

   * Data stored: Short string per completion.

3. **Multi-line text area**

   * Purpose: Journaling and longer reflections.

   * Config:

     * Label (prompt).

     * Placeholder / example question.

   * Data stored: Longer free-text entry.

4. **Mood slider**

   * Purpose: Numeric mood capture.

   * Config:

     * Label (e.g., "Mood right now").

     * Fixed range 1–10 (MVP).

     * Optional endpoint labels or emojis.

   * Data stored: Integer 1–10, integrated into mood analytics.

5. **Choice buttons (single select)**

   * Purpose: Quick categorical options (e.g., "Which emotion best fits?", "What do you need?").

   * Config:

     * Label.

     * List of options (text \+ optional icon).

   * Data stored: Selected option value.

6. **Checkbox / toggle**

   * Purpose: Simple yes/no or completion markers (e.g., "Completed exercise", "Reached out to someone").

   * Config:

     * Label.

   * Data stored: Boolean (true/false).

7. **Counter / numeric input**

   * Purpose: Count repetitions or units (e.g., "Number of breaths", "Number of items listed").

   * Config:

     * Label.

     * Optional min/max.

   * Data stored: Integer.

8. **Date/time (auto stamp)**

   * Purpose: Record when the tool was used.

   * Config:

     * Display mode: visible to user or hidden system field.

   * Data stored: Timestamp.

9. **Image attachment**

   * Purpose: Visual-based tools (e.g., calming images, vision boards).

   * Config:

     * Label.

     * Source: **Upload from photo library or camera capture** (works on both iOS and Android).

   * Data stored: Reference to locally stored image (with future sync support).

10. **Link button (embedded)**

    * Purpose: Add "open external resource" as part of a larger tool (e.g., instructions \+ link to a video).

    * Config:

      * Label (e.g., "Open Calm session", "Open article").

      * Target URL (deep link or https:// URL; same rules as Link Tool).

    * Data stored: Log that the link was triggered in that completion.

**User Flow: Create a Custom Tool with Controls**

1. User taps **"Create new tool" → "Custom tool"**.

2. Step 1 – Basic card info:

   * **Title** (required).

   * **Description** (required): "What this tool does / When to use it".

   * **Icon**: Choose from built-in icon library (searchable grid) or upload a custom icon image.

   * **Background**: Select any color via interactive color picker (with preset gradients as quick options).

   * Category (e.g., Grounding, Journaling, Self-Compassion, etc.).

3. Step 2 – Add controls:

   * User sees an ordered list (initially empty or pre-seeded with a static text block).

   * Each control has a **visible drag handle** for reordering.

   * Taps "Add block" and chooses a control type:

     * Static text, single-line input, multi-line input, mood slider, choice buttons, checkbox, counter, image, link button.

   * For each block:

     * Edits label and other settings inline.

     * **Uses drag handle to reorder blocks** (updated position persists when saved).

     * Can delete or duplicate blocks.

   * **"Add block" button design**: Uses responsive pills or grid layout ensuring full button text is always visible and clearly interactive.

4. Step 3 – Preview:

   * Preview mode shows how the card will look/behave during use.

   * User can interact with controls in preview to validate flow.

5. Save:

   * Custom tool becomes a normal wallet card with "My tool" origin badge, using the shared completion and analytics system.

   * Card requires at least one actionable control or auto-includes "Mark as done" button if only static content.

**Data and Analytics**

* Each control instance maps to a **field definition** in the card schema (id, type, label, config).

* Each time the tool is completed, the app stores:

  * Card ID, timestamp.

  * Values for each input control.

  * Any mood slider value(s) for analytics.

* Analytics in MVP:

  * Usage count per custom tool.

  * Mood trend for tools containing mood sliders.

  * Basic distributions:

    * For choice fields: option usage counts.

    * For checkboxes: completion rate.

**Constraints (MVP)**

* Maximum number of controls per card (e.g., 8–10 blocks) to avoid overly complex tools.

* No conditional logic in MVP (no "show this block only if X is selected").

* No formulas between fields (no computed values).

* Editor must be mobile-friendly:

  * Clear drag handles for reorder.

  * Simple modal or inline configuration for control settings.

---

**4.3 Curated Library & Tool Discovery**

**MVP Library**

The MVP includes a **hand-curated library of 18–21 cards** across core coping categories, grouped by type:

**Grounding & Calming (5 cards)**

1. "5-4-3-2-1 Grounding" — Instruction card with reflection field.

2. "Box Breathing" — Instruction with embedded timer.

3. "4-7-8 Breathing" — Instruction card.

4. "Name It to Tame It" — Mini-form card with mood input.

5. "Progressive Muscle Relaxation" — Instruction card.

**Cognitive Reframing (4 cards)**

1. "Thought – Feeling – Action" — Mini-form CBT card (three fields).

2. "Alternative Thought" — Form card ("What am I thinking?" → "What might a friend say?").

3. "Identify Thinking Traps" — Instruction \+ optional note card.

4. "Decatastrophizing" — Instruction card with reflection field.

**Body & Sensory (3 cards)**

1. "Body Scan in 3 Minutes" — Instruction card.

2. "Move for 5 Minutes" — Instruction card with optional activity note.

3. "Sensory Reset" — Instruction card.

**Daily Check-In & Journaling (4 cards)**

1. "Daily Mood Check-In" — Mini-form card (mood slider \+ 1–2 prompts).

2. "Worry Dump" — Journaling card (stream-of-consciousness).

3. "Win of the Day" — Journaling card (short reflection).

4. "Evening Gratitude" — Mini-form card (3 things, with optional prompts).

**Self-Compassion & Reminders (5 cards)**

1. "Self-Compassion Pause" — Instruction card.

2. "Affirmation: Strength" — Affirmation card (preset \+ customizable).

3. "Affirmation: Worth" — Affirmation card.

4. "You Are Not Alone" — Reminder card with supportive text.

5. "Future Self Letter" — Journaling card (summary \+ reminder to re-read).

**Lightweight Connection (1 card)**

1. "Reach Out" — Mini-form checklist ("Send a message," "Call," "Plan time").

**Library Discovery & Browsing**

* User taps the "+" button or "Add tool" action from the wallet screen.

* A **library browser** opens showing:

  * Curated cards organized by category (tabs or collapsible sections).

  * For each card: title, icon, short description, category tag.

  * **Origin badge**: Each card shows "Library" or "Community" badge.

  * "Add to wallet" button for each card.

* Users can:

  * Browse by category.

  * Search by keyword (MVP: optional; nice-to-have in initial release).

  * See community-created tools if moderator-approved.

**Permissions & Editability**

**Origin badges** visually distinguish card type and control editability:

* **"Library"** badge: Built-in curated tools (read-only, not editable).

* **"Community"** badge: Tools approved from community submissions (read-only, not editable).

* **"My tool"** badge: Tools created by the user (fully editable).

**Edit rules**:

* Users **can only edit** tools they created (marked "My tool").

* Curated library tools ("Library" badge) and community tools ("Community" badge) are **read-only**; users cannot directly edit them.

* To customize a non-owned tool:

  * User taps **"Duplicate tool"** from the card's kebab menu.

  * The duplicate becomes a **new private custom tool** owned by that user, marked "My tool," and is fully editable.

  * Original tool remains in the library unchanged.

**User-Submitted Tools**

* Users can create their own cards using the same templates and custom-tool builder.

* Cards default to **private** (only the user can see them), marked "My tool."

* If a user wants to share:

  * Tap "Submit to public library" from the card menu.

  * Required metadata: title, description, category, "When to use," tool type.

  * Submission goes into a **moderation queue** (visible in your curator admin panel).

* **Your curator review process**:

  * Check for safety, clarity, originality, and alignment with mental health best practices.

  * Optionally lightly edit title/description for clarity.

  * Approve → tool becomes visible in the library with a "Community" badge.

  * Reject with feedback (optional).

---

**4.4 Tool Management & Focused Card Menu**

**Kebab Menu Actions (Focused or Expanded Card)**

When a user is viewing a focused or expanded card, the kebab menu (three-dot icon) provides:

**For "My tool" cards (user-created)**:

* **Edit**: Open the tool editor to modify controls, metadata, icon, or background.

* **Duplicate tool**: Create an identical copy with a new name (e.g., "\[Original Name\] \- Copy"). The duplicate is immediately marked "My tool" and is fully editable.

* **View usage history**: Open a history view showing all completions of this tool:

  * List of entries with timestamps.

  * Key field snippets (e.g., journal text preview, mood values, choice selections).

  * Ability to tap an entry to view full details.

  * Ability to delete individual entries.

* **View insights**: Open a per-tool insights panel showing:

  * Mini charts: uses over the last 7/30 days (bar or line chart).

  * Current streak, total uses, last used date.

  * Average mood after use (if mood logging enabled on this tool).

  * Mood trend specific to this tool (improving, stable, declining).

  * Tools correlation: if the tool contains mood input, show "Mood change: \+1.5 avg."

* **Set reminder**: Configure per-card reminder schedule (daily, 3x/week, custom time, etc.).

* **Archive card**: Hide card from wallet; data and stats are preserved.

* **Submit to library**: For high-quality personal tools, submit to community review.

**For "Library" and "Community" cards (read-only)**:

* **Duplicate tool**: Create an editable copy in user's wallet as "My tool."

* **View usage history**: Show when the user has used THIS copy (not the original library tool).

* **View insights**: Show insights for THIS user's usage of the tool.

* **Set reminder**: Configure per-card reminder.

* **Archive card**: Remove from active wallet (still accessible in archive).

**For all cards**:

* **View details**: Read-only view of full tool description, category, instructions (if applicable).

---

**4.5 Reminders, Habits & Gamification**

**Reminders**

* User can set reminders for individual cards or create a global reminder schedule.

* Reminder options:

  * **Per-card reminders**: From the focused card menu, tap "Set reminder" → choose time(s) and frequency (daily, 3x/week, etc.).

  * **Global reminder**: From the main kebab menu, set a "Daily wellness check-in" that picks a random tool or suggests the least-used card.

* When a reminder triggers:

  * Push notification with the card name and a motivating message.

  * User taps notification → app opens directly to the focused card view.

**Habit Tracking & Streaks**

* Each card tracks:

  * **Total uses**: Cumulative count of times tool was completed.

  * **Current streak**: Consecutive days the tool was used (resets if a day is missed).

  * **Last used**: Date and time of most recent use.

* Streaks are displayed on the focused card and in stats.

**Badges & Achievements**

* Users earn badges for:

  * **Streak badges**: "7-Day Streak," "30-Day Streak" (per card or global).

  * **Variety badges**: "Tried 5 Different Tools," "Completed Every Category."

  * **Consistency badges**: "10 Uses of \[Tool Name\]," "100 Total Uses."

  * **Community badges** (future): "First Shared Tool," "Tool Approved by Curator."

* Badges display as small icons on the focused card and in a user profile/achievements page.

* User can **share badge milestones** to social media:

  * Tap a badge → "Share this achievement" → generates a pre-filled social post (e.g., "🏆 I just earned a 7-day streak with my grounding tools\! \#MentalHealthWallet").

---

**4.6 Analytics & Mood Insights**

**Usage Analytics**

* **Card-level stats** (visible on focused card):

  * Total uses, current streak, last used.

  * A mini-chart showing uses over the last 7 days (simple bar or line).

* **Wallet-level dashboard** (separate screen or dedicated section):

  * Total tools in wallet.

  * Total uses this week.

  * Most-used tools (top 3).

  * Tools not used in the last 14 days (suggestion to archive or revisit).

**Mood Tracking & Correlation**

* When a user completes a card, optionally log mood:

  * Simple slider (1–10, with emoji anchors: 😞 to 😊).

  * Appears at the end of tool completion or as a dedicated prompt ("How are you feeling now?").

* **Mood history**:

  * Basic chart showing mood over the last 7, 30 days.

  * Simple trend indicator (mood improving, stable, declining).

* **Tool effectiveness**:

  * For cards with mood logging, show:

    * "Average mood after using \[Tool Name\]: 6.5/10."

    * "Tools that improved your mood the most this week" (ranked list).

  * This highlights which tools are most effective *for this user*.

  * Example chart: "Mood change by tool" (bar chart showing \+1.2, \+0.8, \-0.3, etc.).

**Insights & Recommendations**

* **Simple insights** (MVP):

  * "You've used 5 tools this week—keep it up\!"

  * "Box Breathing has improved your mood by an average of \+1.5 points."

  * "You haven't used \[Tool\] in 10 days. Want to revisit it?"

* **Future insights** (Post-MVP):

  * AI-powered pattern detection (e.g., "Mood dips on Wednesday afternoons; try Breathing Exercise then").

  * Seasonal or contextual insights (e.g., "You're more likely to practice grounding after work stress").

---

**4.7 Archive & Tool Management**

* **Archive action**: From the focused card or card menu, tap "Archive card."

  * Card is hidden from the main wallet.

  * Card's data and stats are preserved.

* **Archive view**: Tap "Archive" from the main kebab menu.

  * Shows all archived cards with their last-used date.

  * "Restore to wallet" button to bring a card back (returns to its previous position or to the top).

  * "Delete" option (with confirmation) to permanently remove a card and its data.

---

**5\. Non-Functional Requirements & Safety**

**Data & Privacy**

* **Local storage**: User data (cards, entries, mood logs) is stored locally on the device by default (MVP).

* **Cloud sync** (Post-MVP): Optional cloud backup with encryption in transit and at rest.

* **Data export**: Users can export all their data (cards, entries, stats) as JSON or CSV for portability.

* **Data deletion**: Clear, one-step option to delete all personal data and reset the app.

**Security & Consent**

* **App lock** (optional): Face ID or PIN to lock the app, protecting sensitive entries.

* **Privacy policy**: Clear, simple policy stating:

  * What data is collected (usage, mood, optional location for reminders).

  * How data is used (local analytics, optional aggregated community insights post-MVP).

  * User rights (export, delete, opt-out).

**Mental Health Safeguards**

* **Disclaimer**: Clear in-app message:

  * "Mental Health Wallet is not a replacement for therapy or professional mental health care."

  * "If you are in crisis, please contact \[local hotline\] or call 988 (US Suicide & Crisis Lifeline)."

  * Visible on first load, in settings, and in any analytics view.

* **Crisis resource links**: From main menu, quick access to:

  * Local crisis hotline (geolocation-aware).

  * 988 Lifeline (US).

  * Links to therapist directories (post-MVP).

**Content Moderation**

* **Community submission review**:

  * All user-submitted cards go to your moderation queue before publication.

  * Reject criteria:

    * Claims of medical efficacy without evidence.

    * Harmful or triggering content (e.g., self-harm encouragement).

    * Duplicate or low-quality submissions.

  * Approve criteria:

    * Clear, well-written instructions.

    * Aligns with established mental health practices (coping, CBT, DBT, mindfulness, etc.).

    * Unique or adds value to an existing category.

* **Moderation tools** (for you):

  * Admin dashboard showing submission queue.

  * Approve / Reject with optional feedback.

  * Flag or hide community tools if reported by users (post-MVP).

---

**6\. Platform & Technical Constraints**

**Platforms (MVP)**

* **Primary**: iOS (SwiftUI) or React Native for cross-platform mobile.

* **Secondary**: Android (same codebase if React Native; native if resource-intensive).

* **Web** (Post-MVP): Optional responsive web version for viewing stats and managing archive.

**Tech Stack Considerations**

* **Local database**: SQLite or Realm for local card storage, entries, and mood logs.

* **Push notifications**: Firebase Cloud Messaging (Android) / APNs (iOS) for reminders.

* **Cloud backend** (Post-MVP): Simple REST API or GraphQL for:

  * Cloud sync.

  * Curator moderation dashboard.

  * Community card library distribution.

  * Aggregated anonymized analytics (optional).

**No Browser Storage**

* Mobile app uses native local storage (no localStorage, sessionStorage, or browser APIs).

---

**7\. Monetization (Post-MVP Strategy)**

**MVP: Free with Potential Future Paths**

For the MVP, the app is **free to download and use**. Monetization paths under consideration:

1. **Creator Revenue Sharing** (future):

   * If a user-submitted card gets significant adoption, you can offer the creator a revenue share (e.g., "$ if 1000+ people use your tool").

   * Users who purchase cards (micropayment or subscription) support creators.

2. **Premium Features** (future):

   * Advanced analytics (mood prediction, deeper correlations).

   * Custom card templates.

   * Cloud backup and sync.

   * Ad-free experience.

3. **B2B Therapist Tools** (future):

   * Therapist dashboard for assigning tools to clients and viewing anonymized engagement.

   * Licensing fee or revenue share.

For MVP, focus on user retention, engagement, and data-driven iteration. Monetization can be introduced once product-market fit is clear.

---

**8\. Metrics & Success Criteria (MVP)**

**User Engagement Metrics**

* **Activation**: Users who add ≥3 cards to wallet in first session.

* **Retention**: % of users returning 7-day, 30-day (targets: \>40% D7, \>20% D30 for MVP).

* **Habit formation**: % of users with ≥1 tool showing a 7-day streak.

* **Tool discovery**: Average \# of unique tools used per user (target: 5+ by day 30).

**Submission & Curation Metrics**

* **Submission volume**: \# of user-created cards submitted per week.

* **Approval rate**: % of submissions you approve (target: maintain \>70% for quality).

* **Submission categories**: Which tool types are users creating most? Use this to inform future curated tools.

**Mood & Effectiveness Metrics**

* **Mood logging participation**: % of completions that include mood input (target: \>50%).

* **Mood correlation**: Tools showing strongest mood improvement correlation.

* **Insights engagement**: % of users who view mood analytics (target: \>30%).

**Curator Learnings**

* Volume and types of tools submitted (informs automation and delegation timelines).

* Common user requests or gaps in the library.

* Feedback patterns on what drives tool adoption.

---

**9\. MVP Scope Definition**

**In Scope (V1.0)**

* Wallet UI with stacked card interaction and reorder.

* Predefined card types (affirmation, instruction, mini-form, journaling, mood).

* Link Tools: launchers to external apps and websites.

* Generic Control System: user-composed custom tools from 10 control types.

* Curated library of 18–21 hand-selected cards.

* User-submitted cards (Link Tools and Custom Tools) with moderation queue.

* Origin badges ("Library," "Community," "My tool") to distinguish tool source and editability.

* Edit tool editor with drag-and-drop control reordering.

* Icon picker (library \+ upload) and color picker (any color) for custom tools.

* Per-card kebab menu with Edit, Duplicate, Usage History, Insights, and Reminder options.

* Reminders (per-card or global) with push notifications.

* Habit tracking (uses, streaks) and basic badges (5–7 core badges).

* Mood logging and simple mood trend analytics.

* Tool effectiveness correlation (basic: average mood after tool use).

* Archive and restore.

* Kebab menu with basic settings, archive access, crisis resources.

**Out of Scope for V1 (Post-MVP Roadmap)**

* Cloud sync and backup.

* Advanced AI analytics (mood prediction, NLP sentiment analysis).

* AI image generation for custom card backgrounds.

* Web/desktop version.

* Therapist companion tools and client assignment.

* Marketplace and creator revenue sharing.

* Social integrations (sign-in, cross-posting).

* Wearable or sensor integrations (heart rate, sleep data).

* Accessibility features beyond baseline WCAG 2.1 AA (expand post-launch).

---

**10\. User Journeys**

**Journey 1: New User Discovers and Uses First Tool (Curated Library)**

1. **Onboarding**: App opens with brief welcome screen (optional tutorial or skip).

2. **Library browse**: User taps "Add tool" and sees the curated library organized by category.

3. **Tool selection**: User browses "Grounding & Calming" and sees "5-4-3-2-1 Grounding" with "Library" badge.

4. **Add to wallet**: Taps "Add to wallet" — tool appears in the wallet.

5. **First use**: Returns to wallet, taps the newly added card, sees it in focus (still shows "Library" badge, indicating read-only).

6. **Tool interaction**: User follows the 5-4-3-2-1 steps, taps "Completed," optionally logs mood (e.g., 5 → 7).

7. **Encouragement**: Badge unlocked (e.g., "First Tool Used"). User sees streak count (1 day).

**Journey 2: User Duplicates and Customizes a Library Tool**

1. **Inspiration**: User loves the "5-4-3-2-1 Grounding" card but wants to add their own reminder text.

2. **Duplicate**: From the focused card kebab menu, taps "Duplicate tool."

3. **Create custom**: A copy is created and marked "My tool," named "5-4-3-2-1 Grounding \- Copy."

4. **Edit**: User taps "Edit" (now available since the tool is "My tool").

5. **Customize**: Changes the description, adds a custom static text block with a personal reminder, updates icon color.

6. **Save**: Custom tool is saved and added to wallet.

7. **Use**: User can now tap the custom tool and enjoys their personalization.

**Journey 3: User Creates and Submits a Link Tool**

1. **Inspiration**: User already uses Calm for meditation but wants a wallet shortcut to it.

2. **Create Link Tool**: From "+" menu, selects "Create new tool" → "Link Tool".

3. **Configure**:

   * Title: "Calm Session"

   * Description: "Quick guided meditation from Calm app"

   * Icon: Searches icon library, finds meditation icon

   * Background: Uses color picker to select a calming blue

   * Category: "Grounding & Calming"

   * Link type: "Open app"

   * Pastes the deep link: calm://

   * Toggles "Ask for mood after opening" ON

4. **Save**: Card added to wallet with "My tool" badge.

5. **Use**: User taps the card → app opens Calm. Returns to Mental Health Wallet, optionally logs mood.

6. **Submit**: User can submit to library (if they created a particularly curated version with good metadata).

**Journey 4: User Creates and Submits a Custom Tool**

1. **Inspiration**: User wants to save a personal grounding technique learned from a therapist.

2. **Create Custom Tool**: From "+" menu, selects "Create new tool" → "Custom tool".

3. **Basic info**:

   * Title: "My 3-Step Grounding"

   * Description: "A personalized grounding exercise I learned in therapy"

   * Icon: Uploads a custom image from phone

   * Background: Uses color picker to select a personal theme color

   * Category: "Grounding & Calming"

4. **Add controls**:

   * Adds static text block (Medium font): "Step 1: Notice your surroundings"

   * Adds static text block (Medium font): "Step 2: Name 3 things you can see"

   * Adds text input: "What do you see?" (user types response)

   * Adds mood slider: "How are you feeling?" (1–10)

   * Uses drag handles to reorder controls to desired flow

5. **Preview**: Tests the flow, sees all controls render correctly.

6. **Save**: Custom tool is added to wallet as private card marked "My tool."

7. **Use**: Tap card, fill out controls, save entry. Usage history and insights are tracked.

8. **Edit**: User can tap "Edit" from kebab menu, modify controls (using drag-drop to reorder), and save changes.

9. **Submit**: If tool feels general enough, user can submit to community library with metadata (title, category, tags, "when to use").

10. **Curation**: You review, approve, and the tool goes live with a "Community" badge.

**Journey 5: User Practices Habits and Analyzes Mood**

1. **Routine**: Over two weeks, user practices 3 grounding tools daily (reminder at 8 AM).

2. **Logging**: After each tool use, user optionally logs mood.

3. **Insights**: User opens "View insights" from a tool's kebab menu and sees:

   * "You've used this tool 14 times this week."

   * Mini chart showing uses over last 7 days.

   * "Mood change: \+1.5 average (mood improved after using this tool)."

   * Current streak: 12 days.

4. **Wallet insights**: User views the analytics dashboard and sees:

   * "You've used tools 42 times this week."

   * "Box Breathing improved your mood by \+2 points on average."

   * "7-Day Streak: Keep it up\!"

5. **Optimization**: Based on insights, user archives less-effective tools and focuses on the ones working.

6. **Social share**: User earns a "14-Day Streak" badge and shares it to Instagram with a motivational message.

**Journey 6: User Views Tool Usage History**

1. **Curiosity**: User wants to review their journal entries from a "Worry Dump" card over the past month.

2. **History access**: From the focused card kebab menu, taps "View usage history."

3. **History view**: Sees a chronological list of all completions:

   * Each entry shows timestamp, key field snippets (e.g., "Jan 15, 2:30 PM: 'Worried about presentation...'").

4. **Entry detail**: Taps an entry to view full text of that journal entry.

5. **Deletion**: User can tap a delete button to remove a specific entry.

6. **Insights**: User reflects on patterns in their worries.

**Journey 7: Therapist Uses App with Client (Post-MVP)**

(Demonstrates secondary use case with custom tools and controls)

1. **Therapist onboarding**: Therapist creates account and enables "Professional mode."

2. **Tool creation**: Therapist uses the Custom Tool builder to create a "Thought Records" card with controls:

   * Static text: "Use this to explore your thoughts and feelings"

   * Text input: "What situation triggered this?"

   * Text area: "What thoughts came up?"

   * Choice buttons: "What emotion are you feeling?" (options: sad, angry, anxious, etc.)

   * Mood slider: "Rate your mood now (1–10)"

3. **Client invitation**: Therapist sends invite link to client (e.g., via email or QR code).

4. **Client usage**: Client sees the assigned tool prominently in their wallet and uses it between sessions.

5. **Entry logging**: Each time client completes the tool, entries are stored locally with all field values.

6. **Engagement view**: Therapist can see (with client's opt-in) that the client completed 5 thought records this week.

7. **Session integration**: Therapist and client review the entries together during the session.

---

**11\. Roadmap (18+ Months)**

**Phase 1 (Months 1–4): MVP Launch**

* Wallet UI, card types, curated library.

* Reminders, habit tracking, basic badges.

* Mood logging and correlation analytics.

* User submissions and moderation.

* Origin badges, edit tool editor, icon/color pickers.

* iOS launch (beta with 500–1000 early users, likely your network or self-help community).

**Phase 2 (Months 5–8): Polish & Community Growth**

* Android release.

* Expand curated library to 40–50 cards based on user data.

* Introduce 2–3 new card types based on submission patterns.

* Advanced badge system (rarer, more meaningful).

* Simple social sharing of milestones and badges.

* Community tools curation refinement (identify top creators, gather quality feedback).

**Phase 3 (Months 9–12): Insights & Analytics**

* Deeper mood analytics (trend lines, seasonal patterns).

* Mood prediction (experimental; "You often feel lower on Mondays—try grounding today").

* NLP sentiment analysis on journaling entries (optional).

* Advanced user segmentation (identify which user types benefit most from which tools).

* Cloud sync (optional, with strong privacy messaging).

**Phase 4 (Months 13–18): Monetization & Creator Economy**

* Therapist companion tools and client assignment (if secondary market shows traction).

* Creator revenue sharing for high-performing community tools.

* Marketplace for curated tool bundles (e.g., "Morning Routine," "Anxiety Management Kit").

* Premium subscription (advanced analytics, cloud sync, ad-free) at $4.99–9.99/month.

* B2B licensing for mental health organizations or workplace wellness programs.

**Phase 5+ (18+ Months): Scale & Integration**

* Web and desktop apps.

* Wearable integration (Apple Watch, Google Fit).

* Integration with meditation apps, therapy platforms, or EHR systems (if therapist adoption grows).

* Research partnerships (anonymized data for mental health research, with strong consent).

---

**12\. Open Questions & Assumptions**

**Product Assumptions**

1. **Card fatigue**: Assumption that users can manage 20–50 tools without overwhelm. *Validation needed*: Can we show that users actually curate their wallet and don't just accumulate?

2. **Mood correlation signal**: Assumption that a simple post-tool mood log provides meaningful correlation. *Validation needed*: Do users see mood changes correlated to specific tools, or are trends too noisy?

3. **Reminders adoption**: Assumption that reminder-driven daily habits are key to retention. *Validation needed*: Do reminder opt-in rates and completion rates support this?

4. **Community curation**: Assumption that user-submitted tools will be high-quality and on-brand. *Validation needed*: What % of submissions are genuinely useful vs. low-effort duplicates?

5. **Customization incentive**: Assumption that the ability to duplicate and edit library tools drives deeper engagement. *Validation needed*: Do users who customize tools show higher retention?

**Business Assumptions**

1. **Secondary therapist market**: Assumption that therapists will want this as a client companion tool. *Validation needed*: Run interviews with 5–10 therapists before building B2B features.

2. **Monetization timing**: Assumption that paid features (premium subscription, creator share) won't harm early adoption. *Validation needed*: Monitor D7/D30 retention if monetization is introduced in Phase 2+.

**Technical Assumptions**

1. **Local-first approach**: Assumption that local storage is sufficient for MVP and that users don't expect automatic cloud backup day-1. *Decision*: Confirm cloud sync is a Phase 3 feature, not blocking MVP.

2. **Push notification delivery**: Assumption that Firebase or native push is reliable enough for habit reminders. *Validation needed*: Monitor delivery rates and user opt-in behavior.

---

**13\. Acceptance Criteria for MVP Launch**

**User-Facing Features**

* \[ \] Wallet UI renders stacked cards correctly on iOS (and Android if simultaneous release).

* \[ \] Tap to focus / unfocus card works smoothly without lag.

* \[ \] Expand card view shows full tool content and remains interactive for bottom stack switching.

* \[ \] Reorder mode works (long-press, drag, drop, new order persists).

* \[ \] All 5 MVP card types render and log data correctly.

* \[ \] Curated library of 18–21 cards loads and displays correctly.

* \[ \] Origin badges ("Library," "Community," "My tool") display correctly and reflect editability.

* \[ \] Users can create custom cards with controls and submit to moderation queue.

* \[ \] Drag-and-drop reordering of controls in tool editor works smoothly.

* \[ \] Icon picker (library \+ upload) works; icons display correctly on cards.

* \[ \] Color picker allows selection of any color; background theme updates correctly.

* \[ \] Duplicate tool function creates editable copy marked "My tool."

* \[ \] Edit menu shows only for "My tool" cards; read-only cards show "Duplicate" only.

* \[ \] Kebab menu displays: Edit (my tools only), Duplicate, Usage History, Insights, Set Reminder, Archive.

* \[ \] Usage history view shows chronological list with timestamps and field snippets.

* \[ \] Insights view shows usage stats, mood correlation, streaks, and mini-charts per tool.

* \[ \] Reminders trigger on time and deliver push notifications.

* \[ \] Habit stats (uses, streak, last used) update in real time.

* \[ \] 5–7 core badges unlock and display correctly.

* \[ \] Mood logging appears on card completion and stores data.

* \[ \] Basic mood analytics (trend, avg mood per tool) display and update.

* \[ \] Archive and restore work without data loss.

**Curator Tools & Safety**

* \[ \] Admin dashboard shows submission queue with metadata.

* \[ \] Approve/Reject flow works with optional feedback.

* \[ \] Approved tools appear in library within 5 minutes with "Community" badge.

* \[ \] Crisis resource links are visible and functional.

* \[ \] Mental health disclaimer is shown on first load and in key screens.

**Non-Functional**

* \[ \] App handles 50+ cards without performance degradation.

* \[ \] Local database is encrypted and secure.

* \[ \] Push notification delivery rate \>90%.

* \[ \] No major crashes in closed beta (target: \<0.1% crash rate).

* \[ \] Privacy policy is clear and linked.

* \[ \] App complies with baseline WCAG 2.1 AA accessibility.

---

**14\. Success Metrics for MVP (3–6 Months Post-Launch)**

* **D7 retention**: \>40%.

* **D30 retention**: \>20%.

* **Users with 7-day streak**: \>25% of active users.

* **Mood logging participation**: \>50% of card completions.

* **User submissions received**: \>100 community card submissions.

* **Curator approval rate**: 65–75% (balance quality with community encouragement).

* **Custom tool creation rate**: \>30% of active users create at least one custom tool.

* **Duplication/customization rate**: \>20% of users duplicate and edit at least one library tool.

* **NPS**: Target \>40 (early-stage product benchmark).

* **Average tools per user**: 8–12 by day 30\.

---

**15\. Glossary**

| Term | Definition |
| :---- | :---- |
| **Card** | A discrete mental health tool or exercise (coping strategy, journal prompt, mood tracker, affirmation). |
| **Wallet** | The main app screen displaying the user's collection of cards in a stacked, interactive layout. |
| **Focused card** | A card that is currently selected and displayed in full view on the wallet screen. |
| **Curated library** | Hand-selected tools created by you (and therapist partners) representing best-in-class coping strategies. |
| **Community card** | A tool submitted by a user and approved by you for public discovery. |
| **Streak** | Consecutive days a user has completed a specific tool (resets if a day is skipped). |
| **Badge** | A gamification reward earned for consistent practice, variety, or milestones. |
| **Mood logging** | Recording a user's self-reported mood (1–10) before and/or after using a tool. |
| **Analytics** | Data-driven insights into tool usage, mood trends, and tool effectiveness. |
| **Moderation** | Your review and approval process for user-submitted cards before they are published to the community library. |
| **Archive** | A hidden collection of cards the user has chosen not to actively use but may restore later. |
| **Origin badge** | A visual indicator on cards showing source ("Library," "Community," or "My tool") and determining editability. |
| **Control** | A configurable UI element in custom tools (e.g., text input, mood slider, static text block). |
| **Link Tool** | A card that acts as a launcher to external apps or websites. |
| **Custom tool** | A tool built by a user using the generic control system, composed of reusable input and display elements. |
| **My tool** | A tool created by the user; fully editable and marked with "My tool" badge. |

---

**Appendices**

**Appendix A: Card Template Examples**

**Example 1: Affirmation Card ("I Am Resilient")**

**Card Shell (Mandatory)**

* Title: I Am Resilient

* Icon: 💪 (from icon library)

* Background: Gradient purple-to-pink (via color picker)

* Description: "A reminder of your inner strength."

**Card Content**

* Main text:  
  "I have faced challenges before and I will face this one too.  
  I am stronger than I think."

* Source: \[Optional attribution to therapist or author\]

**Interaction**

* User opens the card, reads it, taps "Mark as done" or "Remind me later."

**Data Logged on Completion**

* Timestamp

* Optional mood (before/after)

* Optional note

**Stats Display**

* "12 uses | 5-day streak | Last used today"

**Origin Badge**

* If from library: "Library"

* If user-created: "My tool"

* If community-approved: "Community"

---

**Example 2: Instruction Card ("5-4-3-2-1 Grounding")**

**Card Shell (Mandatory)**

* Title: 5-4-3-2-1 Grounding

* Icon: 🌍 (from icon library)

* Background: Green

* Description: "Notice 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste."

**Card Content**

Instructions (Static text block, Medium font):

1. Name 5 things you can see right now

2. Name 4 things you can physically feel

3. Name 3 things you can hear

4. Name 2 things you can smell

5. Name 1 thing you can taste

After completing: Optional reflection field

* "How do you feel now? (optional)" (text input)

**Interaction**

* User follows steps, optionally logs a quick note, marks as completed by tapping "Complete" button.

**Data Logged**

* Timestamp

* Optional reflection text

* Optional mood (before/after)

**Stats Display**

* "23 uses | 7-day streak | Last used 2 hours ago"

---

**Example 3: Mini-Form Card ("Thought – Feeling – Action")**

**Card Shell (Mandatory)**

* Title: Thought – Feeling – Action

* Icon: 🧠 (from icon library)

* Background: Orange

* Description: "Explore the connection between what you think, how you feel, and what you do."

**Card Content**

Form fields (custom controls):

1. **Text input**: "What are you thinking right now?"

2. **Text input**: "What feeling does this thought bring up?"

3. **Text input**: "What action are you taking or wanting to take?"

4. **Text area** (optional): "Is there an alternative way to think about this?"

**Interaction**

* Fill out fields, tap "Save entry."

**Data Logged**

* All field values

* Timestamp

* Optional mood tag

**Stats Display**

* "8 uses | 3-day streak | Last used yesterday"

---

**Example 4: Custom Tool with Drag-Drop Reordering**

**Custom Tool: "My Anxiety Toolkit" (User-Created)**

**Card Shell**

* Title: My Anxiety Toolkit

* Icon: Custom uploaded image

* Background: User-selected calming blue via color picker

* Description: "My personal 5-minute anxiety reset routine"

* Origin: "My tool"

**Controls (Reorderable)**

1. **Static text block** (Small font): "Take a moment and focus on the next 5 minutes."

2. **Static text block** (Medium font): "Step 1: Deep breathing"

3. **Counter**: "Number of breaths I took: \_\_\_"

4. **Static text block** (Medium font): "Step 2: Name your 5 senses"

5. **Checkbox**: "Completed grounding exercise"

6. **Mood slider**: "How anxious am I feeling now?" (1–10)

7. **Text area**: "What helped today? (optional)"

**Controls arranged via drag handles** in editor; order updated per user preference.

**Interaction**

* User follows steps in defined order, completes all controls, taps "Save entry."

**Data Logged**

* All control values, timestamp, mood slider.

**Edit Flow**

* User taps "Edit" from kebab menu, reorders controls using drag handles, modifies text, saves.

---

**Appendix B: Curator Dashboard (Sketch)**

**CURATOR ADMIN PANEL**

**Screen: Submissions Queue**

Header: "Pending Submissions (12)"

**List of pending cards:**

\[ Card 1 \]  
Title: "Anxiety Release Meditation"  
Submitted by: @user\_jane (3 days ago)  
Type: Custom Tool  
Category: Grounding & Calming  
Preview: \[Shows tool structure with first 2–3 controls\]

Actions: \[ Approve \] \[ Request Changes \] \[ Reject \]  
Feedback field: \[optional text to send user\]

\[ Card 2 \]  
Title: "Daily Affirmation – I Choose Peace"  
Submitted by: @user\_bob (5 hours ago)  
Type: Link Tool  
Category: Self-Compassion  
Preview: \[Shows card preview\]

Actions: \[ Approve \] \[ Request Changes \] \[ Reject \]

\[... more cards ...\]

**Filters:** \[ Type \] \[ Category \] \[ Date Range \] \[ Status \]  
**Sort:** \[ Newest \] \[ Most Popular \] \[ Flagged \]

**Stats sidebar:**

* Submissions this week: 12

* Approval rate: 72%

* Top category: Cognitive Reframing (4 cards)

* Avg. approval time: 1.2 days

* Outstanding (over 5 days): 2 cards (flagged for follow-up)

---

**Appendix C: Analytics Dashboard (User View Sketch)**

**ANALYTICS SCREEN**

**Header:** "Your Wellness Insights"

**Section 1: This Week**

* "You've used tools 23 times" (up from 18 last week ⬆️)

* "3-day current streak with Box Breathing"

* "Mood average: 6.2/10 (up from 5.8 last week ⬆️)"

**Section 2: Tool Effectiveness (This Month)**

\[ Bar chart: Average mood change by tool \]

Box Breathing: \+2.1  
Grounding 5-4-3-2-1: \+1.8  
Journaling: \+1.2  
Affirmation: \+0.9

**Section 3: Mood Trend (Last 30 Days)**

\[ Line chart: Daily mood average \]

Simple trend indicator: "Your mood is trending upward 📈"

**Section 4: Usage by Tool (This Week)**

* Box Breathing: 7 uses (Last 3 days)

* Grounding: 5 uses (Last 5 days)

* Journaling: 4 uses (Last 2 days)

* Affirmation: 3 uses (Every day)

* Thought – Feeling – Action: 2 uses (Last 4 days)

**Section 5: Badges Earned This Month**

\[ Icons for earned badges \]

🏆 7-Day Streak  
🏆 10 Uses of Box Breathing  
🏆 Tried 5 Different Tools

\[ Share this achievement to social media button \]

---

**Appendix D: Per-Tool Insights Panel (Sketch)**

**INSIGHTS FOR: "Box Breathing"**

**Header:** Box Breathing | \[Close button\]

**Quick Stats**

* Total uses: 42

* Current streak: 7 days

* Last used: Today, 2:30 PM

* Category: Grounding & Calming

**Mood Impact (This Month)**

\[ Chart: Average mood before/after \]

Before: 5.2/10  
After: 7.3/10  
Improvement: \+2.1 points (your strongest tool\!)

**Usage Over Time (Last 7 Days)**

\[ Bar chart: Daily use count \]

Mon: 1  
Tue: 2  
Wed: 1  
Thu: 2  
Fri: 0 (streak reset)  
Sat: 1  
Sun: 2

**Insights**

* "You're most likely to use this tool in the afternoon."

* "You tend to use it more on Thursdays (3 uses)."

* "When you use this, your mood improves an average of \+2.1 points."

**Actions**

* \[ Edit \] \[ Duplicate \] \[ View History \] \[ Set Reminder \]

---

**Appendix E: Usage History View (Sketch)**

**USAGE HISTORY FOR: "Worry Dump"**

**Header:** Worry Dump | \[Close button\]

**List of completions (most recent first):**

\[ Entry 1 \]  
Timestamp: January 19, 2:30 PM  
Preview: "Worried about the presentation tomorrow and feeling under-prepared..."  
\[ View full entry \] \[ Delete entry \]

\[ Entry 2 \]  
Timestamp: January 18, 6:15 PM  
Preview: "Anxious about the deadline. Lots of tasks piling up..."  
\[ View full entry \] \[ Delete entry \]

\[ Entry 3 \]  
Timestamp: January 17, 4:00 PM  
Preview: "Had a conflict with a coworker today. Feeling stressed..."  
\[ View full entry \] \[ Delete entry \]

\[... more entries ...\]

**Stats at bottom:**

* Total entries: 23

* Date range: Jan 1 – Jan 19

* Most entries in one day: 3 (January 15\)

**Full Entry View (on tap):**

\[ Back to history \]

January 19, 2:30 PM

"Worried about the presentation tomorrow and feeling under-prepared.  
I've done the research, but I'm doubting my ability to explain it clearly.  
What if I forget what I want to say? What if the audience asks tough questions?"

\[ Delete this entry \]

---

**Appendix F: Icon Picker Interface (Sketch)**

**CHOOSE AN ICON FOR YOUR TOOL**

**Header:** Select Icon | \[Close button\]

**Two options:**

**Option 1: Icon Library**

Search: \[\_\_\_\_\_\_\_\_\] (search field)

Categories: \[ All \] \[ Emotions \] \[ Activities \] \[ Objects \] \[ Symbols \]

Grid of icons (searchable):

🧘 🧠 💭 😌 🌿 ☮️  
✨ 💪 🎯 📝 🎵 🌈  
💜 🔥 ⚡ 🌙 ☀️ 🌊  
🕯️ 🍃 🦋 🌸 🌻 🌷

\[ Select \] \[ Use this icon \]

**Option 2: Upload Custom Icon**

* "Upload from phone" button (gallery/camera picker)

* Preview of uploaded image

* Crop / scale preview to 1:1 square

* \[ Use this icon \]

---

**Appendix G: Color Picker Interface (Sketch)**

**CHOOSE A BACKGROUND COLOR FOR YOUR TOOL**

**Header:** Select Color | \[Close button\]

**Visual color picker:**

\[ Large gradient color field \]  
\[ with circle selector in field \]

Value adjustments:  
Hue: |=

|Saturation: ||Lightness: |\================|

Current color preview: \[████\] (large preview box)  
Hex code: \#2D5B6D  
RGB: 45, 91, 109

**Preset palettes (quick select):**

Calming blues: \[ \#87CEEB \] \[ \#4A90E2 \] \[ \#2D5B6D \]  
Warm earth tones: \[ \#D4A574 \] \[ \#A67C52 \] \[ \#6B4423 \]  
Energizing: \[ \#FF6B6B \] \[ \#FFA500 \] \[ \#FFD700 \]  
Greens & nature: \[ \#90EE90 \] \[ \#3CB371 \] \[ \#228B22 \]  
Purples & calm: \[ \#DDA0DD \] \[ \#9370DB \] \[ \#663399 \]

\[ Copy color code \] \[ Use this color \]

---

**Appendix H: Crisis Resources (In-App Copy)**

**MENTAL HEALTH SUPPORT**

⚠️ **IMPORTANT**: Mental Health Wallet is not a replacement for professional mental health care. If you are in crisis, please reach out immediately.

**CRISIS HOTLINES & RESOURCES:**

🇺🇸 **United States**

* 988 Suicide & Crisis Lifeline: Call or text 988 (available 24/7)

* Crisis Text Line: Text HOME to 741741

* International Association for Suicide Prevention: [https://www.iasp.info/resources/Crisis\_Centres/](https://www.iasp.info/resources/Crisis_Centres/)

🇨🇦 **Canada**

* Canada Suicide Prevention Service: 1-833-456-4566 (24/7)

* Crisis Text Line Canada: Text HELLO to 741741

* Talk Suicide Canada: [https://www.talksuicide.ca](https://www.talksuicide.ca)

**FIND A THERAPIST:**

* Psychology Today Directory: [https://www.psychologytoday.com](https://www.psychologytoday.com)

* TherapyDen: [https://www.therapyden.com](https://www.therapyden.com)

* BetterHelp: [https://www.betterhelp.com](https://www.betterhelp.com)

**If you are in immediate danger, please call 911 (US/Canada) or your local emergency services.**

---

**Appendix I: Link Tool Configuration Examples**

**Example 1: Link to Meditation App**

**Card Shell**

* Title: Calm Meditation

* Icon: 🧘 (from icon library)

* Background: Blue gradient

* Description: "Quick access to Calm app for guided meditation"

**Link Tool Config**

* Link type: "Open app / deep link"

* Target URL: calm://

* Fallback URL: https://calmapp.com

* Ask for mood after opening: ON

**Interaction**

* User taps card → app opens Calm app.

* User returns to Mental Health Wallet → prompted to log mood.

* Use is tracked (timestamp, mood before/after if logged).

---

**Example 2: Link to Journal Website**

**Card Shell**

* Title: Reflective Writing Prompt

* Icon: 📝 (from icon library)

* Background: Warm tan color

* Description: "Daily reflection prompts to explore your thoughts and feelings"

**Link Tool Config**

* Link type: "Open website"

* Target URL: https://reflectjournal.com/daily-prompt

* No app deep link needed

* Ask for mood after opening: OFF

**Interaction**

* User taps card → system browser opens website.

* Use is tracked with timestamp.

---

**Appendix J: Custom Tool Builder Flow (Detailed Sketch)**

**Step 1: Basic Card Info**

Header: Create Custom Tool | Step 1 of 3

\[ Title (required) \]  
\[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\]  
Example: "My Grounding Routine"

\[ Description (required) \]  
\[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\]  
Example: "A quick 3-step grounding technique for anxiety"

\[ Choose Icon \]  
\[Choose from library\] \[Upload custom icon\]  
Current: 🌍

\[ Choose Background Color \]  
\[Select color via picker\]  
Current color preview: \[████\]

\[ Category \]  
\[Dropdown: Grounding | Journaling | Self-Compassion | ... \]  
Selected: Grounding & Calming

\[ Next \] \[ Cancel \]

**Step 2: Add Controls**

Header: Create Custom Tool | Step 2 of 3

Add the content for your tool by stacking controls:

\[ Controls List \]

☰ \[ Static text block \] \[ Edit \] \[ Delete \]  
"Step 1: Notice your surroundings"

☰ \[ Text input \] \[ Edit \] \[ Delete \]  
"What do you see?"

☰ \[ Mood slider \] \[ Edit \] \[ Delete \]  
"How are you feeling?" (1–10)

\[ Add block \] (dropdown with control types)

\[ Prev \] \[ Next \] \[ Cancel \]

**Step 3: Preview**

Header: Create Custom Tool | Step 3 of 3 (Preview)

This is how your tool will look to users:

┌─────────────────────────────────┐  
│ My Grounding Routine ⋮ │  
│ │  
│ 🌍 Grounding & Calming │  
│ "A quick 3-step grounding..." │  
│ │  
│ \[ Start \] │  
│ │  
└─────────────────────────────────┘

\[Interact with preview here\]

Looks good? Save it\!

\[ Prev \] \[ Save \] \[ Cancel \]

---

**Document Version**: 2.0  
**Last Updated**: January 19, 2026  
**Status**: Ready for MVP Implementation with Enhanced Features

All additions since v1.0 included: mandatory card shell, primary action requirement, origin badges, edit permissions, drag-drop control reordering, tool management menu (duplicate, usage history, insights), icon picker, color picker, static text font sizes, and expanded appendices with detailed sketches.