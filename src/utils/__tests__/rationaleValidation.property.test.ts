/**
 * Property-based tests for rationaleValidation utilities.
 *
 * Feature: tool-rationale-evidence
 */

import * as fc from 'fast-check';
import { validateLearnMoreLinks, isValidEvidenceLevel, isValidApproach, findBannedWord, isAllowedDomain } from '@/utils/rationaleValidation';
import { CREDIBLE_DOMAINS, BANNED_WORDS } from '@/data/rationaleConfig';
import { getEvidenceLevelLabel } from '@/utils/evidenceLevelLabels';
import type { EvidenceLevel } from '@/types/rationale';

// Feature: tool-rationale-evidence, Property 2: Evidence level validation accepts only defined values
// **Validates: Requirements 1.3, 7.5, 8.4**
describe('Property 2: Evidence level validation accepts only defined values', () => {
  const VALID_EVIDENCE_LEVELS = ['strong', 'moderate', 'emerging', 'not_specifically_studied'] as const;

  it('returns false for any arbitrary string NOT in the allowed set', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !(VALID_EVIDENCE_LEVELS as readonly string[]).includes(s)),
        (arbitraryString) => {
          expect(isValidEvidenceLevel(arbitraryString)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns true for each of the 4 valid evidence level values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_EVIDENCE_LEVELS),
        (validLevel) => {
          expect(isValidEvidenceLevel(validLevel)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tool-rationale-evidence, Property 4: Learn-more-links all-or-nothing validation
// **Validates: Requirements 1.5, 6.2**
describe('Property 4: Learn-more-links all-or-nothing validation', () => {
  /**
   * Generator for valid titles: non-empty strings of 1-100 characters,
   * containing at least one non-whitespace character.
   */
  const validTitleArb = fc
    .stringOf(fc.char(), { minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0);

  /**
   * Generator for valid HTTPS URLs on allowlisted domains.
   * Picks a random credible domain and appends a path segment.
   */
  const validUrlArb = fc
    .record({
      domain: fc.constantFrom(...CREDIBLE_DOMAINS),
      path: fc.webPath(),
    })
    .map(({ domain, path }) => `https://${domain}${path}`);

  /**
   * Generator for a single valid LearnMoreLink entry.
   */
  const validLinkArb = fc.record({
    title: validTitleArb,
    url: validUrlArb,
  });

  /**
   * Generator for an invalid LearnMoreLink entry — one of:
   * - empty title
   * - empty URL
   * - non-HTTPS URL (http://)
   * - URL on a non-allowlisted domain
   */
  const invalidLinkArb = fc.oneof(
    // Empty title
    validUrlArb.map((url) => ({ title: '', url })),
    // Whitespace-only title
    validUrlArb.map((url) => ({ title: '   ', url })),
    // Empty URL
    validTitleArb.map((title) => ({ title, url: '' })),
    // Non-HTTPS URL (http)
    fc.record({
      title: validTitleArb,
      domain: fc.constantFrom(...CREDIBLE_DOMAINS),
      path: fc.webPath(),
    }).map(({ title, domain, path }) => ({
      title,
      url: `http://${domain}${path}`,
    })),
    // HTTPS URL on a non-allowlisted domain
    fc.record({
      title: validTitleArb,
      path: fc.webPath(),
    }).map(({ title, path }) => ({
      title,
      url: `https://not-a-credible-domain.example.com${path}`,
    }))
  );

  describe('Sub-property 1: Arrays containing at least one invalid entry are rejected', () => {
    it('rejects arrays where at least one entry is invalid', () => {
      fc.assert(
        fc.property(
          // Generate an array with 0+ valid entries, then inject at least one invalid entry
          fc.record({
            validLinks: fc.array(validLinkArb, { minLength: 0, maxLength: 4 }),
            invalidLink: invalidLinkArb,
            insertPosition: fc.nat(),
          }),
          ({ validLinks, invalidLink, insertPosition }) => {
            // Insert the invalid link at a random position
            const links = [...validLinks];
            const pos = links.length === 0 ? 0 : insertPosition % (links.length + 1);
            links.splice(pos, 0, invalidLink);

            const result = validateLearnMoreLinks(links);
            return result.isValid === false && result.errors.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sub-property 2: Arrays where all entries are valid are accepted', () => {
    it('accepts arrays where all entries have non-empty titles and valid HTTPS URLs on allowlisted domains', () => {
      fc.assert(
        fc.property(
          fc.array(validLinkArb, { minLength: 1, maxLength: 5 }),
          (links) => {
            const result = validateLearnMoreLinks(links);
            return result.isValid === true && result.errors.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Feature: tool-rationale-evidence, Property 6: Banned words checker rejects text containing forbidden terms
describe('Property 6: Banned words checker rejects text containing forbidden terms', () => {
  // **Validates: Requirements 5.1, 5.2**

  const bannedWords = [...BANNED_WORDS]; // ['cure', 'fix', 'guarantee', 'proven', 'always works']

  describe('Sub-property 1: Strings containing a banned word return non-null', () => {
    it('returns non-null for any string with a banned word injected at a random position', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.constantFrom(...BANNED_WORDS),
          fc.integer({ min: 0, max: 200 }),
          (baseStr, bannedWord, insertPos) => {
            // Insert the banned word at a clamped position within the base string
            const pos = Math.min(insertPos, baseStr.length);
            const textWithBanned = baseStr.slice(0, pos) + bannedWord + baseStr.slice(pos);

            const result = findBannedWord(textWithBanned);
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sub-property 2: Strings without any banned word return null', () => {
    it('returns null for any string that does not contain any banned word', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 300 }).filter((s) => {
            const lower = s.toLowerCase();
            return !bannedWords.some((word) => lower.includes(word));
          }),
          (cleanStr) => {
            const result = findBannedWord(cleanStr);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Feature: tool-rationale-evidence, Property 7: Approach allowlist validation
// **Validates: Requirements 6.1, 8.4**
describe('Property 7: Approach allowlist validation', () => {
  const VALID_APPROACHES = [
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
  ] as const;

  describe('Sub-property 1: Arbitrary strings NOT in the 10 allowed values return false', () => {
    it('returns false for any arbitrary string not matching a valid approach', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !(VALID_APPROACHES as readonly string[]).includes(s)),
          (arbitraryString) => {
            expect(isValidApproach(arbitraryString)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sub-property 2: Each of the 10 valid values returns true', () => {
    it('returns true for each valid TherapeuticApproach value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_APPROACHES),
          (validApproach) => {
            expect(isValidApproach(validApproach)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Feature: tool-rationale-evidence, Property 8: URL domain allowlist validation
// **Validates: Requirements 6.2**
describe('Property 8: URL domain allowlist validation', () => {
  /**
   * Generator for a valid subdomain label (e.g., "sub", "api", "docs").
   * Subdomain labels: 1-20 lowercase alpha characters.
   */
  const subdomainLabelArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    { minLength: 1, maxLength: 20 }
  );

  /**
   * Generator for a valid HTTPS URL on an allowlisted domain.
   * Optionally prepends a random subdomain (e.g., "sub.nhs.uk").
   */
  const allowlistedUrlArb = fc
    .record({
      domain: fc.constantFrom(...CREDIBLE_DOMAINS),
      subdomain: fc.option(subdomainLabelArb, { nil: undefined }),
      path: fc.webPath(),
    })
    .map(({ domain, subdomain, path }) => {
      const hostname = subdomain ? `${subdomain}.${domain}` : domain;
      return `https://${hostname}${path}`;
    });

  /**
   * Generator for a hostname that does NOT match any allowlisted domain
   * (neither exact match nor subdomain of one).
   * Uses a structure like "random.example.org" that won't collide with the allowlist.
   */
  const nonAllowlistedHostnameArb = fc
    .record({
      label: subdomainLabelArb,
      tld: fc.constantFrom('example.org', 'randomsite.net', 'notallowed.io', 'testdomain.xyz'),
    })
    .map(({ label, tld }) => `${label}.${tld}`)
    .filter((hostname) => {
      // Ensure the generated hostname doesn't accidentally match any allowlisted domain
      return !CREDIBLE_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );
    });

  /**
   * Generator for a valid HTTPS URL on a NON-allowlisted domain.
   */
  const nonAllowlistedUrlArb = fc
    .record({
      hostname: nonAllowlistedHostnameArb,
      path: fc.webPath(),
    })
    .map(({ hostname, path }) => `https://${hostname}${path}`);

  describe('Sub-property 1: URLs with hostnames on the allowlist (exact or subdomain) return true', () => {
    it('returns true for any HTTPS URL whose hostname is an allowlisted domain or subdomain of one', () => {
      fc.assert(
        fc.property(allowlistedUrlArb, (url) => {
          expect(isAllowedDomain(url)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Sub-property 2: URLs with hostnames NOT on the allowlist return false', () => {
    it('returns false for any HTTPS URL whose hostname does not match any allowlisted domain', () => {
      fc.assert(
        fc.property(nonAllowlistedUrlArb, (url) => {
          expect(isAllowedDomain(url)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// Feature: tool-rationale-evidence, Property 12: Evidence level to display label mapping is total
// **Validates: Requirements 4.1**
describe('Property 12: Evidence level to display label mapping is total', () => {
  const VALID_EVIDENCE_LEVELS: EvidenceLevel[] = [
    'strong',
    'moderate',
    'emerging',
    'not_specifically_studied',
  ];

  it('maps every valid EvidenceLevel to a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_EVIDENCE_LEVELS),
        (level) => {
          const label = getEvidenceLevelLabel(level);
          expect(typeof label).toBe('string');
          expect(label.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maps all 4 evidence levels to distinct labels (injective)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_EVIDENCE_LEVELS),
        fc.constantFrom(...VALID_EVIDENCE_LEVELS),
        (levelA, levelB) => {
          if (levelA !== levelB) {
            const labelA = getEvidenceLevelLabel(levelA);
            const labelB = getEvidenceLevelLabel(levelB);
            expect(labelA).not.toBe(labelB);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
