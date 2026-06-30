# Requirements Document

## Introduction

Progressive onboarding flow for Mental Health Wallet that replaces the current standalone disclaimer screen. The flow guides new users to their first "aha moment" — using one tool in their wallet — within 60–90 seconds. It uses a 3-screen progressive sequence followed by in-context guidance on the wallet, with embedded disclaimer acknowledgment and intent-based card seeding to deliver immediate proof-of-value.

## Glossary

- **Onboarding_Flow**: The sequential set of screens presented to first-time users between app launch and the main wallet experience (Welcome → Intent Selection → Wallet with guidance)
- **Wallet_Screen**: The main interface displaying the user's personal card stack
- **Starter_Cards**: A set of 1–3 curated library cards automatically added to a new user's wallet based on their stated intent
- **Intent_Selection**: The screen where users choose their primary job-to-be-done from a set of plain-language options
- **Micro_Tutorial**: In-context tooltip overlays on the wallet screen that teach core interactions without leaving the wallet; shown sequentially after the wallet loads for the first time
- **First_Action_Checklist**: A 3-item inline checklist displayed on the wallet screen (after the Micro_Tutorial is dismissed) to guide users through initial interactions
- **Disclaimer_Acknowledgment**: The user's confirmation that they understand the app is not a crisis service or replacement for professional care
- **Onboarding_Store**: The Zustand store that persists onboarding state (completion status, intent selection, checklist progress); each stage has its own completion flag
- **Skip_Intro**: The power-user action that bypasses the full onboarding sequence while still seeding default cards and recording disclaimer acknowledgment
- **Frontmost_Card**: The visually lowest card in the stacked wallet layout, which is the topmost in z-order and the first card the user should interact with

## Requirements

### Requirement 1: Welcome Screen and Disclaimer Acknowledgment

**User Story:** As a new user, I want to understand the app's value proposition and acknowledge the mental health disclaimer in a single welcoming screen, so that I can proceed without being blocked by a separate clinical-looking disclaimer.

#### Acceptance Criteria

1. WHEN a first-time user launches the app, THE Onboarding_Flow SHALL display the Welcome screen with a headline, value proposition subtext, and embedded mental health disclaimer text.
2. WHEN the user taps "Continue" on the Welcome screen, THE Onboarding_Flow SHALL record the Disclaimer_Acknowledgment in the settings table and advance to the Intent Selection screen.
3. WHEN the user taps "Skip intro" on the Welcome screen, THE Onboarding_Flow SHALL record the Disclaimer_Acknowledgment, seed the wallet with a default set of Starter_Cards, mark the onboarding screens as complete, and navigate directly to the Wallet_Screen (where the Micro_Tutorial and First_Action_Checklist will still appear).
4. THE Welcome screen SHALL display micro-reassurance text stating that the app is not a crisis service, the user stays in control, and all questions can be left blank.
5. WHEN a user who has previously completed onboarding (disclaimer acknowledged and starter cards seeded) launches the app, THE Onboarding_Flow screens SHALL not be displayed, and the app SHALL navigate directly to the Wallet_Screen.
6. THE Welcome screen SHALL support back-swipe prevention — the user cannot navigate backward from this screen.

### Requirement 2: Intent Selection

**User Story:** As a new user, I want to tell the app what brought me here using plain language, so that I receive relevant starter tools without needing to browse a full library.

#### Acceptance Criteria

1. WHEN the Intent Selection screen is displayed, THE Onboarding_Flow SHALL present 4 plain-language job-to-be-done options: quick tools for overwhelm, building a daily routine, organizing collected tools, and exploring.
2. WHEN the user selects one intent option, THE Onboarding_Store SHALL persist the selected intent, seed the wallet with Starter_Cards for that intent, mark the onboarding screens as complete, and navigate to the Wallet_Screen.
3. THE Intent Selection screen SHALL allow selection of exactly one option at a time.
4. THE Intent Selection screen SHALL display one decision only — no additional questions or fields alongside the intent options.
5. THE Intent Selection screen SHALL support back navigation to the Welcome screen.

### Requirement 3: Starter Wallet Seeding

**User Story:** As a new user, I want to arrive at my wallet with relevant tools already in place, so that I can experience the app's value immediately without searching.

#### Acceptance Criteria

