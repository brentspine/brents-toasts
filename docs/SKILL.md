---
name: brents-toasts
description: Write correct code against brents-toasts, a zero-dependency toast/snackbar UI library for JavaScript/TypeScript. Covers install, the showToast/ToastBuilder call shapes, buttons (plain/confirm/multi-step), details, updating/removing toasts, promise-based toasts, timers, progress bars, animations, theming, localization, and config. Use whenever a task involves adding, changing, or debugging toast/snackbar notifications built with brents-toasts (imports from `brents-toasts`, or `BrentsToasts.*` on a page using the UMD script tag).
---

# brents-toasts

Distributed as a Claude Code plugin: `/plugin marketplace add brentspine/brents-toasts` then
`/plugin install brents-toasts@brents-toasts`. To install by hand instead, copy this whole
`docs/` directory (not just this file) to a project's `.claude/skills/brents-toasts/` - the
links below are relative to files that travel with it either way, so both installs stay useful.

Zero-dependency, framework-agnostic toast/snackbar library. Works as an ESM/CJS import or a
plain `<script>` tag (UMD, global `BrentsToasts`). No CSS to link: the stylesheet is bundled
into the JS.

## Install

```bash
npm install brents-toasts
```

```ts
import { toasts, ToastColor, ToastSeverity, ToastBuilder, Toasts } from 'brents-toasts';
```

No-build-step alternative, served via jsDelivr (unpkg also works, drop-in):

```html
<script src="https://cdn.jsdelivr.net/npm/brents-toasts/dist/index.umd.min.js"></script>
<script>BrentsToasts.toasts.showToast('Hello, toast.');</script>
```

`BrentsToasts` mirrors the npm named exports 1:1. Full walkthrough:
[guide/getting-started.md](guide/getting-started.md).

## The core decision: which call shape

`toasts` is a ready-to-use singleton. Three equivalent, permanently supported call shapes for
`showToast`; pick whichever reads best, don't mix conventions within one codebase without reason:

```ts
// Options object: default choice once you need more than a bare message
toasts.showToast('Saved!', { severity: ToastSeverity.SUCCESS, duration: 5000, title: 'Done' });

// Legacy positional: message, color, duration(ms), closable, allowHtml (5 args, all after message
// optional) - no severity param, so role/aria-live stay at the default (see Config below)
toasts.showToast('Saved!', ToastColor.SUCCESS, 5000, false, false);

// Fluent builder: chainable, same options object under the hood
new ToastBuilder('Saved!').asSuccess().withDuration(5000).withTitle('Done').show();
```

`showToast()` returns the toast's `id` (string); save it if you'll `removeToast`/`updateToast`/
control its timer later, or pass your own via `id` in options to choose it up front instead - see
[guide/lifecycle.md](guide/lifecycle.md#choosing-a-toasts-id). Defaults: `severity` `ToastSeverity.INFO` (which also picks the default
`color`, `ToastColor.INFO` - see Config below), `duration` `3000`ms, `closable`
`true`, `allowHtml` `false`, `allowLineBreaks` `true` (all overridable via `configure()`, see
[guide/config.md](guide/config.md)). Builder method reference:
[guide/builder-reference.md](guide/builder-reference.md).

**Content rule** (security-relevant - know this one without following the link):
`message`/`title`/every button label/detail label-value render as plain text; `\n` and literal
`<br>`/`<br/>` still become real line breaks (opt out with `allowLineBreaks: false`), nothing
else is parsed. Pass `allowHtml: true` for an HTML string (sanitize it yourself; `title` is
never affected by `allowHtml`). Pass a real `Node` as `message` for fully custom interactive
content: appended directly, no `innerHTML`, no XSS surface, `allowHtml` irrelevant.

## Feature reference

Each of these is a call or two to get going; follow the link for the full option set, edge
cases, and worked examples before implementing anything non-trivial with it.

- **Buttons** - plain action buttons, `toasts.closeButton()`, `toasts.confirmButton(...)`
  (Yes/No → pending → done), and `toasts.stepButton([...])`, the general multi-step primitive
  behind both. Button clicks never trigger the toast's own `closable` dismiss.
  → [guide/buttons.md](guide/buttons.md)
