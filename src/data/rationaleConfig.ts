/**
 * Configuration constants for the Tool Rationale & Evidence Layer.
 * Validates: Requirements 5.2, 6.2
 */

/**
 * Credible source domains for learn_more_links validation.
 * New domains require explicit addition before use.
 */
export const CREDIBLE_DOMAINS: readonly string[] = [
  'pmc.ncbi.nlm.nih.gov',
  'pubmed.ncbi.nlm.nih.gov',
  'albertahealthservices.ca',
  'camh.ca',
  'sciencedirect.com',
  'positivepsychology.com',
  'cogbtherapy.com',
  'who.int',
  'nhs.uk',
  'nhsinform.scot',
  'urmc.rochester.edu',
  'verywellmind.com',
  'medicalnewstoday.com',
  'health.clevelandclinic.org',
  'mindfulness.com',
  'therapist.com',
  'copingskillsforkids.com',
  'youtube.com',
  'files.upei.ca',
  'mayoclinic.org',
] as const;

/**
 * Words banned from rationale text fields.
 * Enforces honest, measured tone.
 */
export const BANNED_WORDS: readonly string[] = [
  'cure',
  'fix',
  'guarantee',
  'proven',
  'always works',
] as const;

/**
 * Field length constraints for rationale metadata.
 */
export const RATIONALE_LIMITS = {
  approach: 100,
  inANutshell: 300,
  howItWorks: 600,
  researchSummaryItem: 200,
  researchSummaryMinItems: 2,
  researchSummaryMaxItems: 3,
  learnMoreLinkTitle: 100,
} as const;
