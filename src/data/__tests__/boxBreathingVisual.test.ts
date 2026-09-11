/**
 * Guards the Box Breathing visual aid (spec 1.0.4-tool-visual-aids).
 *
 * The curated card must carry the code-drawn breathing pacer AND keep its
 * textual steps (the visual complements, not replaces, the instructions).
 *
 * Validates: Requirements 1.1, 1.4
 */

import { CURATED_LIBRARY } from '@/data/curatedLibrary';

describe('lib-box-breathing visual aid', () => {
  const card = CURATED_LIBRARY.find((c) => c.id === 'lib-box-breathing');

  it('exists in the curated library', () => {
    expect(card).toBeDefined();
  });

  it('includes a breathing_animation control (4-4-4-4)', () => {
    const anim = card!.controls.find((c) => c.type === 'breathing_animation');
    expect(anim).toBeDefined();
    expect((anim!.config as { pattern: string }).pattern).toBe('4-4-4-4');
  });

  it('keeps the static_text steps (accessibility fallback)', () => {
    const steps = card!.controls.find((c) => c.type === 'static_text');
    expect(steps).toBeDefined();
    const body = (steps!.config as { body: string }).body;
    expect(body).toContain('Breathe IN');
    expect(body).toContain('HOLD');
    expect(body).toContain('Breathe OUT');
  });

  it('renders the visual below the steps (read instructions first, then scroll)', () => {
    const anim = card!.controls.find((c) => c.type === 'breathing_animation')!;
    const steps = card!.controls.find((c) => c.type === 'static_text')!;
    expect(steps.position).toBeLessThan(anim.position);
  });
});
