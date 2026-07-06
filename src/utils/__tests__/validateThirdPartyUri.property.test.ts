/**
 * Property-based tests for validateThirdPartyUri utility.
 *
 * Feature: card-ux-enhancements, Property 4: Third-party URI validation accepts only HTTPS or local asset paths
 *
 * **Validates: Requirements 4.7, 4.8**
 */

import * as fc from 'fast-check';
import { validateThirdPartyUri } from '../validateThirdPartyUri';

describe('Property 4: Third-party URI validation accepts only HTTPS or local asset paths', () => {
  it('returns valid: true for any string starting with https://', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (suffix) => {
          const uri = `https://${suffix}`;
          const result = validateThirdPartyUri(uri);
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid: true for any string starting with ./', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (suffix) => {
          const uri = `./${suffix}`;
          const result = validateThirdPartyUri(uri);
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid: true for any string starting with ../', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (suffix) => {
          const uri = `../${suffix}`;
          const result = validateThirdPartyUri(uri);
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid: true for any string starting with file://', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (suffix) => {
          const uri = `file://${suffix}`;
          const result = validateThirdPartyUri(uri);
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid: false for any string starting with http:// (non-secure)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (suffix) => {
          const uri = `http://${suffix}`;
          const result = validateThirdPartyUri(uri);
          return result.valid === false && result.error !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid: false for any string starting with data:', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (suffix) => {
          const uri = `data:${suffix}`;
          const result = validateThirdPartyUri(uri);
          return result.valid === false && result.error !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid: false for empty strings', () => {
    const result = validateThirdPartyUri('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('classifies arbitrary strings correctly: valid iff starts with https://, ./, ../, or file://', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('https://'),
          fc.constant('http://'),
          fc.constant('./'),
          fc.constant('../'),
          fc.constant('file://'),
          fc.constant('data:'),
          fc.constant('')
        ).chain((prefix) =>
          fc.string().map((suffix) => prefix + suffix)
        ),
        (uri) => {
          const result = validateThirdPartyUri(uri);
          const shouldBeValid =
            uri.startsWith('https://') ||
            uri.startsWith('./') ||
            uri.startsWith('../') ||
            uri.startsWith('file://');

          // Empty or whitespace-only strings are always invalid
          if (!uri || uri.trim().length === 0) {
            return result.valid === false;
          }

          return result.valid === shouldBeValid;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('always returns an error message when valid is false', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('http://').chain((p) => fc.string({ minLength: 1 }).map((s) => p + s)),
          fc.constant('data:').chain((p) => fc.string({ minLength: 1 }).map((s) => p + s)),
          fc.constant('ftp://').chain((p) => fc.string({ minLength: 1 }).map((s) => p + s)),
          fc.constant('mailto:').chain((p) => fc.string({ minLength: 1 }).map((s) => p + s)),
          fc.string({ minLength: 1 }).filter(
            (s) =>
              !s.startsWith('https://') &&
              !s.startsWith('./') &&
              !s.startsWith('../') &&
              !s.startsWith('file://') &&
              s.trim().length > 0
          )
        ),
        (uri) => {
          const result = validateThirdPartyUri(uri);
          return result.valid === false && typeof result.error === 'string' && result.error.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
