/**
 * Minimal changelog-markdown parser, deliberately handles only the subset
 * `scripts/generate-changelog.js` actually produces: `#`/`##` headings,
 * `- ` bullet lists, plain paragraphs, and `` `code` `` spans. Returns a plain
 * block AST instead of an HTML string so templates render it with @for/@if
 * (no innerHTML, nothing to sanitize).
 */

export interface InlineSegment {
  text: string;
  code: boolean;
}

export type MarkdownBlock =
  | { type: 'heading'; level: 3 | 4; segments: InlineSegment[] }
  | { type: 'list'; items: InlineSegment[][] }
  | { type: 'paragraph'; segments: InlineSegment[] };

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const parts = text.split('`');
  parts.forEach((part, i) => {
    if (part === '') return;
    segments.push({ text: part, code: i % 2 === 1 });
  });
  return segments;
}

export function parseChangelogMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 4, segments: parseInline(trimmed.slice(3)) });
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 3, segments: parseInline(trimmed.slice(2)) });
      i++;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const items: InlineSegment[][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('- ')) {
        items.push(parseInline((lines[i] ?? '').trim().slice(2)));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    blocks.push({ type: 'paragraph', segments: parseInline(trimmed) });
    i++;
  }

  return blocks;
}