- **Details** - `details: [{ label, value, buttons }]` (or a plain string shorthand) renders an
  expandable block behind an auto-added "Details" toggle; `toasts.detailsCopyButton(text)` is
  the only built-in copyable detail. → [guide/details.md](guide/details.md)
- **Lifecycle** - `removeToast(id, reason?)`/`removeAllToasts`/`removeOtherToasts`;
  `clearBySource(source)` dismisses every toast whose `ToastOptions.source` matches, so a
  feature/module can clear only its own toasts without tracking their `id`s.
  `updateToast(id, patch)` is a **patch** (only keys present in `patch` change; `buttons`/
  `details`/`theme` replace wholesale - use `addToastButton`/`removeToastButton`/
  `addToastDetail`/`removeToastDetail` for incremental changes), optionally animated via
  `transition`. Also covers `toasts.promise(...)` for loading/success/error toasts.
  `toasts.on(event, handler)`/`off(...)` subscribe to `'show'`/`'open'`/`'visible'`/`'update'`/
  `'close'`/`'remove'`/`'pause'`/`'resume'` - multiple independent listeners per event, each
  fired with `{ id, ... }`; `'show'`'s stable `{ id, severity, message }` (the same shape
  regardless of call form) is the one to spy on for testing "did my code show a toast".
  `ToastOptions.onClose` and the `'close'`/`'remove'` events all receive a `ToastCloseReason`
  (`'user' | 'timeout' | 'evicted' | 'promise' | 'programmatic'`) saying why the toast closed.
  → [guide/lifecycle.md](guide/lifecycle.md)
- **Timers** - `pause`/`resume`/`reset`/`extend`/`removeToastTimer`, `getToastTimer(id)`. All
  no-ops on a sticky toast (`duration: 0`); it never has timer state. Timers also auto-pause on
  hover/focus (`pauseOnHover`, default on) and while the page is hidden (`pauseOnPageHidden`,
  default on) - independent reasons alongside manual `pauseToastTimer`/`resumeToastTimer`, all of
  which must release before the countdown actually resumes. `minVisibleDuration` (default
  `0`, disabled) guards against dismissing a toast before it's been visible that long - a
  premature `removeToast()`/click plays `SHAKE_LR` and defers rather than drops the dismissal;
  never delays a `'timeout'`/`'evicted'` removal.
  → [guide/timers.md](guide/timers.md)
- **Progress bar** - `progress: { mode: 'fill' | 'drain' | 'manual' }`; `'manual'` ignores the
  timer, drive it with `setToastProgress(id, 0-1)`. → [guide/progress.md](guide/progress.md)
- **Animations** - `configure({ animation: ToastAnimation.SLIDE | FADE | NONE })`, or
  `registerToastAnimation(...)` for a custom one. → [guide/animations.md](guide/animations.md)
- **Theming** - every color is a `--bt-*` CSS custom property; override via `theme:` on
  `configure()`/a single toast, or with plain CSS on `.bt-toast`.
  → [guide/theming.md](guide/theming.md)
- **Layouts & modifiers** - `modifiers: ToastModifierValue[]` are small, composable design
  tweaks (`compact`, `wide`, `accent-top`, `stacked-actions`, `full-bleed`, `close-hidden`,
  `close-corner`, `close-pinned-right`, `filled-background`, `icon-left`, `icon-disabled`,
  `icon-pop`, `icon-bounce` - 13 built-ins), any number active on one toast at once. `layout` is a mutually-exclusive named
  "look" via `layout: ToastLayout.DEFAULT | PROMINENT` (2 built-ins, deliberately just a
  handful) - the non-default one is itself a preset composed from `modifiers`, not a duplicate
  CSS path. Not every modifier has a matching layout name - reach for `modifiers`
  directly for a tweak that isn't a named "look". Custom ones via
  `registerToastLayout(name, modifiers?)`/`registerToastModifier(name)` plus your own
  `[data-bt-layout="name"]`/`[data-bt-modifiers~="name"]` CSS. → [guide/layouts.md](guide/layouts.md)
