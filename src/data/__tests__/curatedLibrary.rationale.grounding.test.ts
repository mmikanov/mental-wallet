/**
 * Validates Task 7.1: Rationale metadata for Grounding & Calming cards.
 * Checks character limits, banned words, credible domains, professional help references,
 * and correct approach assignments.
 */
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { CREDIBLE_DOMAINS, BANNED_WORDS } from '@/data/rationaleConfig';

const GROUNDING_IDS = [
  'lib-grounding-54321',
  'lib-box-breathing',
  'lib-pmr',
  'lib-name-it-tame-it',
];

const EXPECTED_APPROACHES: Record<string, string> = {
  'lib-grounding-54321': 'grounding',
  'lib-box-breathing': 'somatic techniques',
  'lib-pmr': 'somatic techniques',
  'lib-name-it-tame-it': 'psychoeducation',
};

describe('Grounding & Calming cards — rationale metadata', () => {
  const groundingCards = CURATED_LIBRARY.filter(c => GROUNDING_IDS.includes(c.id));

  it('all 4 grounding cards have rationale populated', () => {
    expect(groundingCards).toHaveLength(4);
    for (const card of groundingCards) {
      expect(card.rationale).toBeDefined();
    }
  });

  it.each(GROUNDING_IDS)('%s has correct approach', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    expect(card.rationale!.approach).toBe(EXPECTED_APPROACHES[id]);
  });

  it.each(GROUNDING_IDS)('%s inANutshell is ≤ 300 chars and non-empty', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    const text = card.rationale!.inANutshell;
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(300);
  });

  it.each(GROUNDING_IDS)('%s howItWorks is ≤ 600 chars and non-empty', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    const text = card.rationale!.howItWorks;
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(600);
  });

  it.each(GROUNDING_IDS)('%s evidenceLevel is valid', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    expect(['strong', 'moderate', 'emerging', 'not_specifically_studied']).toContain(
      card.rationale!.evidenceLevel
    );
  });

  it.each(GROUNDING_IDS)('%s researchSummary has 2-3 items each ≤ 200 chars', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    const summary = card.rationale!.researchSummary;
    expect(summary.length).toBeGreaterThanOrEqual(2);
    expect(summary.length).toBeLessThanOrEqual(3);
    for (const item of summary) {
      expect(item.length).toBeGreaterThan(0);
      expect(item.length).toBeLessThanOrEqual(200);
    }
  });

  it.each(GROUNDING_IDS)('%s contains no banned words', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    const r = card.rationale!;
    const allText = [r.inANutshell, r.howItWorks, ...r.researchSummary].join(' ').toLowerCase();
    for (const word of BANNED_WORDS) {
      expect(allText).not.toContain(word);
    }
  });

  it.each(GROUNDING_IDS)('%s includes professional help reference (distress-related)', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    const hasRef = card.rationale!.researchSummary.some(
      s => /professional|therapist|clinician/.test(s.toLowerCase())
    );
    expect(hasRef).toBe(true);
  });

  it.each(GROUNDING_IDS)('%s learnMoreLinks use credible domains only', (id) => {
    const card = groundingCards.find(c => c.id === id)!;
    const links = card.rationale!.learnMoreLinks;
    if (!links || links.length === 0) return;
    for (const link of links) {
      expect(link.title.length).toBeGreaterThan(0);
      expect(link.title.length).toBeLessThanOrEqual(100);
      expect(link.url.startsWith('https://')).toBe(true);
      const url = new URL(link.url);
      const isAllowed = CREDIBLE_DOMAINS.some(
        d => url.hostname === d || url.hostname.endsWith('.' + d)
      );
      expect(isAllowed).toBe(true);
    }
  });
});
