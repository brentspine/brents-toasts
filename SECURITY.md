# Security Policy

## Supported versions

`brents-toasts` doesn't maintain backport branches - see
[RELEASING.md](RELEASING.md) for how releases work. The latest version
published on npm always gets security fixes. Older versions will often get a
fix too if it's feasible, but that's not guaranteed. If you're on an older
version, upgrade before reporting; the issue may already be fixed.

## Reporting a vulnerability

Don't open a public GitHub issue for a vulnerability. Report it privately
instead, either through GitHub's own advisory flow at
https://github.com/brentspine/brents-toasts/security/advisories/new, or by
emailing me@brentspine.de with a description and, if you have one, a minimal
reproduction.

This is a one-person project, so there's no fixed response time, but reports
usually get a reply within a few days. If you haven't heard back after a few
days, follow up - it's more likely the report got missed than ignored. Once a
fix ships, it'll be in the next release's changelog, and you'll be credited
there unless you'd rather stay anonymous.

## Scope

`brents-toasts` is a client-side library with no runtime dependencies, so the
main risk category is XSS. The `docs/guide/*.md` pages and the "XSS surface"
note in CLAUDE.md describe the boundary the library relies on: plain-text
`message`/`title`/button labels are never parsed as HTML, and HTML rendering
only happens when a caller opts in with `allowHtml: true`. If you can get
script execution without that opt-in, or get past sanitization when it is
set, that's a real report.

The `demo/` app and its GitHub Pages deployment are out of scope unless the
same issue reproduces in the library itself.
