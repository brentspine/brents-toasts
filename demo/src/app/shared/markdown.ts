/**
 * Minimal markdown parser, deliberately handling only the subset the repo's own markdown
 * actually uses: `#`/`##`/`###` headings, `- ` bullet lists, blockquotes (`> `), fenced code
 * blocks, GFM-style tables, plain paragraphs, `` `code` ``/`**bold**`/`*italic*` inline spans,
 * and the `[![alt](img)](link)`-style badge (plus plain `![alt](img)`/`[text](link)`) that
 * `scripts/generate-changelog.js` prepends as the Socket Security badge. Originally
 * changelog-only; also used to render `docs/guide/*.md` on the Docs page, which is why fenced
 * code/tables/blockquotes/emphasis were added. Returns a plain block AST instead of an HTML
 * string so templates render it with @for/@if (no innerHTML, nothing to sanitize).
 */

export interface InlineSegment {
  text: string;
  code: boolean;
  bold?: boolean;
  italic?: boolean;
  link?: string;
  image?: string;
}

const INLINE_TOKEN =
  /`([^`]*)`|\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]*)\]\(([^)]+)\)/g;

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; segments: InlineSegment[] }
  | { type: 'list'; items: InlineSegment[][] }
  | { type: 'paragraph'; segments: InlineSegment[] }
  | { type: 'blockquote'; segments: InlineSegment[] }
  | { type: 'code'; lang: string; live: boolean; code: string }
  | { type: 'table'; header: InlineSegment[][]; rows: InlineSegment[][][] };

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  INLINE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_TOKEN.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), code: false });
    }

    const [, code, badgeAlt, badgeSrc, badgeHref, imageAlt, imageSrc, bold, italic, linkText, linkHref] = match;
    if (code !== undefined) {
      segments.push({ text: code, code: true });
    } else if (badgeAlt !== undefined) {
      segments.push({ text: badgeAlt, code: false, image: badgeSrc, link: badgeHref });
    } else if (imageAlt !== undefined) {
      segments.push({ text: imageAlt, code: false, image: imageSrc });
    } else if (bold !== undefined) {
      segments.push({ text: bold, code: false, bold: true });
    } else if (italic !== undefined) {
      segments.push({ text: italic, code: false, italic: true });
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

/** Splits a `| a | b |` row into raw (unparsed) cell strings. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

/** Whether `line` continues the paragraph in progress rather than starting (or being) a new block. */
function isPlainContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return false;
  return !(
    trimmed.startsWith('#') ||
    trimmed.startsWith('- ') ||
    trimmed.startsWith('> ') ||
    trimmed === '>' ||
    trimmed.startsWith('```') ||
    trimmed.startsWith('|')
  );
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
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

    if (trimmed.startsWith('```')) {
      // The fence's info string is `<lang>` or `<lang> live` - `live` opts this specific
      // block into the Docs page's Run/Open in Playground buttons (see MarkdownView); most
      // fences are illustrative snippets that don't stand alone (undefined helper functions,
      // continuation code relying on an earlier example's variable, ...) and must stay plain.
      const [lang = '', ...flags] = trimmed.slice(3).trim().split(/\s+/);
      const live = flags.includes('live');
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && (lines[i] ?? '').trim() !== '```') {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: 'code', lang, live, code: codeLines.join('\n') });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, segments: parseInline(trimmed.slice(4)) });
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, segments: parseInline(trimmed.slice(3)) });
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 1, segments: parseInline(trimmed.slice(2)) });
      i++;
      continue;
    }

    if (trimmed.startsWith('> ') || trimmed === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && ((lines[i] ?? '').trim().startsWith('>') || (lines[i] ?? '').trim() === '')) {
        const qLine = (lines[i] ?? '').trim();
        if (qLine === '') break;
        quoteLines.push(qLine.replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', segments: parseInline(quoteLines.join(' ')) });
      continue;
    }

    if (trimmed.startsWith('|') && TABLE_SEPARATOR.test((lines[i + 1] ?? '').trim())) {
      const header = splitTableRow(trimmed).map(parseInline);
      i += 2; // header + separator row
      const rows: InlineSegment[][][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(splitTableRow((lines[i] ?? '').trim()).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
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

    // Soft-wrapped prose: docs/guide/*.md wraps a single paragraph across many source lines
    // (unlike the changelog's one-line-per-entry shape this parser originally handled), so
    // consecutive plain lines must be joined into one paragraph, not one block per line.
    const paragraphLines: string[] = [trimmed];
    i++;
    while (i < lines.length && isPlainContinuationLine(lines[i] ?? '')) {
      paragraphLines.push((lines[i] ?? '').trim());
      i++;
    }
    blocks.push({ type: 'paragraph', segments: parseInline(paragraphLines.join(' ')) });
  }

  return blocks;
}
