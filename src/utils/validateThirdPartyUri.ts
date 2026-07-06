/**
 * Validates a third-party icon URI.
 *
 * Accepts:
 * - HTTPS URLs (starting with "https://")
 * - Local asset paths (starting with "./", "../", or "file://")
 *
 * Rejects:
 * - Empty strings
 * - HTTP URLs (non-secure)
 * - Data URIs
 * - Any other scheme or format
 */

export interface ValidateThirdPartyUriResult {
  valid: boolean;
  error?: string;
}

export function validateThirdPartyUri(uri: string): ValidateThirdPartyUriResult {
  if (!uri || uri.trim().length === 0) {
    return { valid: false, error: 'URI must not be empty.' };
  }

  // Accept HTTPS URLs
  if (uri.startsWith('https://')) {
    return { valid: true };
  }

  // Accept local asset paths: relative paths or file:// protocol
  if (uri.startsWith('./') || uri.startsWith('../') || uri.startsWith('file://')) {
    return { valid: true };
  }

  // Reject data URIs with specific message
  if (uri.startsWith('data:')) {
    return { valid: false, error: 'Data URIs are not allowed. URI must use HTTPS or reference a local asset.' };
  }

  // Reject http:// with specific message
  if (uri.startsWith('http://')) {
    return { valid: false, error: 'HTTP is not allowed. URI must use HTTPS or reference a local asset.' };
  }

  // Reject everything else
  return { valid: false, error: 'URI must use HTTPS or reference a local asset path (./,  ../, or file://).' };
}
