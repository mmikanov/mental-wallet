import {
  isValidApproach,
  isValidEvidenceLevel,
  findBannedWord,
  isValidHttpsUrl,
  isAllowedDomain,
  validateLearnMoreLinks,
  validateRationaleMetadata,
} from '@/utils/rationaleValidation';

describe('isValidApproach', () => {
  it('accepts all valid TherapeuticApproach values', () => {
    const validApproaches = [
      'CBT', 'DBT', 'ACT', 'mindfulness-based stress reduction',
      'positive psychology', 'somatic techniques', 'grounding',
      'behavioral activation', 'psychoeducation', 'self-compassion',
    ];
    for (const approach of validApproaches) {
      expect(isValidApproach(approach)).toBe(true);
    }
  });

  it('rejects invalid values', () => {
    expect(isValidApproach('invalid')).toBe(false);
    expect(isValidApproach('')).toBe(false);
    expect(isValidApproach('cbt')).toBe(false); // case-sensitive
    expect(isValidApproach(123)).toBe(false);
    expect(isValidApproach(null)).toBe(false);
  });
});

describe('isValidEvidenceLevel', () => {
  it('accepts all valid EvidenceLevel values', () => {
    const validLevels = ['strong', 'moderate', 'emerging', 'not_specifically_studied'];
    for (const level of validLevels) {
      expect(isValidEvidenceLevel(level)).toBe(true);
    }
  });

  it('rejects invalid values', () => {
    expect(isValidEvidenceLevel('high')).toBe(false);
    expect(isValidEvidenceLevel('')).toBe(false);
    expect(isValidEvidenceLevel('Strong')).toBe(false);
    expect(isValidEvidenceLevel(null)).toBe(false);
  });
});

describe('findBannedWord', () => {
  it('returns the first banned word found (case-insensitive)', () => {
    expect(findBannedWord('This will cure your anxiety')).toBe('cure');
    expect(findBannedWord('GUARANTEED to work')).toBe('guarantee');
    expect(findBannedWord('This always works for everyone')).toBe('always works');
    expect(findBannedWord('A PROVEN technique')).toBe('proven');
    expect(findBannedWord('This will fix everything')).toBe('fix');
  });

  it('returns null for clean text', () => {
    expect(findBannedWord('This may help reduce stress')).toBeNull();
    expect(findBannedWord('Research suggests this can be beneficial')).toBeNull();
    expect(findBannedWord('')).toBeNull();
  });
});

describe('isValidHttpsUrl', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(isValidHttpsUrl('https://example.com')).toBe(true);
    expect(isValidHttpsUrl('https://nhs.uk/mental-health/tips')).toBe(true);
    expect(isValidHttpsUrl('https://pmc.ncbi.nlm.nih.gov/articles/123')).toBe(true);
  });

  it('rejects non-HTTPS or malformed URLs', () => {
    expect(isValidHttpsUrl('http://example.com')).toBe(false);
    expect(isValidHttpsUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpsUrl('not a url')).toBe(false);
    expect(isValidHttpsUrl('')).toBe(false);
    expect(isValidHttpsUrl('https://')).toBe(false);
  });
});

describe('isAllowedDomain', () => {
  it('accepts URLs from credible domains', () => {
    expect(isAllowedDomain('https://nhs.uk/mental-health')).toBe(true);
    expect(isAllowedDomain('https://pmc.ncbi.nlm.nih.gov/articles/123')).toBe(true);
    expect(isAllowedDomain('https://who.int/research')).toBe(true);
  });

  it('accepts subdomains of credible domains', () => {
    expect(isAllowedDomain('https://research.nhs.uk/article')).toBe(true);
    expect(isAllowedDomain('https://www.who.int/page')).toBe(true);
  });

  it('rejects URLs from non-credible domains', () => {
    expect(isAllowedDomain('https://example.com')).toBe(false);
    expect(isAllowedDomain('https://random-blog.com')).toBe(false);
    expect(isAllowedDomain('https://fakenhs.uk/page')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedDomain('not a url')).toBe(false);
  });
});

