import { describe, expect, it } from 'vitest';
import { parseChangelogMarkdown, parseInline } from './markdown';

describe('parseInline', () => {
  it('splits plain text with no code spans into a single segment', () => {
    expect(parseInline('hello world')).toEqual([{ text: 'hello world', code: false }]);
  });

  it('marks backtick-delimited text as code', () => {
    expect(parseInline('call `showToast()` to show a toast')).toEqual([
      { text: 'call ', code: false },
      { text: 'showToast()', code: true },
      { text: ' to show a toast', code: false },
    ]);
  });

  it('parses a link-wrapped image (the Socket Security badge shape) into one segment', () => {
    const badge =
      '[![Socket Security](https://badge.socket.dev/npm/package/brents-toasts/2.4.8)](https://socket.dev/npm/package/brents-toasts/overview/2.4.8)';

    expect(parseInline(badge)).toEqual([
      {
        text: 'Socket Security',
        code: false,
        image: 'https://badge.socket.dev/npm/package/brents-toasts/2.4.8',
        link: 'https://socket.dev/npm/package/brents-toasts/overview/2.4.8',
      },
    ]);
  });

  it('parses a plain image', () => {
    expect(parseInline('![alt text](https://example.com/img.png)')).toEqual([
      { text: 'alt text', code: false, image: 'https://example.com/img.png' },
    ]);
  });

  it('parses a plain link', () => {
    expect(parseInline('see [the docs](https://example.com) for more')).toEqual([
      { text: 'see ', code: false },
      { text: 'the docs', code: false, link: 'https://example.com' },
      { text: ' for more', code: false },
    ]);
  });
});

describe('parseChangelogMarkdown', () => {
  it('parses the exact shape scripts/generate-changelog.js produces', () => {
    const markdown = ['# 2.2.4 - 2026-07-24', '', '## Added', '', '- `theme` option for `showToast()`', '- Second item'].join(
      '\n',
    );

    const blocks = parseChangelogMarkdown(markdown);

    expect(blocks).toEqual([
      { type: 'heading', level: 3, segments: [{ text: '2.2.4 - 2026-07-24', code: false }] },
      { type: 'heading', level: 4, segments: [{ text: 'Added', code: false }] },
      {
        type: 'list',
        items: [
          [
            { text: 'theme', code: true },
            { text: ' option for ', code: false },
            { text: 'showToast()', code: true },
          ],
          [{ text: 'Second item', code: false }],
        ],
      },
    ]);
  });

  it('treats a non-heading, non-list line as a paragraph', () => {
    expect(parseChangelogMarkdown('Just a plain line.')).toEqual([
      { type: 'paragraph', segments: [{ text: 'Just a plain line.', code: false }] },
    ]);
  });

  it('ignores blank lines between blocks', () => {
    const blocks = parseChangelogMarkdown('# Title\n\n\nParagraph.');
    expect(blocks).toHaveLength(2);
  });
});
