const REPO = 'brentspine/brents-toasts';

/**
 * Builds a GitHub "New issue" URL pre-filled from `.github/ISSUE_TEMPLATE/example_suggestion.yml`
 * for a locally-saved Playground snippet the user wants to suggest as a curated example (see
 * https://github.com/brentspine/brents-toasts/issues/123). GitHub pre-fills an issue form field
 * whose `id` matches a query parameter of the same name - keep these keys in sync with that
 * template's field ids.
 */
export function buildSuggestExampleUrl(name: string, code: string): string {
  const params = new URLSearchParams({
    template: 'example_suggestion.yml',
    title: `[Example]: ${name}`,
    'example-title': name,
    'example-code': code,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}
