import { describe, expect, it } from 'vitest';
import { parseMarkdown, parseInline } from './markdown';

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

describe('parseMarkdown', () => {
  it('parses the exact shape scripts/generate-changelog.js produces', () => {
    const markdown = ['# 2.2.4 - 2026-07-24', '', '## Added', '', '- `theme` option for `showToast()`', '- Second item'].join(
      '\n',
    );

    const blocks = parseMarkdown(markdown);

    expect(blocks).toEqual([
      { type: 'heading', level: 1, segments: [{ text: '2.2.4 - 2026-07-24', code: false }] },
      { type: 'heading', level: 2, segments: [{ text: 'Added', code: false }] },
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
    expect(parseMarkdown('Just a plain line.')).toEqual([
      { type: 'paragraph', segments: [{ text: 'Just a plain line.', code: false }] },
    ]);
  });

  it('ignores blank lines between blocks', () => {
    const blocks = parseMarkdown('# Title\n\n\nParagraph.');
    expect(blocks).toHaveLength(2);
  });

  it('parses a level-3 heading', () => {
    expect(parseMarkdown('### Timeout')).toEqual([
      { type: 'heading', level: 3, segments: [{ text: 'Timeout', code: false }] },
    ]);
  });

  it('parses a fenced code block, keeping its language and body verbatim', () => {
    const markdown = ['```ts', "toasts.showToast('Hi');", "toasts.showToast('Bye');", '```'].join('\n');
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'code', lang: 'ts', live: false, code: "toasts.showToast('Hi');\ntoasts.showToast('Bye');" },
    ]);
  });

  it('parses a fenced code block with no language tag', () => {
    expect(parseMarkdown('```\nplain\n```')).toEqual([{ type: 'code', lang: '', live: false, code: 'plain' }]);
  });

  it('marks a fence live when its info string has a trailing `live` flag', () => {
    const markdown = ['```ts live', "toasts.showToast('Hi');", '```'].join('\n');
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'code', lang: 'ts', live: true, code: "toasts.showToast('Hi');" },
    ]);
  });

  it('parses a GFM table into a header + rows, with inline formatting per cell', () => {
    const markdown = ['| Name | Default |', '|---|---|', "| `mode` | `'drain'` |"].join('\n');
    expect(parseMarkdown(markdown)).toEqual([
      {
        type: 'table',
        header: [[{ text: 'Name', code: false }], [{ text: 'Default', code: false }]],
        rows: [[[{ text: 'mode', code: true }], [{ text: "'drain'", code: true }]]],
      },
    ]);
  });

  it('parses a multi-line blockquote into one block, joined with spaces', () => {
    const markdown = ['> **Warning.** Line one', '> line two.'].join('\n');
    expect(parseMarkdown(markdown)).toEqual([
      {
        type: 'blockquote',
        segments: [
          { text: 'Warning.', code: false, bold: true },
          { text: ' Line one line two.', code: false },
        ],
      },
    ]);
  });
});

describe('parseInline bold/italic', () => {
  it('marks double-asterisk text as bold', () => {
    expect(parseInline('this is **bold** text')).toEqual([
      { text: 'this is ', code: false },
      { text: 'bold', code: false, bold: true },
      { text: ' text', code: false },
    ]);
  });

  it('marks single-asterisk text as italic', () => {
    expect(parseInline('this is *italic* text')).toEqual([
      { text: 'this is ', code: false },
      { text: 'italic', code: false, italic: true },
      { text: ' text', code: false },
    ]);
  });
});
