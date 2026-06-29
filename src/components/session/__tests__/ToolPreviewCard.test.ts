/**
 * Unit tests for ToolPreviewCard's truncateDescription utility.
 */

import { truncateDescription } from '../ToolPreviewCard';

describe('truncateDescription', () => {
  it('returns the full string when it is at or below 80 characters', () => {
    const text = 'A short description.';
    expect(truncateDescription(text)).toBe(text);
  });

  it('returns the full string when exactly 80 characters', () => {
    const text = 'A'.repeat(80);
    expect(truncateDescription(text)).toBe(text);
  });

  it('truncates to 77 chars + "..." when the string exceeds 80 characters', () => {
    const text = 'A'.repeat(100);
    const result = truncateDescription(text);
    expect(result.length).toBe(80);
    expect(result).toBe('A'.repeat(77) + '...');
  });

  it('handles empty string without truncation', () => {
    expect(truncateDescription('')).toBe('');
  });

  it('respects custom maxLength parameter', () => {
    const text = 'Hello World, this is a longer sentence that needs truncation.';
    const result = truncateDescription(text, 20);
    expect(result.length).toBe(20);
    expect(result).toBe('Hello World, this...');
  });

  it('does not truncate when string length equals maxLength', () => {
    const text = 'Exactly ten!'; // 12 chars
    expect(truncateDescription(text, 12)).toBe(text);
  });

  it('truncates at exactly maxLength - 3 and appends "..."', () => {
    const text = 'This is a description that is exactly 81 characters long for testing the boundar';
    // 80 chars - should not truncate
    expect(truncateDescription(text)).toBe(text);

    const longerText = text + 'y';
    // 81 chars - should truncate to 77 + ...
    const result = truncateDescription(longerText);
    expect(result.length).toBe(80);
    expect(result.endsWith('...')).toBe(true);
  });
});
