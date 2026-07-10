/**
 * Display label mapping for EvidenceLevel values.
 * Maps each evidence level to a plain-language label suitable for UI display.
 */

import type { EvidenceLevel } from '@/types/rationale';

/**
 * Maps a valid EvidenceLevel to its plain-language display label.
 *
 * | Value                    | Display Label              |
 * |--------------------------|----------------------------|
 * | 'strong'                 | "Well-researched approach" |
 * | 'moderate'               | "Growing research support" |
 * | 'emerging'               | "Early research"           |
 * | 'not_specifically_studied' | "Based on general principles" |
 */
const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  strong: 'Well-researched approach',
  moderate: 'Growing research support',
  emerging: 'Early research',
  not_specifically_studied: 'Based on general principles',
};

/**
 * Returns the plain-language display label for a given EvidenceLevel.
 *
 * @param level - A valid EvidenceLevel value
 * @returns A non-empty display string for use in the Rationale Sheet badge
 */
export function getEvidenceLevelLabel(level: EvidenceLevel): string {
  return EVIDENCE_LEVEL_LABELS[level];
}
