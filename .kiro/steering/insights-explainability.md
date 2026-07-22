# Insights Explainability

## Rule

Whenever any logic governing the Usage-Outcome Insights feature is changed — including but not limited to:

- Correlation computation method (Req 3)
- Duration weighting formula (Req 3.2)
- Tier thresholds (Nascent/Preliminary/Confident)
- Score_Delta interpretation thresholds (+0.3 / -0.3)
- Time period options
- "Preceding day" association logic (D and D−1)
- Best Tools ranking or tiebreaker rules
- KPI label change handling
- Outcome_Effectiveness_Score formula or thresholds (Req 12)
- Effectiveness pattern classification boundaries (Req 12.2)
- "Tools to reconsider" qualification criteria (Req 13)

The following explainability artifacts **must** be updated in the same change:

1. **Inline tooltip text** (Req 11.3) — the plain-language explanations shown when users tap ⓘ
2. **Help page content** (Req 11.6) — the "How this works" sections describing the methodology
3. **First-time tier hints** (Req 11.9) — if tier behavior changed
4. **UI wireframes** (`ui-wireframes.md`) — if the change affects what users see

## Rationale

Users trust the app's insights only when they can understand them. Stale help text that describes a different algorithm than what's running erodes that trust. Treat explainability content as part of the implementation, not documentation added afterward.