- **Icons** - opt-in `icon: ToastIconValue` (a built-in/registered name, `{ src }`, `{ class }`,
  a `Node`, or a renderer function) rendered between the accent bar and the message; nothing
  renders unless set, no automatic severity-derived icon. `ToastIcon.INFO | SUCCESS | WARNING |
  ERROR | SPINNER` built-ins, extend via `registerToastIcon(name, source)`. Placement is
  `ICON_LEFT`/`ICON_DISABLED` modifiers (see above), not a separate option; `ICON_POP`/
  `ICON_BOUNCE` play an opt-in CSS entrance animation on the icon instead (mutually exclusive
  with each other).
  `configure({ promiseIcons })` sets `toasts.promise()`'s pending/success/error/timeout icons.
  → [guide/icons.md](guide/icons.md)
- **Localization** - bundled `en`/`de`/`es`/`fr` chrome text (`configure({ locale })`), only
  affects the library's own labels, never your `title`/`message`. `ToastQuickActions` gives
  separate pre-translated common words. → [guide/localization.md](guide/localization.md)
- **Config** - `configure()`/`configurePosition()` for defaults, `resetConfig()` (or the exported
  `DEFAULT_CONFIG`) to revert `configure()`, six stacking positions, `maxToasts`/`evictOldest`,
  responsive collapsing below `responsiveBreakpoint`, `gap` (default `8`px, spacing between
  stacked toasts) and `zIndex` (default `10000`, applied as `--bt-z-index`). Scope defaults to one page/section with
  `new Toasts()` instead of the shared singleton. `role`/`aria-live`/`aria-atomic` come from
  `ToastOptions.severity` alone (`WARNING`/`ERROR` → `alert`/`assertive`, `INFO`/`SUCCESS` →
  `status`/`polite`) - `color` is purely visual and never affects them *by default*. An unset
  `color` defaults to `configure()`'s `colors[severity]` (default bundled `ToastColor`), so
  `severity: ToastSeverity.WARNING` alone gets both the right look and the right role.
  `configure({ autoDetectSeverity: true })` (default `false`) opts into inferring `severity` from
  `color` when a toast sets `color` without `severity`, by nearest-match against `colors` - see
  [Config](guide/config.md#opt-in-inferring-severity-from-color). A
  `closable` toast's row is focusable (`role="button"`, accessible name) and dismissible via
  Enter/Space (focused row) or Escape (focus anywhere inside the toast), not just click.
  `dismissOnClick: false` narrows just the click path - the row body stops dismissing on click,
  while the close icon (now permanently visible) and keyboard dismissal keep working.
  `configure({ injectStyles: false })`, set before the first toast is shown anywhere on the
  page, skips injecting the toast card's bundled look (`.bt-toast`/etc.) for a design system
  styling it from scratch; `injectLayoutStyles: false` independently skips the bundled
  positioning/stacking CSS (`.bt-snackbar`/`.bt-toast-container`) for a strict CSP that blocks
  all runtime `<style>` injection - set both `false` and supply your own CSS in that case. All
  class names/DOM structure stay the same either way. → [guide/config.md](guide/config.md)
- **Per-toast data** - `setToastData`/`getToastData(id)`: attach a payload so one shared button
  handler can act on many toasts. Not general app state. → [guide/data.md](guide/data.md)

## Common mistakes to avoid

- Don't hand-roll "click to arm, click again to confirm"; use `confirmButton()`.
- Don't rebuild `buttons`/`details` arrays by hand for one insert/remove; use
  `addToastButton`/`removeToastButton`/`addToastDetail`/`removeToastDetail`.
- Don't call `resetToastTimer`/`extendToastTimer` expecting it to make a sticky (`duration: 0`)
  toast timed; it won't. Pass `duration` explicitly.
- Don't assume `updateToast({ buttons: [...] })` merges; it replaces the whole array.
- Don't reach for `setToastData`/`getToastData` as general app state; it's meant for one narrow
  case: a shared button handler looking up a per-toast payload by the `id` it already receives.
- When using a page-scoped `new Toasts()` instance, call `.closeButton()`/`.confirmButton()`/etc.
  on *that* instance, not the shared `toasts` singleton, so the button dismisses via the right
  instance.
- A throwing `onClose`/button `onClick`/`promise()` message resolver is caught and warned about
  (`console.warn`), never left to crash the caller or abort the rest of a toast's cleanup.
- An invalid `duration`/`minVisibleDuration` (negative/NaN), `maxToasts` (< 1), or `gap`
  (negative/NaN) warns once and falls back to the configured default instead of silently
  producing broken behavior.