describe('validateLearnMoreLinks', () => {
  it('returns valid for undefined links', () => {
    const result = validateLearnMoreLinks(undefined);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for empty array', () => {
    const result = validateLearnMoreLinks([]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for correct links', () => {
    const result = validateLearnMoreLinks([
      { title: 'NHS Guide', url: 'https://nhs.uk/mental-health' },
      { title: 'WHO Research', url: 'https://who.int/research' },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects entire array if any link has empty title', () => {
    const result = validateLearnMoreLinks([
      { title: 'Valid', url: 'https://nhs.uk/page' },
      { title: '', url: 'https://who.int/page' },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('empty title'))).toBe(true);
  });

  it('rejects entire array if any link has non-HTTPS URL', () => {
    const result = validateLearnMoreLinks([
      { title: 'Valid', url: 'http://nhs.uk/page' },
    ]);
    expect(result.isValid).toBe(false);
  });

  it('rejects entire array if any link domain is not on allowlist', () => {
    const result = validateLearnMoreLinks([
      { title: 'Blog Post', url: 'https://random-blog.com/article' },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('not on the approved'))).toBe(true);
  });

  it('rejects if title exceeds 100 chars', () => {
    const result = validateLearnMoreLinks([
      { title: 'a'.repeat(101), url: 'https://nhs.uk/page' },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('exceeds'))).toBe(true);
  });
});

describe('validateRationaleMetadata', () => {
  const validMetadata = {
    approach: 'CBT' as const,
    inANutshell: 'A brief explanation of the approach.',
    howItWorks: 'A more detailed explanation of how this tool works.',
    evidenceLevel: 'strong' as const,
    researchSummary: ['Research point one.', 'Research point two.'] as [string, string],
  };

  it('returns valid for correct metadata', () => {
    const result = validateRationaleMetadata(validMetadata);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid approach', () => {
    const result = validateRationaleMetadata({ ...validMetadata, approach: 'invalid' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'approach')).toBe(true);
  });

  it('rejects empty inANutshell', () => {
    const result = validateRationaleMetadata({ ...validMetadata, inANutshell: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'inANutshell')).toBe(true);
  });

  it('rejects inANutshell exceeding 300 chars', () => {
    const result = validateRationaleMetadata({ ...validMetadata, inANutshell: 'a'.repeat(301) });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'inANutshell')).toBe(true);
  });

  it('rejects empty howItWorks', () => {
    const result = validateRationaleMetadata({ ...validMetadata, howItWorks: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'howItWorks')).toBe(true);
  });

  it('rejects howItWorks exceeding 600 chars', () => {
    const result = validateRationaleMetadata({ ...validMetadata, howItWorks: 'a'.repeat(601) });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'howItWorks')).toBe(true);
  });

  it('rejects invalid evidenceLevel', () => {
    const result = validateRationaleMetadata({ ...validMetadata, evidenceLevel: 'high' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'evidenceLevel')).toBe(true);
  });

  it('rejects researchSummary with fewer than 2 items', () => {
    const result = validateRationaleMetadata({
      ...validMetadata,
      researchSummary: ['Only one'] as any,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'researchSummary')).toBe(true);
  });

  it('rejects researchSummary with more than 3 items', () => {
    const result = validateRationaleMetadata({
      ...validMetadata,
      researchSummary: ['One', 'Two', 'Three', 'Four'] as any,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'researchSummary')).toBe(true);
  });

  it('rejects researchSummary item exceeding 200 chars', () => {
    const result = validateRationaleMetadata({
      ...validMetadata,
      researchSummary: ['Valid item', 'a'.repeat(201)] as [string, string],
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'researchSummary' && e.message.includes('exceeds'))).toBe(true);
  });

  it('validates learnMoreLinks when provided', () => {
    const result = validateRationaleMetadata({
      ...validMetadata,
      learnMoreLinks: [{ title: '', url: 'https://nhs.uk' }],
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'learnMoreLinks')).toBe(true);
  });

  it('collects all errors without short-circuiting', () => {
    const result = validateRationaleMetadata({
      approach: 'invalid' as any,
      inANutshell: '',
      howItWorks: '',
      evidenceLevel: 'bad' as any,
      researchSummary: [] as any,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});
