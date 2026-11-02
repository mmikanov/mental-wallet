/**
 * tipsService.parseTip — Bug 1 (tip consistency): the app now carries the tip's full
 * raw-markdown `body` from the shared index so TipDetailScreen can render it natively.
 * These tests pin that `body` is carried through when present and tolerated when absent
 * (older/short tips), while required-field validation and the existing fields are unchanged.
 */

import { parseTip } from '@/services/tipsService';

const VALID_BASE = {
  slug: 'add-your-own-tool',
  title: 'Add your own tool',
  summary: 'A short summary.',
  type: 'feature',
  topics: ['tools'],
  heroImage: '/assets/tips/add-your-own-tool.gif',
  cta: { label: 'Create your own tool', url: 'https://example.test/app/create-tool' },
  url: '/tips/add-your-own-tool',
  publishedAt: '2026-01-01',
};

describe('tipsService.parseTip', () => {
  it('carries the full markdown body through when present', () => {
    const body = '# Heading\n\nFirst paragraph.\n\n- a list item\n\nSecond **bold** paragraph.';
    const tip = parseTip({ ...VALID_BASE, body });
    expect(tip).not.toBeNull();
    expect(tip!.body).toBe(body);
    // Other fields unchanged.
    expect(tip!.title).toBe('Add your own tool');
    expect(tip!.cta).toEqual({
      label: 'Create your own tool',
      url: 'https://example.test/app/create-tool',
    });
  });

  it('tolerates a missing body (body is undefined, no throw)', () => {
    const tip = parseTip(VALID_BASE);
    expect(tip).not.toBeNull();
    expect(tip!.body).toBeUndefined();
  });

  it('treats an empty-string body as absent (undefined)', () => {
    const tip = parseTip({ ...VALID_BASE, body: '' });
    expect(tip).not.toBeNull();
    expect(tip!.body).toBeUndefined();
  });

  it('ignores a non-string body', () => {
    const tip = parseTip({ ...VALID_BASE, body: 123 as unknown });
    expect(tip).not.toBeNull();
    expect(tip!.body).toBeUndefined();
  });

  it('returns null for a malformed entry (missing required fields)', () => {
    expect(parseTip({ slug: '', title: '', url: '' })).toBeNull();
    expect(parseTip(null)).toBeNull();
    expect(parseTip('nope')).toBeNull();
  });
});
