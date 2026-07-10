# Implementation Plan: Tool Rationale & Evidence Layer

## Overview

This plan implements a structured rationale and evidence layer for curated tool cards. The implementation follows a bottom-up approach: foundational types and configuration first, then validation utilities, then UI components, then integration into existing screens, then content population for all curated cards, and finally admin flow updates.

## Tasks

- [x] 1. Define types, configuration, and approaches registry
  - [x] 1.1 Create rationale type definitions
    - Create `src/types/rationale.ts` with `EvidenceLevel` union type, `TherapeuticApproach` union type, `LearnMoreLink` interface, and `RationaleMetadata` interface
    - `EvidenceLevel`: union of `'strong' | 'moderate' | 'emerging' | 'not_specifically_studied'`
    - `TherapeuticApproach`: union of the 10 allowlisted values (`'CBT' | 'DBT' | 'ACT' | 'mindfulness-based stress reduction' | 'positive psychology' | 'somatic techniques' | 'grounding' | 'behavioral activation' | 'psychoeducation' | 'self-compassion'`)
    - `LearnMoreLink`: interface with `title: string` and `url: string`
    - `RationaleMetadata`: interface with `approach`, `inANutshell`, `howItWorks`, `evidenceLevel`, `researchSummary` (tuple type `[string, string] | [string, string, string]`), and optional `learnMoreLinks`
    - Export all types from the file
    - _Requirements: 1.1, 1.3, 6.1_

  - [x] 1.2 Create rationale configuration constants
    - Create `src/data/rationaleConfig.ts` with `CREDIBLE_DOMAINS`, `BANNED_WORDS`, and `RATIONALE_LIMITS` constants
    - `CREDIBLE_DOMAINS`: readonly array of 9 allowlisted domains from Requirement 6.2
    - `BANNED_WORDS`: readonly array of 5 banned words (`'cure'`, `'fix'`, `'guarantee'`, `'proven'`, `'always works'`)
    - `RATIONALE_LIMITS`: object with field length constraints (approach: 100, inANutshell: 300, howItWorks: 600, researchSummaryItem: 200, researchSummaryMinItems: 2, researchSummaryMaxItems: 3, learnMoreLinkTitle: 100)
    - _Requirements: 5.2, 6.2_

  - [x] 1.3 Create approaches registry
    - Create `src/data/approachesRegistry.ts` with `ApproachDescription` interface and `APPROACHES_REGISTRY` constant
    - `APPROACHES_REGISTRY`: Record keyed by `TherapeuticApproach` with `shortDescription` and `fullDescription` for each approach
    - Populate all 10 approaches with accurate, measured evidence descriptions referencing established research
    - This serves as the single source of truth for approach-level evidence descriptions (Requirement 6.3)
    - _Requirements: 6.1, 6.3_

  - [x] 1.4 Extend CuratedCardDefinition with rationale field
    - Add `rationale?: RationaleMetadata` to the `CuratedCardDefinition` interface in `src/data/curatedLibrary.ts`
    - Import `RationaleMetadata` from `@/types/rationale`
    - Field is optional to support transition period; all 20 cards will be populated in a later task
    - _Requirements: 1.1_

