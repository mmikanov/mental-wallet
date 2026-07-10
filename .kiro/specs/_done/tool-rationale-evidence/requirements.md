# Requirements Document

## Introduction

This feature adds a trustworthy, plain-language rationale and evidence layer to every curated tool/card in Mental Health Wallet. Each card gains a "Why this might help" entry point that opens a structured explanation covering the tool's purpose, underlying mechanism, and supporting research. The goal is to increase user trust, help users make informed decisions about which tools to try, and maintain an honest tone that avoids overclaiming.

## Glossary

- **Rationale_Layer**: The complete set of metadata and UI components that explain why a tool exists, how it works, and what evidence supports it
- **Tool_Card**: A curated or user-facing card in the Mental Health Wallet library representing a single coping tool or exercise
- **Evidence_Level**: A categorical rating indicating the strength of research support for a tool's underlying approach; one of: strong, moderate, emerging, or not_specifically_studied
- **Approach_Tag**: A label identifying the recognized therapeutic framework a tool belongs to (e.g., CBT, mindfulness, positive psychology)
- **Rationale_Sheet**: The bottom sheet or modal UI that displays the rationale content sections when a user taps the entry point
- **Entry_Point**: The tappable UI element ("Why this might help") that opens the Rationale_Sheet
- **Learn_More_Link**: An optional external hyperlink to a credible educational resource providing deeper information about the tool's approach
- **Curated_Library**: The static set of hand-selected mental health tools available in the Library Browser

## Requirements

### Requirement 1: Rationale Metadata Schema

**User Story:** As a developer, I want each tool card to have structured metadata fields for rationale and evidence, so that the UI can consistently render explanations across all tools.

#### Acceptance Criteria

