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