- [x] 2. Implement validation utilities
  - [x] 2.1 Implement rationale validation functions
    - Create `src/utils/rationaleValidation.ts`
    - Implement `validateRationaleMetadata(metadata)`: validates all fields — approach must be valid `TherapeuticApproach`, field lengths must respect `RATIONALE_LIMITS`, `researchSummary` must have 2-3 items each ≤200 chars, `evidenceLevel` must be valid
    - Implement `findBannedWord(text)`: checks text against `BANNED_WORDS`, returns first match or null (case-insensitive)
    - Implement `isAllowedDomain(url)`: extracts hostname from URL, checks if it matches or is a subdomain of a `CREDIBLE_DOMAINS` entry
    - Implement `validateLearnMoreLinks(links)`: all-or-nothing validation — if any entry has empty title, empty URL, non-HTTPS URL, or domain not on allowlist, reject entire array
    - Implement `isValidHttpsUrl(url)`: validates URL starts with `https://` and is well-formed
    - Implement `isValidApproach(value)`: type guard returning `value is TherapeuticApproach`
    - Implement `isValidEvidenceLevel(value)`: type guard returning `value is EvidenceLevel`
    - All functions return `ValidationResult` (from `@/types/index`) where applicable
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.2, 6.1, 6.2_

  - [x] 2.2 Write property tests for validation — field length rejection (Property 1)
    - Create `src/utils/__tests__/rationaleValidation.property.test.ts`
    - **Property 1: Rationale metadata validation rejects invalid field lengths**
    - Use fast-check to generate strings exceeding length limits for each field
    - Verify `validateRationaleMetadata` returns invalid result identifying the offending field
    - **Validates: Requirements 1.1, 7.2, 7.3, 7.4**

  - [x] 2.3 Write property tests for validation — evidence level (Property 2)
    - **Property 2: Evidence level validation accepts only defined values**
    - Generate arbitrary strings; verify `isValidEvidenceLevel` returns true only for the 4 defined values
    - **Validates: Requirements 1.3, 7.5, 8.4**

  - [x] 2.4 Write property tests for validation — research summary cardinality (Property 3)
    - **Property 3: Research summary cardinality validation**
    - Generate arrays of various lengths; verify rejection for <2 or >3 items
    - **Validates: Requirements 1.4, 7.6**

  - [x] 2.5 Write property tests for validation — learn-more-links all-or-nothing (Property 4)
    - **Property 4: Learn-more-links all-or-nothing validation**
    - Generate arrays with valid and invalid entries; verify entire array rejected if any entry invalid
    - **Validates: Requirements 1.5, 6.2**

  - [x] 2.6 Write property tests for validation — banned words (Property 6)
    - **Property 6: Banned words checker rejects text containing forbidden terms**
    - Generate strings containing/not-containing banned words; verify correct detection
    - **Validates: Requirements 5.1, 5.2**

  - [x] 2.7 Write property tests for validation — approach allowlist (Property 7)
    - **Property 7: Approach allowlist validation**
    - Generate arbitrary strings; verify `isValidApproach` returns true only for the 10 defined values
    - **Validates: Requirements 6.1, 8.4**

  - [x] 2.8 Write property tests for validation — URL domain allowlist (Property 8)
    - **Property 8: URL domain allowlist validation**
    - Generate URLs with various domains; verify `isAllowedDomain` returns true only for allowlisted domains/subdomains
    - **Validates: Requirements 6.2**

  - [x] 2.9 Write property test for evidence level display label mapping (Property 12)
    - **Property 12: Evidence level to display label mapping is total**
    - Verify every valid `EvidenceLevel` maps to a non-empty, distinct label
    - **Validates: Requirements 4.1**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement UI components
  - [x] 4.1 Create RationaleEntryPoint component
    - Create `src/components/rationale/RationaleEntryPoint.tsx`
    - Props: `inANutshell: string | undefined` and `onPress: () => void`
    - Return `null` if `inANutshell` is undefined, empty, or whitespace-only
    - Render `TouchableOpacity` with label "Why this might help"
    - Minimum tap target 44×44 points (via `minHeight`/`minWidth` or `hitSlop`)
    - `accessibilityRole="button"` and `accessibilityLabel="Why this might help"`
    - Styled as subtle text link (muted color, small font)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Write property test for entry point visibility (Property 5)
    - **Property 5: Entry point visibility derives from in_a_nutshell content**
    - Generate empty/whitespace/non-empty strings; verify render/null behavior
    - **Validates: Requirements 2.1, 2.2**

  - [x] 4.3 Create RationaleSheet component
    - Create `src/components/rationale/RationaleSheet.tsx`
    - Props: `visible`, `rationale: RationaleMetadata`, `cardTitle`, `isDistressRelated`, `onDismiss`, `onCrisisResourcesPress`
    - Use React Native `Modal` with `animationType="slide"` and transparent background
    - Max height: 90% of screen height
    - Dismissible via: swipe-down gesture, close button (X), or backdrop tap
    - Content sections in order: card title header, "In a nutshell", "How it works", evidence level badge, "What we know from research" bullets, disclaimer (conditional), "Learn more" links (conditional)
    - Evidence level badge with plain-language labels: strong→"Well-researched approach", moderate→"Growing research support", emerging→"Early research", not_specifically_studied→"Based on general principles"
    - Disclaimer shown only when `evidenceLevel === 'not_specifically_studied'`: "This tool draws on general wellbeing principles. It has not been specifically studied in this exact form."
    - Disclaimer positioned below research summary, above learn more links
    - "Learn more" section hidden entirely if `learnMoreLinks` is empty/undefined
    - Links displayed as tappable labels (not raw URLs), open via `Linking.openURL`
    - On link open failure: show inline error "This link couldn't be opened." without dismissing sheet
    - If `isDistressRelated` is true, render "Crisis resources" tappable link in research section that calls `onCrisisResourcesPress`
    - ScrollView for content overflow
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.3_

  - [x] 4.4 Write unit tests for RationaleSheet
    - Test section ordering renders correctly
    - Test disclaimer appears only for `not_specifically_studied`
    - Test "Learn more" section hidden when links array is empty
    - Test evidence level badge displays correct label for each level
    - Test crisis resources link appears when `isDistressRelated` is true
    - Test dismissal callbacks fire correctly
    - _Requirements: 3.2, 3.3, 4.1, 4.3, 4.7, 5.3_

