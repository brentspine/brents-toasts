/**
 * Minimal changelog-markdown parser, deliberately handles only the subset
 * `scripts/generate-changelog.js` actually produces: `#`/`##` headings,
 * `- ` bullet lists, plain paragraphs, `` `code` `` spans, and the
 * `[![alt](img)](link)`-style badge (plus plain `![alt](img)`/`[text](link)`)
 * that script always prepends as the Socket Security badge. Returns a plain
 * block AST instead of an HTML string so templates render it with @for/@if
 * (no innerHTML, nothing to sanitize).
 */

export interface InlineSegment {
  text: string;
  code: boolean;
  link?: string;
  image?: string;
}

const INLINE_TOKEN =
  /`([^`]*)`|\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+)\)/g;

export type MarkdownBlock =
  | { type: 'heading'; level: 3 | 4; segments: InlineSegment[] }
  | { type: 'list'; items: InlineSegment[][] }
  | { type: 'paragraph'; segments: InlineSegment[] };

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  INLINE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_TOKEN.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), code: false });
    }

    const [, code, badgeAlt, badgeSrc, badgeHref, imageAlt, imageSrc, linkText, linkHref] = match;
    if (code !== undefined) {
      segments.push({ text: code, code: true });
    } else if (badgeAlt !== undefined) {
      segments.push({ text: badgeAlt, code: false, image: badgeSrc, link: badgeHref });
    } else if (imageAlt !== undefined) {
      segments.push({ text: imageAlt, code: false, image: imageSrc });
    } else {
      segments.push({ text: linkText ?? '', code: false, link: linkHref });
    }

    lastIndex = INLINE_TOKEN.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), code: false });
  }

  return segments.filter((s) => s.text !== '' || s.image !== undefined);
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
