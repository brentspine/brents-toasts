export interface DocsTopic {
  slug: string;
  title: string;
}

/**
 * The Docs page's left-nav manifest, one entry per `docs/guide/*.md` file, in the same order
 * as `docs/guide/getting-started.md`'s own "Where to go next" list (with `getting-started`
 * itself first, since that list doesn't link back to itself). Adding a new guide page means
 * adding both a file under `docs/guide/` and an entry here - there is no directory listing to
 * discover them from, since content is fetched live from `raw.githubusercontent.com`, not
 * bundled at build time.
 */
export const DOCS_TOPICS: DocsTopic[] = [
  { slug: 'getting-started', title: 'Getting started' },
  { slug: 'buttons', title: 'Buttons' },
  { slug: 'details', title: 'Details' },
  { slug: 'lifecycle', title: 'Lifecycle' },
  { slug: 'timers', title: 'Timers' },
  { slug: 'data', title: 'Per-toast data' },
  { slug: 'progress', title: 'Progress bar' },
  { slug: 'animations', title: 'Animations' },
  { slug: 'layouts', title: 'Layouts' },
  { slug: 'config', title: 'Config' },
  { slug: 'theming', title: 'Theming' },
  { slug: 'localization', title: 'Localization' },
  { slug: 'builder-reference', title: 'ToastBuilder reference' },
];
