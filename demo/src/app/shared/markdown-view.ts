import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { parseMarkdown, type MarkdownBlock } from './markdown';
import { RunnableCodeBlock } from './runnable-code-block';

/** `docs/guide/*.md` cross-links each other by bare relative filename, e.g. `buttons.md` or `timers.md#anchor` - never a full URL (those are always absolute https:// links, e.g. the changelog's badge). This tells the two apart so only the former gets rewritten to an in-app `/docs/:slug` route. */
const DOC_LINK = /^([\w-]+)\.md(?:#([\w-]+))?$/;
const RUNNABLE_LANGS = new Set(['ts', 'js', 'typescript', 'javascript']);

@Component({
  selector: 'app-markdown-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #segment let-seg>
      @if (seg.image) {
        @if (seg.link) {
          <a [href]="seg.link" target="_blank" rel="noopener noreferrer"
            ><img [src]="seg.image" [alt]="seg.text"
          /></a>
        } @else {
          <img [src]="seg.image" [alt]="seg.text" />
        }
      } @else if (seg.link && docLinkSlug(seg.link); as slug) {
        <a [routerLink]="['/docs', slug]" [fragment]="docLinkFragment(seg.link)">{{ seg.text }}</a>
      } @else if (seg.link) {
        <a [href]="seg.link" target="_blank" rel="noopener noreferrer">{{ seg.text }}</a>
      } @else if (seg.code) {
        <code>{{ seg.text }}</code>
      } @else if (seg.bold) {
        <strong>{{ seg.text }}</strong>
      } @else if (seg.italic) {
        <em>{{ seg.text }}</em>
      } @else {
        {{ seg.text }}
      }
    </ng-template>

    <ng-template #segments let-list>
      @for (seg of list; track $index) {
        <ng-container [ngTemplateOutlet]="segment" [ngTemplateOutletContext]="{ $implicit: seg }" />
      }
    </ng-template>

    @for (block of blocks(); track $index) {
      @switch (block.type) {
        @case ('heading') {
          @switch (headingLevel(block)) {
            @case (1) {
              <h1 [id]="headingId(block)"><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" /></h1>
            }
            @case (2) {
              <h2 [id]="headingId(block)"><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" /></h2>
            }
            @case (3) {
              <h3 [id]="headingId(block)"><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" /></h3>
            }
            @case (4) {
              <h4 [id]="headingId(block)"><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" /></h4>
            }
            @default {
              <h5 [id]="headingId(block)"><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" /></h5>
            }
          }
        }
        @case ('list') {
          <ul>
            @for (item of block.items; track $index) {
              <li><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: item }" /></li>
            }
          </ul>
        }
        @case ('paragraph') {
          <p><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" /></p>
        }
        @case ('blockquote') {
          <blockquote>
            <ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: block.segments }" />
          </blockquote>
        }
        @case ('code') {
          @if (isRunnable(block)) {
            <app-runnable-code-block [code]="block.code" />
          } @else {
            <pre><code>{{ block.code }}</code></pre>
          }
        }
        @case ('table') {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  @for (cell of block.header; track $index) {
                    <th><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: cell }" /></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of block.rows; track $index) {
                  <tr>
                    @for (cell of row; track $index) {
                      <td><ng-container [ngTemplateOutlet]="segments" [ngTemplateOutletContext]="{ $implicit: cell }" /></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    }
  `,
  imports: [NgTemplateOutlet, RouterLink, RunnableCodeBlock],
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      :host h1,
      :host h2,
      :host h3,
      :host h4,
      :host h5 {
        scroll-margin-top: 80px;
      }
      :host img {
        max-width: 100%;
        vertical-align: middle;
      }
      :host pre {
        background: var(--input, #1d2129);
        border: 1px solid var(--line, #262a31);
        border-radius: 8px;
        padding: 16px;
        overflow-x: auto;
      }
      :host blockquote {
        margin: 16px 0;
        padding: 4px 16px;
        border-left: 3px solid var(--line, #262a31);
        color: var(--muted, #9aa0a8);
      }
      :host table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      :host th,
      :host td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: 1px solid var(--line, #262a31);
        vertical-align: top;
      }
      :host .table-wrap {
        overflow-x: auto;
      }
    `,
  ],
})
export class MarkdownView {
  markdown = input.required<string>();
  /** Source `#`/`##`/`###` levels are shifted by this much before rendering (e.g. embedding a changelog entry's `#` inside a page that already has its own `<h1>`/`<h2>` chrome). Docs pages, which render a whole guide file as the page's own content, pass 0. */
  headingOffset = input(2);

  protected readonly blocks = computed(() => parseMarkdown(this.markdown()));

  protected headingLevel(block: Extract<MarkdownBlock, { type: 'heading' }>): number {
    return Math.min(block.level + this.headingOffset(), 5);
  }

  /** GitHub's own heading-anchor slugify rules, so a `file.md#anchor` cross-link (written to work when the file is read directly on GitHub) also resolves to the right in-app scroll target. */
  protected headingId(block: Extract<MarkdownBlock, { type: 'heading' }>): string {
    return block.segments
      .map((s) => s.text)
      .join('')
      .toLowerCase()
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '-');
  }

  /** Only a fence explicitly marked ` live` (see `markdown.ts`'s parser) gets the Run/Open in Playground buttons - most `docs/guide/*.md` snippets are illustrative and don't actually execute standalone (undefined helper functions, code that continues from a separate example above it, ...), so showing "Run" on every fence would just promise something that errors. */
  protected isRunnable(block: Extract<MarkdownBlock, { type: 'code' }>): boolean {
    return block.live && RUNNABLE_LANGS.has(block.lang.toLowerCase());
  }

  protected docLinkSlug(link: string): string | null {
    return DOC_LINK.exec(link)?.[1] ?? null;
  }

  protected docLinkFragment(link: string): string | undefined {
    return DOC_LINK.exec(link)?.[2];
  }
}
