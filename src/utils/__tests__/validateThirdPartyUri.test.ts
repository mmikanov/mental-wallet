/**
 * Unit tests for validateThirdPartyUri utility.
 *
 * Validates: Requirements 4.7, 4.8
 */

import { validateThirdPartyUri } from '../validateThirdPartyUri';

describe('validateThirdPartyUri', () => {
  // --- Requirement 4.7: Accepts HTTPS and local asset paths ---
  describe('accepts valid URIs', () => {
    it('accepts HTTPS URL', () => {
      const result = validateThirdPartyUri('https://example.com/logo.png');
      expect(result).toEqual({ valid: true });
    });

    it('accepts HTTPS URL with path and query params', () => {
      const result = validateThirdPartyUri('https://cdn.brand.io/assets/logo.png?v=2');
      expect(result).toEqual({ valid: true });
    });

    it('accepts relative path starting with ./', () => {
      const result = validateThirdPartyUri('./assets/icon.png');
      expect(result).toEqual({ valid: true });
    });

    it('accepts relative path starting with ../', () => {
      const result = validateThirdPartyUri('../shared/brand-logo.png');
      expect(result).toEqual({ valid: true });
    });

    it('accepts file:// protocol URI', () => {
      const result = validateThirdPartyUri('file:///data/local/brand.png');
      expect(result).toEqual({ valid: true });
    });
  });

  // --- Requirement 4.8: Rejects invalid URIs ---
  describe('rejects invalid URIs', () => {
    it('rejects empty string', () => {
      const result = validateThirdPartyUri('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects whitespace-only string', () => {
      const result = validateThirdPartyUri('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects http:// (non-secure)', () => {
      const result = validateThirdPartyUri('http://example.com/logo.png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('rejects data: URIs', () => {
      const result = validateThirdPartyUri('data:image/png;base64,abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Data URI');
    });

    it('rejects ftp:// scheme', () => {
      const result = validateThirdPartyUri('ftp://files.example.com/logo.png');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects javascript: scheme', () => {
      const result = validateThirdPartyUri('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects plain text without scheme', () => {
      const result = validateThirdPartyUri('just-a-string');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
