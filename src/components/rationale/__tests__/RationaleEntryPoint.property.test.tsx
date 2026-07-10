/**
 * Property-based tests for RationaleEntryPoint component.
 *
 * Feature: tool-rationale-evidence, Property 5: Entry point visibility derives from in_a_nutshell content
 *
 * **Validates: Requirements 2.1, 2.2**
 */

import React from 'react';
import * as fc from 'fast-check';
import { render } from '@testing-library/react-native';
import { RationaleEntryPoint } from '../RationaleEntryPoint';

// Feature: tool-rationale-evidence, Property 5: Entry point visibility derives from in_a_nutshell content
describe('Property 5: Entry point visibility derives from in_a_nutshell content', () => {
  const noopOnPress = () => {};

  // Generate whitespace-only strings (including empty string)
  const whitespaceArb = fc.stringOf(
    fc.constantFrom(' ', '\t', '\n', '\r'),
    { minLength: 0, maxLength: 50 }
  );

  // Generate strings with at least one non-whitespace character
  const nonEmptyArb = fc
    .string({ minLength: 1 })
    .filter((s) => s.trim().length > 0);

  it('renders null for any string that is empty or whitespace-only', async () => {
    await fc.assert(
      fc.asyncProperty(whitespaceArb, async (whitespaceStr) => {
        const { toJSON } = await render(
          <RationaleEntryPoint inANutshell={whitespaceStr} onPress={noopOnPress} />
        );
        expect(toJSON()).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('renders null when inANutshell is undefined', async () => {
    const { toJSON } = await render(
      <RationaleEntryPoint inANutshell={undefined} onPress={noopOnPress} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders a truthy element for any string with at least one non-whitespace character', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyArb, async (nonEmptyStr) => {
        const { toJSON } = await render(
          <RationaleEntryPoint inANutshell={nonEmptyStr} onPress={noopOnPress} />
        );
        expect(toJSON()).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
