/**
 * Validation utilities for the Tool Rationale & Evidence Layer.
 * Validates rationale metadata, banned words, URL domains, and learn-more links.
 */

import type {
  RationaleMetadata,
  LearnMoreLink,
  EvidenceLevel,
  TherapeuticApproach,
} from '@/types/rationale';
import type { ValidationResult } from '@/types/index';
import { CREDIBLE_DOMAINS, BANNED_WORDS, RATIONALE_LIMITS } from '@/data/rationaleConfig';

/** All valid TherapeuticApproach values. */
const VALID_APPROACHES: readonly string[] = [
  'CBT',
  'DBT',
  'ACT',
  'mindfulness-based stress reduction',
  'positive psychology',
  'somatic techniques',
  'grounding',
  'behavioral activation',
  'psychoeducation',
  'self-compassion',
];

/** All valid EvidenceLevel values. */
const VALID_EVIDENCE_LEVELS: readonly string[] = [
  'strong',
  'moderate',
  'emerging',
  'not_specifically_studied',
];

/**
 * Type guard: returns true if value is a valid TherapeuticApproach.
 */
export function isValidApproach(value: unknown): value is TherapeuticApproach {
  return typeof value === 'string' && VALID_APPROACHES.includes(value);
}

/**
 * Type guard: returns true if value is a valid EvidenceLevel.
 */
export function isValidEvidenceLevel(value: unknown): value is EvidenceLevel {
  return typeof value === 'string' && VALID_EVIDENCE_LEVELS.includes(value);
}

/**
 * Checks text against BANNED_WORDS (case-insensitive).
 * Returns the first banned word found, or null if text is clean.
 */
export function findBannedWord(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return word;
    }
  }
  return null;
}

/**
 * Validates that a string is a well-formed HTTPS URL.
 */
export function isValidHttpsUrl(url: string): boolean {
  if (!url.startsWith('https://')) {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts hostname from a URL and checks if it matches or is a subdomain
 * of any entry in the CREDIBLE_DOMAINS allowlist.
 */
export function isAllowedDomain(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  for (const domain of CREDIBLE_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Validates learn_more_links with all-or-nothing semantics.
 * If links is undefined or empty, returns valid.
 * If ANY entry is invalid, the entire array is rejected.
 */
export function validateLearnMoreLinks(
  links: LearnMoreLink[] | undefined
): ValidationResult {
  if (!links || links.length === 0) {
    return { isValid: true, errors: [] };
  }

  const errors: { field: string; message: string }[] = [];

  for (let i = 0; i < links.length; i++) {
    const link = links[i];

    if (!link.title || link.title.trim().length === 0) {
      errors.push({
        field: 'learnMoreLinks',
        message: `Link at index ${i} has an empty title`,
      });
    } else if (link.title.length > RATIONALE_LIMITS.learnMoreLinkTitle) {
      errors.push({
        field: 'learnMoreLinks',
        message: `Link at index ${i} title exceeds ${RATIONALE_LIMITS.learnMoreLinkTitle} characters`,
      });
    }

    if (!link.url || link.url.trim().length === 0) {
      errors.push({
        field: 'learnMoreLinks',
        message: `Link at index ${i} has an empty URL`,
      });
    } else if (!isValidHttpsUrl(link.url)) {
      errors.push({
        field: 'learnMoreLinks',
        message: `Link at index ${i} URL is not a valid HTTPS URL`,
      });
    } else if (!isAllowedDomain(link.url)) {
      errors.push({
        field: 'learnMoreLinks',
        message: `Link at index ${i} URL domain is not on the approved sources list`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a complete RationaleMetadata object.
 * Returns all validation errors found (does not short-circuit).
 */
export function validateRationaleMetadata(
  metadata: Partial<RationaleMetadata>
): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  // Validate approach
  if (!isValidApproach(metadata.approach)) {
    errors.push({
      field: 'approach',
      message: 'Approach must be a valid TherapeuticApproach',
    });
  } else if (metadata.approach.length > RATIONALE_LIMITS.approach) {
    errors.push({
      field: 'approach',
      message: `Approach must not exceed ${RATIONALE_LIMITS.approach} characters`,
    });
  }

  // Validate inANutshell
  if (!metadata.inANutshell || metadata.inANutshell.trim().length === 0) {
    errors.push({
      field: 'inANutshell',
      message: 'inANutshell is required and must be non-empty',
    });
  } else if (metadata.inANutshell.length > RATIONALE_LIMITS.inANutshell) {
    errors.push({
      field: 'inANutshell',
      message: `inANutshell must not exceed ${RATIONALE_LIMITS.inANutshell} characters`,
    });
  }

  // Validate howItWorks
  if (!metadata.howItWorks || metadata.howItWorks.trim().length === 0) {
    errors.push({
      field: 'howItWorks',
      message: 'howItWorks is required and must be non-empty',
    });
  } else if (metadata.howItWorks.length > RATIONALE_LIMITS.howItWorks) {
    errors.push({
      field: 'howItWorks',
      message: `howItWorks must not exceed ${RATIONALE_LIMITS.howItWorks} characters`,
    });
  }

  // Validate evidenceLevel
  if (!isValidEvidenceLevel(metadata.evidenceLevel)) {
    errors.push({
      field: 'evidenceLevel',
      message: 'evidenceLevel must be a valid EvidenceLevel',
    });
  }

  // Validate researchSummary
  if (!metadata.researchSummary || !Array.isArray(metadata.researchSummary)) {
    errors.push({
      field: 'researchSummary',
      message: 'researchSummary is required',
    });
  } else {
    if (
      metadata.researchSummary.length < RATIONALE_LIMITS.researchSummaryMinItems ||
      metadata.researchSummary.length > RATIONALE_LIMITS.researchSummaryMaxItems
    ) {
      errors.push({
        field: 'researchSummary',
        message: `researchSummary must have ${RATIONALE_LIMITS.researchSummaryMinItems}-${RATIONALE_LIMITS.researchSummaryMaxItems} items`,
      });
    }

    for (let i = 0; i < metadata.researchSummary.length; i++) {
      if (metadata.researchSummary[i].length > RATIONALE_LIMITS.researchSummaryItem) {
        errors.push({
          field: 'researchSummary',
          message: `researchSummary item at index ${i} exceeds ${RATIONALE_LIMITS.researchSummaryItem} characters`,
        });
      }
    }
  }

  // Validate learnMoreLinks (if provided)
  if (metadata.learnMoreLinks !== undefined) {
    const linksResult = validateLearnMoreLinks(metadata.learnMoreLinks);
    if (!linksResult.isValid) {
      errors.push(...linksResult.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