- [x] 5. Integrate entry point into existing screens
  - [x] 5.1 Add RationaleEntryPoint to FocusedCardView
    - Import `RationaleEntryPoint` and `RationaleSheet` into the focused card component
    - Add entry point between description and stats area
    - Manage sheet visibility state with `useState`
    - Pass card's `rationale?.inANutshell` to entry point
    - Determine `isDistressRelated` from card's `emotionTags` containing `'anxious'`, `'angry'`, or `'stressed'`
    - Wire `onCrisisResourcesPress` to navigate to `CrisisResourcesScreen`
    - Entry point hidden when card is in expanded/active-use state
    - _Requirements: 2.6, 2.7_

  - [x] 5.2 Add RationaleEntryPoint to CardPreviewSheet (Library Browser)
    - Import and render `RationaleEntryPoint` below card description in the library preview modal
    - Wire up `RationaleSheet` with same pattern as FocusedCardView
    - _Requirements: 2.6_

  - [x] 5.3 Add RationaleEntryPoint to SessionView/ToolPreviewCard
    - Import and render `RationaleEntryPoint` in the emotion session tool selection preview
    - Wire up `RationaleSheet` with same pattern
    - _Requirements: 2.6_

  - [x] 5.4 Write unit tests for integration contexts
    - Test entry point renders in focused card view when rationale present
    - Test entry point hidden in stacked/expanded/archive contexts
    - Test entry point renders in library browser preview
    - Test entry point renders in session tool preview
    - _Requirements: 2.6, 2.7_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Populate rationale content for all curated library cards
  - [x] 7.1 Add rationale metadata to Grounding & Calming cards
    - Populate `rationale` field for: "5-4-3-2-1 Grounding", "Box Breathing", "4-7-8 Breathing", "Name It to Tame It", "Progressive Muscle Relaxation"
    - Each card gets: `approach`, `inANutshell` (≤300 chars), `howItWorks` (≤600 chars), `evidenceLevel`, `researchSummary` (2-3 items ≤200 chars each), and optional `learnMoreLinks`
    - Use conditional language ("may help", "research suggests") per Requirement 5.1
    - Distress-related cards (those with anxious/stressed/angry emotion tags) must include professional help reference in researchSummary per Requirement 5.3
    - All learn_more_links URLs must be from CREDIBLE_DOMAINS allowlist
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2, 5.3, 6.2_

  - [x] 7.2 Add rationale metadata to Cognitive Reframing cards
    - Populate `rationale` for: "Thought – Feeling – Action", "Alternative Thought", "Identify Thinking Traps", "Decatastrophizing"
    - Same content quality requirements as 7.1
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2_

  - [x] 7.3 Add rationale metadata to Body & Sensory cards
    - Populate `rationale` for: "Body Scan in 3 Minutes", "Move for 5 Minutes", "Sensory Reset"
    - Same content quality requirements as 7.1
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2_

  - [x] 7.4 Add rationale metadata to Daily Check-In & Journaling cards
    - Populate `rationale` for: "Daily Mood Check-In", "Worry Dump", "Win of the Day", "Evening Gratitude"
    - Same content quality requirements as 7.1
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2_

  - [x] 7.5 Add rationale metadata to Self-Compassion & Reminders cards
    - Populate `rationale` for: "Self-Compassion Pause", "Affirmation: Strength", "Affirmation: Worth", "You Are Not Alone", "Future Self Letter"
    - Same content quality requirements as 7.1
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2_

  - [x] 7.6 Add rationale metadata to Lightweight Connection card
    - Populate `rationale` for: "Reach Out"
    - Same content quality requirements as 7.1
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2_

  - [x] 7.7 Write property test for curated library completeness (Property 9)
    - Create `src/data/__tests__/curatedLibrary.rationale.property.test.ts`
    - **Property 9: Curated library completeness**
    - For every card in `CURATED_LIBRARY`, verify `rationale` is defined and passes `validateRationaleMetadata`
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

  - [x] 7.8 Write property test for distress-related cards referencing professional help (Property 13)
    - **Property 13: Distress-related cards reference professional help**
    - For every card with emotionTags including "anxious", "angry", or "stressed", verify at least one researchSummary item contains "professional", "therapist", or "clinician"
    - **Validates: Requirements 5.3**

