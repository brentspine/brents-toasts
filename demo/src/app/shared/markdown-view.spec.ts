import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MarkdownView } from './markdown-view';

describe('MarkdownView', () => {
  async function render(markdown: string, headingOffset?: number) {
    await TestBed.configureTestingModule({ imports: [MarkdownView], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(MarkdownView);
    fixture.componentRef.setInput('markdown', markdown);
    if (headingOffset !== undefined) fixture.componentRef.setInput('headingOffset', headingOffset);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the Socket Security badge (issue #35) as an <img> wrapped in a link, not raw markdown text', async () => {
    const markdown = [
      '# 2.4.8 - 2026-08-05',
      '',
      '[![Socket Security](https://badge.socket.dev/npm/package/brents-toasts/2.4.8)](https://socket.dev/npm/package/brents-toasts/overview/2.4.8)',
      '',
      'No user-facing changes in this diff.',
    ].join('\n');

    const el = await render(markdown);

    const link = el.querySelector('a[href="https://socket.dev/npm/package/brents-toasts/overview/2.4.8"]');
    expect(link).not.toBeNull();

    const img = link!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://badge.socket.dev/npm/package/brents-toasts/2.4.8');
    expect(img!.getAttribute('alt')).toBe('Socket Security');

    // The raw markdown must not leak through as literal text anywhere.
    expect(el.textContent).not.toContain('[![Socket Security]');
    expect(el.textContent).not.toContain('](https://');
  });

  it('renders a plain link and a code span correctly alongside each other', async () => {
    const el = await render('See [the docs](https://example.com) and call `showToast()`.');

    const link = el.querySelector('a[href="https://example.com"]');
    expect(link?.textContent).toBe('the docs');
    expect(el.querySelector('code')?.textContent).toBe('showToast()');
  });

  it('renders a level-1 heading as <h1> when headingOffset is 0 (the Docs page case)', async () => {
    const el = await render('# Getting started', 0);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Getting started');
  });

  it('renders the same level-1 heading as <h3> at the default offset (the changelog case)', async () => {
    const el = await render('# 2.4.8 - 2026-08-05');
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('2.4.8 - 2026-08-05');
  });

  it('renders a `ts live` fence as a runnable code block, not a static <pre>', async () => {
    const el = await render(['```ts live', "toasts.showToast('Hi');", '```'].join('\n'));
    expect(el.querySelector('app-runnable-code-block')).not.toBeNull();
    expect(el.textContent).toContain("toasts.showToast('Hi');");
  });

  it('renders a plain ts fence (no `live` flag) as a static, non-runnable <pre><code>, since most guide snippets are illustrative and do not stand alone', async () => {
    const el = await render(['```ts', "toasts.showToast('Hi');", '```'].join('\n'));
    expect(el.querySelector('app-runnable-code-block')).toBeNull();
    expect(el.querySelector('pre code')?.textContent).toBe("toasts.showToast('Hi');");
  });

  it('renders a bash fence as a static, non-runnable <pre><code>', async () => {
    const el = await render(['```bash', 'npm install brents-toasts', '```'].join('\n'));
    expect(el.querySelector('app-runnable-code-block')).toBeNull();
    expect(el.querySelector('pre code')?.textContent).toBe('npm install brents-toasts');
  });

  it('renders a GFM table as a real <table>', async () => {
    const markdown = ['| Name | Default |', '|---|---|', "| `mode` | `'drain'` |"].join('\n');
    const el = await render(markdown);
    expect(el.querySelectorAll('th').length).toBe(2);
    expect(el.querySelector('td code')?.textContent).toBe('mode');
  });

  it('rewrites a bare relative .md link into an in-app /docs route, not a raw href', async () => {
    const el = await render('See [Buttons](buttons.md) for more.', 0);
    const link = el.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/docs/buttons');
    expect(link?.textContent).toBe('Buttons');
  });

  it('gives each heading a GitHub-style slug id, so a file.md#anchor cross-link resolves', async () => {
    const el = await render('## Title mode', 0);
    expect(el.querySelector('h2')?.id).toBe('title-mode');
  });

  it('leaves an absolute https:// link alone even though it also targets a .md-like path', async () => {
    const el = await render('[docs](https://example.com/buttons.md)');
    const link = el.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/buttons.md');
    expect(link?.target).toBe('_blank');
  });
});