1. THE system SHALL store the starter card mappings in a configurable data source (database table or configuration file) so that the default cards for each intent can be updated without code changes.
2. WHEN the user completes intent selection with "quick tools for overwhelm," THE Onboarding_Flow SHALL seed the wallet with the configured Starter_Cards for that intent. Initial defaults: "5-4-3-2-1 Grounding," "Box Breathing," and "Name It to Tame It."
3. WHEN the user completes intent selection with "building a daily routine," THE Onboarding_Flow SHALL seed the wallet with the configured Starter_Cards for that intent. Initial defaults: "Daily Mood Check-In," "Win of the Day," and "Evening Gratitude."
4. WHEN the user completes intent selection with "organizing collected tools," THE Onboarding_Flow SHALL seed the wallet with the configured Starter_Cards for that intent. Initial defaults: "5-4-3-2-1 Grounding" (single example card to get started).
5. WHEN the user completes intent selection with "exploring," THE Onboarding_Flow SHALL seed the wallet with the configured Starter_Cards for that intent. Initial defaults: "Box Breathing," "Thought – Feeling – Action," and "Win of the Day."
6. WHEN the user uses Skip_Intro from the Welcome screen, THE Onboarding_Flow SHALL seed the wallet with the configured default Starter_Cards. Initial defaults: "5-4-3-2-1 Grounding," "Daily Mood Check-In," and "Self-Compassion Pause."
7. THE seeded Starter_Cards SHALL be persisted to the database with origin badge "library" and appear in the wallet card stack.
8. THE starter card configuration SHALL support adding, removing, or reordering cards per intent without requiring a code change or app update.
9. THE curated library SHALL include all cards referenced as starter defaults. Cards "Name It to Tame It," "Win of the Day," and "Evening Gratitude" SHALL be added to the curated library if not already present.

### Requirement 4: Starter Wallet Display

**User Story:** As a new user, I want to land directly on the real wallet screen with my starter cards visible, so that I understand this is my personal space and not a tutorial simulation.

#### Acceptance Criteria

1. WHEN the user transitions from onboarding to the wallet for the first time, THE Micro_Tutorial SHALL start immediately without requiring any banner dismissal.
2. THE Starter Wallet display SHALL be the real Wallet_Screen — not a separate tutorial or simplified simulation screen.
3. THE OnboardingBanner component exists but is bypassed in the current flow — the tutorial starts automatically.

### Requirement 5: Micro-Tutorial Tooltips

**User Story:** As a new user, I want contextual guidance overlaid on the wallet to learn how to use it, so that I can discover core interactions without reading a manual.

#### Acceptance Criteria

1. WHEN the user arrives at the Wallet_Screen for the first time during onboarding, THE Micro_Tutorial SHALL immediately display an in-context tooltip spotlighting the Frontmost_Card with the text: "Here's an example tool to get started. Tap the card to try it out."
2. WHEN the user taps the Frontmost_Card as instructed, THE Micro_Tutorial SHALL dismiss the first tooltip and display a second tooltip pointing to the expanded card's primary action button with the text: "Try it out! Tap here to complete the exercise."
3. WHEN the user taps "Skip tips" at any point during the Micro_Tutorial, THE Micro_Tutorial SHALL dismiss all remaining tooltips and not display further tutorial overlays.
4. THE Micro_Tutorial tooltips SHALL be rendered as overlays on the Wallet_Screen — not as separate full-screen tutorial pages.
5. WHEN all Micro_Tutorial tooltips have been dismissed (by completing the guided actions or by "Skip tips"), THE Onboarding_Store SHALL record the tutorial stage as complete, and the First_Action_Checklist SHALL become visible.

### Requirement 6: First Action Checklist

**User Story:** As a new user, I want a short checklist of first actions to guide me through using my first tool, so that I reach the "aha moment" with clear direction.

#### Acceptance Criteria

1. WHEN the Micro_Tutorial is complete (all tooltips dismissed or skipped), THE First_Action_Checklist SHALL display a collapsible 3-item inline checklist on the Wallet_Screen: "Open your first tool," "Complete a tool," and "Discover a new tool."
2. WHEN the user taps a checklist item, THE Wallet_Screen SHALL navigate to the relevant action: tapping item 1 focuses the Frontmost_Card, tapping item 2 expands the focused card, tapping item 3 opens the Library Browser.
3. WHEN the user focuses any card (including during the Micro_Tutorial), THE First_Action_Checklist SHALL auto-mark item 1 as done.
4. WHEN any card's totalUses increases, THE First_Action_Checklist SHALL auto-mark item 2 as done and display a positive reinforcement message: "Nice! You've just used your first tool."
5. WHEN the user adds a card from the Library Browser OR creates a new personal tool, THE First_Action_Checklist SHALL auto-mark item 3 as done.
6. WHEN all 3 checklist items are marked as done, THE First_Action_Checklist SHALL display a completion celebration ("🎉 Great start! You've taken your first step toward organizing your mental health. Come back regularly to keep the momentum going.") with a dismiss X button, and auto-dismiss after 12 seconds.
7. IF the user has not completed all checklist items after 3 app sessions, THEN THE First_Action_Checklist SHALL dismiss itself permanently.
8. THE First_Action_Checklist SHALL persist its progress across app sessions using the Onboarding_Store.
9. THE First_Action_Checklist SHALL be hidden when a card is focused (to give space for the expanded card) and reappear when the user returns to the stack view.
10. THE First_Action_Checklist SHALL start expanded and allow the user to manually collapse it to a compact progress bar.

