/**
 * Type definitions for the Tool Rationale & Evidence Layer.
 * Provides structured metadata for explaining why each curated tool might help,
 * including therapeutic approach, mechanism, and research backing.
 */

/**
 * Evidence level categorization for tool research backing.
 * Enforced as a TypeScript union — only these four values compile.
 */
export type EvidenceLevel =
  | 'strong'
  | 'moderate'
  | 'emerging'
  | 'not_specifically_studied';

/**
 * Recognized therapeutic approaches (allowlist).
 * New values require explicit addition to this union.
 */
export type TherapeuticApproach =
  | 'CBT'
  | 'DBT'
  | 'ACT'
  | 'mindfulness-based stress reduction'
  | 'positive psychology'
  | 'somatic techniques'
  | 'grounding'
  | 'behavioral activation'
  | 'psychoeducation'
  | 'self-compassion';

/**
 * External link to a credible educational resource.
 */
export interface LearnMoreLink {
  title: string;   // max 100 characters
  url: string;     // must be valid HTTPS URL on allowlisted domain
}

/**
 * Complete rationale metadata attached to a curated card.
 */
export interface RationaleMetadata {
  approach: TherapeuticApproach;
  inANutshell: string;           // max 300 characters
  howItWorks: string;            // max 600 characters
  evidenceLevel: EvidenceLevel;
  researchSummary: [string, string] | [string, string, string]; // 2-3 items, each max 200 chars
  learnMoreLinks?: LearnMoreLink[];
}