1. THE Curated_Library type definition SHALL include the following metadata fields on each Tool_Card: approach (string, maximum 100 characters), in_a_nutshell (string, maximum 300 characters), how_it_works (string, maximum 600 characters), evidence_level (Evidence_Level), research_summary (string array of 2-3 items, each item maximum 200 characters), and learn_more_links (optional array of objects where each object requires both a title string of maximum 100 characters and a url string containing a valid HTTPS URL)
2. WHEN a Tool_Card has evidence_level set to "not_specifically_studied", THE Rationale_Layer SHALL store a disclaimer text indicating that the tool draws on general wellbeing principles rather than specific research on the exact implementation
3. THE Rationale_Layer SHALL enforce at the type level that evidence_level accepts only one of the four defined values: "strong", "moderate", "emerging", or "not_specifically_studied"
4. THE Rationale_Layer SHALL enforce that research_summary contains between 2 and 3 items, each no longer than 200 characters
5. IF a Tool_Card's learn_more_links contains any entry with a missing title, a missing url, or a url that is not a valid HTTPS URL, THEN THE Rationale_Layer SHALL reject the entire Tool_Card's learn_more_links as invalid at build-time via type checking or at runtime via validation before rendering (individual invalid entries do not get filtered; the whole card's links section is treated as invalid)

### Requirement 2: Entry Point Display

**User Story:** As a user, I want to see a clear, consistent way to access the rationale for any tool, so that I can learn why the tool might help before or after engaging with it.

#### Acceptance Criteria

1. WHEN a Tool_Card has an in_a_nutshell field containing at least one non-whitespace character, THE Entry_Point SHALL be displayed on the card in eligible contexts (see criteria 6 and 7)
2. WHEN a Tool_Card does not have an in_a_nutshell field, or the field is empty, or the field contains only whitespace, THE Entry_Point SHALL be hidden for that card regardless of context
3. THE Entry_Point SHALL render as an inline "Learn more" hyperlink appended to the end of the card description text, styled in blue (#2563EB) to appear as a tappable link
4. THE Entry_Point SHALL be positioned inline at the end of the tool description paragraph, flowing naturally as part of the text
5. THE Entry_Point SHALL meet WCAG 2.1 AA accessibility requirements with `accessibilityRole="link"` and an accessible label of "Learn more about why this might help"
6. THE Entry_Point SHALL be visible in the following contexts: Wallet focused card state (both collapsed and expanded), Library Browser card preview (CardPreviewSheet), and Emotion Session library tool preview (LibraryToolPreview)
7. THE Entry_Point SHALL be hidden in the following contexts: Wallet collapsed/stacked cards, Emotion Session compact recommendation cards (ToolPreviewCard), and Archive screen

### Requirement 3: Rationale Sheet Content and Layout

**User Story:** As a user, I want to read a structured explanation of a tool's purpose, mechanism, and evidence, so that I can make an informed decision about whether the tool is worth trying.

#### Acceptance Criteria

1. WHEN a user taps the Entry_Point, THE Rationale_Sheet SHALL open as a bottom sheet or modal overlay within 300 milliseconds of the tap event
2. THE Rationale_Sheet SHALL display content in the following section order: "In a nutshell" heading with the in_a_nutshell text, "How it works" heading with the how_it_works text, evidence level badge, "What we know from research" heading with the research_summary bullets, disclaimer (conditional), crisis support callout (conditional for distress-related cards), and optionally "Further reading" heading with Learn_More_Links
3. IF a Tool_Card has no learn_more_links or the array is empty, THEN THE Rationale_Sheet SHALL omit the "Further reading" section entirely without leaving blank space or a placeholder
4. IF a Tool_Card has learn_more_links populated, THEN THE Rationale_Sheet SHALL display each link's title followed by a ↗ indicator as the visible tappable label (not the raw URL), styled with a light blue background (#F0F9FF) to appear clearly tappable, that opens the associated URL in the device default browser when tapped
5. THE Rationale_Sheet SHALL be dismissible by swiping down, tapping a close button, or tapping the overlay backdrop, and upon dismissal SHALL return the user to the previous screen state without loss of context
6. WHILE the Rationale_Sheet content height exceeds the visible sheet area, THE Rationale_Sheet SHALL enable vertical scrolling to access all content. THE sheet size SHALL be separately limited to a maximum of 90% of screen height.
7. IF a learn_more_link URL fails to open in the device browser, THEN THE Rationale_Sheet SHALL display an inline error message indicating the link could not be opened and SHALL keep the sheet visible without dismissing it

### Requirement 4: Evidence Level Indicator and Disclaimer

**User Story:** As a user, I want to see at a glance how strong the evidence is behind a tool, so that I can calibrate my expectations appropriately.

#### Acceptance Criteria

1. THE Rationale_Sheet SHALL display an evidence-strength indicator above the research_summary section, using plain-language labels mapped to evidence_level values: "strong" → "Well-researched approach", "moderate" → "Growing research support", "emerging" → "Early research", "not_specifically_studied" → "Based on general principles"
2. THE evidence-strength indicator SHALL be visually distinct (e.g., a small badge or tag with appropriate styling) so users can identify it at a glance without reading the full research summary
3. WHEN a Tool_Card has evidence_level equal to "not_specifically_studied", THE Rationale_Sheet SHALL additionally display a disclaimer line below the research_summary section reading: "This tool draws on general wellbeing principles. It has not been specifically studied in this exact form."
4. WHEN the disclaimer line is displayed and the Tool_Card has a non-empty learn_more_links array, THE Rationale_Sheet SHALL position the disclaimer below the research_summary section and above the Learn_More_Links section
5. WHEN the disclaimer line is displayed and the Tool_Card has learn_more_links that are all invalid or broken, THE Rationale_Sheet SHALL position the disclaimer as the last element below the research_summary section (treating empty and all-invalid links identically)
6. THE Rationale_Sheet SHALL render the disclaimer line with visual differentiation from the surrounding rationale content (e.g., italic style, muted text color, or a distinct info-style container) so that it is distinguishable as a caveat rather than a research finding
7. WHEN a Tool_Card has evidence_level equal to "strong", "moderate", or "emerging", THE Rationale_Sheet SHALL omit the disclaimer line but SHALL still display the evidence-strength indicator

### Requirement 5: Content Tone and Language Rules

**User Story:** As a user, I want explanations to be honest and measured in their claims, so that I feel I can trust the app rather than being sold exaggerated promises.

#### Acceptance Criteria

1. THE Rationale_Layer content in the in_a_nutshell, how_it_works, and research_summary fields SHALL use conditional language (e.g., "may help", "research suggests", "many people find") rather than absolute claims
2. THE Rationale_Layer content SHALL avoid the words "cure", "fix", "guarantee", "proven", and "always works" in all rationale text fields (in_a_nutshell, how_it_works, research_summary)
3. WHEN a Tool_Card's approach addresses distress-related emotions (anxiety, panic, anger, crisis), THE research_summary SHALL include a statement that severe or worsening symptoms should be discussed with a professional, AND THE Rationale_Sheet SHALL display a styled callout below the research section reading "In crisis? Get support →" with a red left-border accent, that navigates to the Crisis Resources screen when tapped
4. THE Rationale_Layer content SHALL describe evidence at the approach level (e.g., "CBT-based techniques have been shown to help some people") rather than claiming specific efficacy for the app's exact implementation

### Requirement 6: Content Quality and Credibility

**User Story:** As a user, I want to trust that the explanations and links I see come from credible sources and are reviewed by knowledgeable humans, so that I can rely on the information provided.

#### Acceptance Criteria

1. THE Rationale_Layer content SHALL reference only therapeutic frameworks listed in a maintained allowlist (including at minimum: CBT, DBT, ACT, mindfulness-based stress reduction, positive psychology, somatic techniques, grounding, behavioral activation, psychoeducation, and self-compassion) as approach tags, enforced via a TypeScript type constraint that rejects values outside the allowlist at compile time
2. THE Learn_More_Links SHALL link only to domains listed in a maintained credible-sources allowlist stored as a configuration constant. The allowlist includes: pmc.ncbi.nlm.nih.gov, pubmed.ncbi.nlm.nih.gov, albertahealthservices.ca, camh.ca, sciencedirect.com, positivepsychology.com, cogbtherapy.com, who.int, nhs.uk, nhsinform.scot, urmc.rochester.edu, verywellmind.com, medicalnewstoday.com, health.clevelandclinic.org, mindfulness.com, therapist.com, copingskillsforkids.com, youtube.com, files.upei.ca, mayoclinic.org. A validation test SHALL verify that all learn_more_links URLs across the curated library resolve to domains on the allowlist. New domains require explicit addition to the allowlist before use.
3. THE Rationale_Layer content SHALL be structured so that each approach's evidence description is defined in a single shared location (e.g., an approaches registry), and WHEN that shared description is updated, all Tool_Cards referencing that approach SHALL reflect the updated description the next time the card is displayed (no automatic refresh of already-rendered cards; updates apply on next load)

### Requirement 7: Rationale Content for Existing Curated Library

**User Story:** As a user, I want every curated tool in the library to have a completed rationale, so that the feature is useful from day one rather than partially populated.

#### Acceptance Criteria

1. THE Curated_Library SHALL include complete rationale metadata (approach, in_a_nutshell, how_it_works, evidence_level, and research_summary) for all existing Tool_Cards, where no field is empty or null. Content SHALL be sourced from the Tool Rationale & Evidence Layer PRD document (#[[file:Mental-Health-Wallet-PRD.docx.md]])
2. WHEN rationale metadata is added to the Curated_Library, THE approach field SHALL contain the name of the therapeutic or psychological approach the tool is based on (e.g., "CBT", "Mindfulness", "Grounding"), limited to a maximum of 100 characters
3. WHEN rationale metadata is added to the Curated_Library, THE in_a_nutshell field SHALL contain 1-2 sentences (maximum 300 characters) explaining what the tool is for and when to use it
4. WHEN rationale metadata is added to the Curated_Library, THE how_it_works field SHALL contain 2-4 sentences (maximum 600 characters) describing the mechanism or framework that explains why the tool may be effective
5. WHEN rationale metadata is added to the Curated_Library, THE evidence_level field SHALL contain exactly one of the following values: "strong", "moderate", "emerging", or "not_specifically_studied"
6. WHEN rationale metadata is added to the Curated_Library, THE research_summary field SHALL contain 2-3 bullet points (each maximum 200 characters) summarizing published evidence or established clinical practice supporting the therapeutic approach the tool belongs to

### Requirement 8: Admin-Created Library Tool Rationale Requirement

**User Story:** As an admin, I want the admin card creation and export flow to support rationale metadata fields, so that when I export a card to the curated library it already includes all required rationale data.

#### Acceptance Criteria

1. THE admin card editing flow SHALL present rationale fields as a dedicated Step 4 (after Preview) with fields for approach (chip picker from allowlist), in_a_nutshell (text area, 300 char limit), how_it_works (text area, 600 char limit), evidence_level (chip picker), research_summary (2-3 bullet inputs, 200 chars each), and optional learn_more_links (title + URL pairs), persisted alongside the card in the database. Regular users see 3 steps; admin mode adds the 4th step.
2. WHEN an admin exports a card via serializeToCuratedDefinition, THE export output SHALL include the rationale metadata fields in the generated CuratedCardDefinition code. If DB rationale columns are NULL, the export SHALL fall back to the static CURATED_LIBRARY rationale.
3. IF an admin card is exported with any required rationale field (approach, in_a_nutshell, how_it_works, evidence_level, or research_summary) missing or empty, THEN the export SHALL display a warning indicating which rationale fields are incomplete and SHALL block the export from completing
4. THE admin card creation flow SHALL validate that approach is a value from the maintained approach allowlist and that evidence_level is one of the allowed values ("strong", "moderate", "emerging", or "not_specifically_studied")
5. THE admin Library Browser SHALL display a yellow "Draft" badge on cards whose DB override differs from the static original (in shell, controls, or rationale fields). IF the admin reverts all fields to match the static original exactly, the Draft badge SHALL disappear.
6. THE admin Library Browser SHALL display a red "Stale" badge on cards whose DB rationale data differs from the current static CURATED_LIBRARY rationale (indicating the code was updated but the override still has old data). The admin resolves stale cards by deleting the override.

## Future Considerations

- **Social Proof Layer** (separate spec: `tool-social-proof`): User voting, helpfulness counts ("X people found this helpful"), and community recommendations will be added as a follow-up feature. The Rationale_Sheet is a likely display surface for social signals, positioned below the research section. This will require backend infrastructure, aggregation, anonymization, and cold-start handling — intentionally out of scope for this spec.
- **Approach Tag as User-Facing UI**: The `approach` field is currently internal (powers evidence grouping and validation). Post-MVP, it should be surfaced as a visible badge/chip on cards and as a filter in the Library Browser. Key beneficiaries: licensed therapists assigning tools by framework ("show me all CBT tools"), and power users familiar with therapeutic modalities from their own therapy. This aligns with the secondary user persona (therapists) and could support browse-by-approach and therapist assignment workflows.
- **AI-Generated Tool Publishing Gate**: When AI tool generation and curation workflows are introduced, require an explicit approach tag and evidence_level assessment before any AI-generated tool can be published to users. This ensures no tool is visible without at least a basic rationale classification.
