import { describe, expect, it } from 'vitest';
import { buildSuggestExampleUrl } from './github-suggest';

describe('buildSuggestExampleUrl', () => {
  it('points at the example_suggestion.yml issue template with title/example-title/example-code prefilled', () => {
    const url = buildSuggestExampleUrl('Retry with backoff', 'new ToastBuilder("Hi").show();');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://github.com/brentspine/brents-toasts/issues/new');
    expect(parsed.searchParams.get('template')).toBe('example_suggestion.yml');
    expect(parsed.searchParams.get('title')).toBe('[Example]: Retry with backoff');
    expect(parsed.searchParams.get('example-title')).toBe('Retry with backoff');
    expect(parsed.searchParams.get('example-code')).toBe('new ToastBuilder("Hi").show();');
  });

  it('percent-encodes special characters in the name and code', () => {
    const url = buildSuggestExampleUrl('A & B', 'toasts.showToast("100% done!");');
    const parsed = new URL(url);

    expect(parsed.searchParams.get('example-title')).toBe('A & B');
    expect(parsed.searchParams.get('example-code')).toBe('toasts.showToast("100% done!");');
    expect(url).not.toContain(' ');
  });
});
