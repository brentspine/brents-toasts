# brents-toasts

[![npm version](https://img.shields.io/npm/v/brents-toasts.svg?style=for-the-badge)](https://www.npmjs.com/package/brents-toasts)
[![npm downloads](https://img.shields.io/npm/dm/brents-toasts.svg?label=%E2%8F%ACdownloads&style=for-the-badge)](https://www.npmjs.com/package/brents-toasts)
[![coverage](https://img.shields.io/codecov/c/github/brentspine/brents-toasts.svg?style=for-the-badge)](https://codecov.io/gh/brentspine/brents-toasts)
[![Socket Security](https://badge.socket.dev/npm/package/brents-toasts/latest)](https://socket.dev/npm/package/brents-toasts/overview/latest)

A simple drop-in vanilla and beginner friendly toast system

Demo live under: https://brentspine.github.io/brents-toasts/<br>
<!-- Permalink for v1.0: https://brentspine.github.io/brents-toasts/toasts-1.0.js -->

This is a rewrite of an old optimistic previous attempt, that I used on various projects: https://github.com/brentspine/tinder-but-for-horses/blob/main/scripts/toasts.js

<!-- Demo video: TODO - embed a short usage clip here once one exists. -->

## Install

**npm** ![recommended](https://img.shields.io/badge/-recommended-2ea44f?style=flat-square)

```bash
npm install brents-toasts
```

```ts
import { toasts, ToastColor, ToastBuilder } from 'brents-toasts';
```

**yarn** - same package, if you'd rather use yarn instead of npm:

```bash
yarn add brents-toasts
```

**CDN / script tag** ![recommended](https://img.shields.io/badge/-recommended-2ea44f?style=flat-square)

No build step, no module system required - served via [jsDelivr](https://www.jsdelivr.com/):

```html
<script src="https://cdn.jsdelivr.net/npm/brents-toasts/dist/index.umd.min.js"></script>
<script>
  BrentsToasts.toasts.showToast('Hello, toast.');
</script>
```

Prefer [unpkg](https://unpkg.com/brents-toasts/dist/index.umd.min.js) instead? Same UMD build, works as a drop-in alternative:

```html
<script src="https://unpkg.com/brents-toasts/dist/index.umd.min.js"></script>
```

## Quick start

```ts
toasts.showToast('Saved!', { color: ToastColor.SUCCESS, title: 'Done' });

// or the fluent builder - same options under the hood
new ToastBuilder('Saved!').asSuccess().withTitle('Done').show();
```

Full walkthrough, including the other supported call shapes: [Getting started](docs/guide/getting-started.md).

## Features

- **[Buttons](docs/guide/buttons.md)** - plain action buttons, a ready-made close button, and a confirm-before-action button with its own pending/done states.
- **[Multi-step buttons](docs/guide/buttons.md#multi-step-buttons)** - the general-purpose state machine behind confirm/copy buttons, for your own custom multi-click flows.
- **[Details](docs/guide/details.md)** - expandable, copyable extra info attached to a toast without cluttering the main message.
- **[Lifecycle](docs/guide/lifecycle.md)** - remove/update toasts in place, animate an update with a transition, or tie a toast to a `Promise`'s loading/success/error states.
- **[Timers](docs/guide/timers.md)** - pause/resume/reset/extend a toast's auto-dismiss countdown, or read it back live.
- **[Per-toast data](docs/guide/data.md)** - attach a payload to a toast so one shared button handler can act on many toasts.
- **[Progress bar](docs/guide/progress.md)** - a thin bar synced to the auto-dismiss countdown, or driven manually for real progress.
- **[Animations](docs/guide/animations.md)** - a pluggable entrance/exit/reflow engine (slide/fade/none built in, register your own).
- **[Config](docs/guide/config.md)** - library-wide or page-scoped defaults, six stacking positions, per-position capacity limits, responsive collapsing on narrow screens, and independent opt-outs for the toast card's look (`injectStyles: false`) and its positioning/stacking CSS (`injectLayoutStyles: false`), for a custom design system or a strict CSP.
- **[Theming](docs/guide/theming.md)** - every color is a CSS custom property, overridable per-toast or library-wide, with automatic close-icon contrast.
- **[Icons](docs/guide/icons.md)** - opt-in icon rendered next to the message: built-in severity icons, an image URL, a CSS class, a custom `Node`, or your own renderer function, plus automatic pending/success/error icons for `promise()`.
- **[Localization](docs/guide/localization.md)** - built-in `en`/`de`/`es`/`fr` chrome text with custom overrides, plus a standalone pre-translated action-word utility.

TypeScript-first: full `.d.ts` types ship with every build, documented via JSDoc - your editor's hover/autocomplete covers most of the day-to-day API on its own.

## Documentation

- **[docs/guide/](docs/guide/)** - the full guide, one topic per page (linked above).
- **[Live demo & playground](https://brentspine.github.io/brents-toasts/)** - try every option interactively and copy the generated code.
- **[Claude Skill](docs/SKILL.md)** - accurate, hallucination-resistant guidance for AI agents writing code against this library. Install as a Claude Code plugin: `/plugin marketplace add brentspine/brents-toasts` then `/plugin install brents-toasts@brents-toasts`. No install step needed either - copy `docs/` into your own project's `.claude/skills/brents-toasts/` for the same effect.
- **[Changelogs](docs/changelogs/)** and **[GitHub Releases](https://github.com/brentspine/brents-toasts/releases)** - what changed in each version.
<!-- - **[ROADMAP.md](ROADMAP.md)** - design history and what's planned. -->

## License

Apache-2.0

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
