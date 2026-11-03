/**
 * Unit tests for stripHtmlBlocks — removing embedded raw HTML from a tip body before native
 * markdown rendering (Bug 1 follow-up, 1.0.6). Guards the regression where <figure>/<div>/<img>
 * blocks leaked into the app as literal angle-bracket text.
 */

import { stripHtmlBlocks } from '@/services/tipBodyForNative';

describe('stripHtmlBlocks', () => {
  it('removes a whole <figure class="tip-media"> block and its contents', () => {
    const body = [
      'Add the apps you already use.',
      '',
      '<figure class="tip-media">',
      '  <img src="https://x/assets/tip-media/discover-third-party-apps.gif" width="240" alt="Browsing the library." />',
      '  <figcaption>Add the apps you already use, and launch them from your wallet.</figcaption>',
      '</figure>',
      '',
      'So you can have both.',
    ].join('\n');

    const out = stripHtmlBlocks(body);

    expect(out).toContain('Add the apps you already use.');
    expect(out).toContain('So you can have both.');
    // No HTML leaks through.
    expect(out).not.toMatch(/<figure/);
    expect(out).not.toMatch(/<img/);
    expect(out).not.toMatch(/<figcaption/);
    expect(out).not.toMatch(/<\/figure>/);
    // The figcaption text (inside the removed block) is gone too.
    expect(out).not.toContain('launch them from your wallet');
  });

  it('removes a come-back-anim <figure> with nested animation <div>s', () => {
    const body = [
      'If right now is a good moment, open your wallet.',
      '',
      '<figure class="come-back-anim" role="img" aria-label="A quiet wallet with one calm tool card.">',
      '  <div class="come-back-anim__stage">',
      '    <div class="come-back-anim__ghost come-back-anim__ghost--a"></div>',
      '    <div class="come-back-anim__card">',
      '      <div class="come-back-anim__row"></div>',
      '    </div>',
      '  </div>',
      '</figure>',
      '',
      'This email needs nothing from you.',
    ].join('\n');

    const out = stripHtmlBlocks(body);

    expect(out).toContain('If right now is a good moment, open your wallet.');
    expect(out).toContain('This email needs nothing from you.');
    expect(out).not.toMatch(/<figure/);
    expect(out).not.toMatch(/<div/);
    expect(out).not.toMatch(/come-back-anim/);
  });

  it('keeps markdown prose, headings, lists, bold, and markdown links intact', () => {
    const body = [
      '# Build your own tool',
      '',
      'Open the menu and choose **Create Tool**. Each block is a piece:',
      '',
      '- a Text Input for writing',
      '- a Mood Slider to rate how you feel',
      '',
      'See [the guide](https://example.test/guide) for more.',
    ].join('\n');

    const out = stripHtmlBlocks(body);

    expect(out).toContain('# Build your own tool');
    expect(out).toContain('**Create Tool**');
    expect(out).toContain('- a Text Input for writing');
    expect(out).toContain('[the guide](https://example.test/guide)');
    // A markdown link is NOT an HTML tag — must not be stripped.
    expect(out).toContain('(https://example.test/guide)');
  });

  it('strips a stray inline tag but keeps its inner text', () => {
    const body = 'Here is <span class="hl">highlighted</span> and <a href="https://x">a link</a> text.';
    const out = stripHtmlBlocks(body);
    expect(out).toContain('highlighted');
    expect(out).toContain('a link');
    expect(out).not.toMatch(/<span/);
    expect(out).not.toMatch(/<a /);
    expect(out).not.toMatch(/<\/a>/);
  });

  it('removes a bare self-closing <img> outside any figure', () => {
    const body = 'Before.\n\n<img src="https://x/a.png" alt="x" />\n\nAfter.';
    const out = stripHtmlBlocks(body);
    expect(out).toContain('Before.');
    expect(out).toContain('After.');
    expect(out).not.toMatch(/<img/);
  });

  it('collapses the blank-line gaps left by removed blocks', () => {
    const body = 'Para one.\n\n<figure class="tip-media">\n<img src="x" />\n</figure>\n\nPara two.';
    const out = stripHtmlBlocks(body);
    // No run of 3+ newlines remains.
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).toContain('Para one.');
    expect(out).toContain('Para two.');
  });

  it('returns empty string for empty/undefined-ish input', () => {
    expect(stripHtmlBlocks('')).toBe('');
  });

  it('leaves a plain prose body unchanged (aside from trim)', () => {
    const body = 'Just two sentences. No HTML here at all.';
    expect(stripHtmlBlocks(body)).toBe('Just two sentences. No HTML here at all.');
  });
});