### Requirement 7: Onboarding State Persistence

**User Story:** As a user, I want my onboarding progress saved locally, so that I do not repeat completed steps if I close and reopen the app mid-onboarding.

#### Acceptance Criteria

1. THE Onboarding_Store SHALL persist the following state to the local database: disclaimer acknowledged (boolean), onboarding screens complete (boolean), selected intent (string or null), tutorial complete (boolean), and checklist progress (object with 3 boolean fields and a session counter).
2. WHEN the user closes the app mid-onboarding and reopens it, THE Onboarding_Flow SHALL resume at the appropriate stage: if disclaimer not acknowledged → Welcome screen; if screens not complete → Intent Selection; if screens complete → Wallet_Screen with tutorial/checklist based on their completion flags.
3. EACH onboarding stage (screens, tutorial, checklist) SHALL have its own independent completion flag, so stages that are already done are never re-shown regardless of other stages' status.

### Requirement 8: Existing Disclaimer Replacement

**User Story:** As a developer, I want the new onboarding flow to fully replace the current standalone disclaimer screen, so that users have a cohesive first-launch experience without duplicate acknowledgment steps.

#### Acceptance Criteria

1. WHEN the onboarding feature is active, THE app SHALL not display the legacy standalone DisclaimerScreen as a separate route.
2. THE Onboarding_Flow SHALL write the same "disclaimer_acknowledged" setting key to the database that the legacy DisclaimerScreen previously wrote, ensuring backward compatibility.
3. WHEN a user who acknowledged the disclaimer via the legacy screen launches the updated app, THE app SHALL recognize the existing acknowledgment and navigate directly to the Wallet_Screen (legacy users will have an empty wallet — this is acceptable as there are no production users yet).

### Requirement 9: Accessibility and Cognitive Load

**User Story:** As a user with varying cognitive capacity, I want the onboarding to use short sentences, plain language, and one decision per screen, so that I can complete it without feeling overwhelmed.

#### Acceptance Criteria

1. THE Onboarding_Flow SHALL present one primary decision per screen with no secondary questions or actions competing for attention.
2. THE Onboarding_Flow SHALL use plain language at approximately a 6th-grade reading level and avoid clinical or psychological jargon in all user-facing text.
3. THE Onboarding_Flow SHALL provide encouraging micro-copy after each user decision to reinforce their choice (e.g., "Great choice — we'll set you up with tools for that.").
4. THE Onboarding_Flow screens SHALL meet WCAG 2.1 AA contrast ratios for all text and interactive elements.
5. THE Onboarding_Flow SHALL support screen reader navigation with appropriate accessibility labels on all interactive elements.

### Requirement 10: Performance Target

**User Story:** As a new user, I want the onboarding to be fast and responsive, so that I reach my first tool within 60–90 seconds without perceiving delays.

#### Acceptance Criteria

1. THE Onboarding_Flow SHALL allow a user to progress from app launch to their first tool interaction on the Wallet_Screen within 90 seconds, assuming the user does not pause on any screen for more than 10 seconds.
2. WHEN the user transitions between onboarding screens, THE Onboarding_Flow SHALL render the next screen within 300 milliseconds.
3. WHEN Starter_Cards are seeded into the wallet, THE database write operation SHALL complete within 500 milliseconds.

---

## Future Enhancements (Not in Scope)

The following features were considered but deferred for future implementation:

- **Content Filters (Preferences screen)**: Allow users to indicate categories they want to avoid (body-focused exercises, breathing exercises, spiritual language). Would filter starter card selection and potentially the library browser. Requires a filter-to-card-ID mapping in the configurable data source.
- **Usage Frequency preference**: Collect how often the user intends to use the wallet. Could drive reminder defaults or notification frequency.
- **Signup After Value prompt**: After first tool use or first personal card creation, prompt "Want to keep your tools across devices?" Requires server sync infrastructure.
- **"Create Your Own Tool" discoverability for organize-intent users**: Add a 4th checklist item ("Create your own tool") for users who selected "I have tools already — help me organize." Tapping it would navigate to the Card Creator with guidance. Requires the Card Creator flow to be polished enough for first-time users and potentially a brief tutorial overlay explaining the control system.
- **Collapsed stack tooltip (3rd tooltip)**: After the user expands a card during the micro-tutorial, the other cards collapse to the bottom. A 3rd tooltip could highlight the collapsed stack and explain "Tap here to return to your full wallet." This would help users who don't realize the collapsed strips are tappable. Consider adding if user testing shows people get stuck after expanding a card.