- [x] 8. Implement admin card and export service updates
  - [x] 8.1 Add database migration for rationale columns
    - Add `runRationaleMigration` function to `src/data/migrations.ts`
    - Add columns: `rationale_approach`, `rationale_in_a_nutshell`, `rationale_how_it_works`, `rationale_evidence_level` (with CHECK constraint), `rationale_research_summary` (JSON text), `rationale_learn_more_links` (JSON text, nullable)
    - Register migration in `runMigrations` function
    - All columns nullable (user cards don't have rationale; admin cards may be in-progress)
    - _Requirements: 8.1_

  - [x] 8.2 Update adminCardService to accept and persist rationale
    - Extend `createLibraryCard` in `src/services/adminCardService.ts` with optional `rationale?: RationaleMetadata` parameter
    - When provided, persist rationale fields to the new DB columns (serialize `researchSummary` and `learnMoreLinks` as JSON)
    - Validate approach and evidenceLevel against allowed values before persisting
    - _Requirements: 8.1, 8.4_

  - [x] 8.3 Update export service with rationale serialization and validation
    - Extend `serializeToCuratedDefinition` in `src/services/exportService.ts` to read rationale columns and include `rationale: { ... }` in the serialized TypeScript output
    - Create `validateExportReadiness(card)` function that checks all required rationale fields are populated; returns `ValidationResult` with field-specific errors
    - Block export (throw or return error) if any required rationale field is missing/empty
    - _Requirements: 8.2, 8.3_

  - [x] 8.4 Write property tests for export service — serialization includes rationale (Property 10)
    - Create `src/services/__tests__/exportService.rationale.property.test.ts`
    - **Property 10: Export serialization includes all rationale fields**
    - Generate cards with complete rationale; verify serialized output contains all sub-fields
    - **Validates: Requirements 8.2**

  - [x] 8.5 Write property tests for export service — blocks on missing fields (Property 11)
    - **Property 11: Export blocks on missing rationale fields**
    - Generate cards with at least one missing rationale field; verify export validation returns invalid result
    - **Validates: Requirements 8.3**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript explicitly, so all implementation is in TypeScript
- All imports use the `@/*` path alias pointing to `src/`
- Tests use Jest with fast-check 3 for property-based testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4", "5.1", "5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4"] },
    { "id": 8, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 9, "tasks": ["7.7", "7.8"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2", "8.3"] },
    { "id": 12, "tasks": ["8.4", "8.5"] }
  ]
}
```
