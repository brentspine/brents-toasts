import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MarkdownView } from './markdown-view';

describe('MarkdownView', () => {
  async function render(markdown: string) {
    await TestBed.configureTestingModule({ imports: [MarkdownView] }).compileComponents();
    const fixture = TestBed.createComponent(MarkdownView);
    fixture.componentRef.setInput('markdown', markdown);
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
});
