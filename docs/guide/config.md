# Config: library-wide, per-position, and page/section-local

## Library-wide defaults

`toasts.configure({...})` sets defaults on the shared singleton; use this
for project-wide defaults (e.g. every toast in your app defaults to
`duration: 4000`):

```ts live
toasts.configure({ duration: 4000, position: ToastPosition.BOTTOM_CENTER });
```

Per-call `showToast`/`ToastBuilder` options still take precedence over
whatever `configure()` set.

`toasts.resetConfig()` reverts every `configure()` change back to the
library's built-in defaults (also exported directly as `DEFAULT_CONFIG`, for
reading a specific default without constructing a throwaway instance) - e.g.
to restore defaults between tests. It only resets `config`; per-position
overrides set via `configurePosition()` are untouched.

`ToastsConfig` fields and their defaults (`Toasts.ts`'s `DEFAULT_CONFIG`):

| Field | Default | Notes |
|---|---|---|
| `severity` | `ToastSeverity.INFO` | see "Severity and accessibility" below |
| `duration` | `3000` | ms |
| `minVisibleDuration` | `0` (disabled) | ms; see "Guarding against instant dismissal" in [Timers](timers.md) |
| `closable` | `true` | |
| `dismissOnClick` | `true` | click-anywhere-on-the-row dismissal only; see "Severity and accessibility" below |
| `allowHtml` | `false` | |
| `allowLineBreaks` | `true` | |
| `titleMode` | `'stacked'` | |
| `position` | `ToastPosition.BOTTOM_CENTER` | |
| `responsiveBreakpoint` | `800` | px; see "Positions on narrow screens" below |
| `animation` | `ToastAnimation.SLIDE` | see [Animations](animations.md) |
| `layout` | `ToastLayout.DEFAULT` | see [Layouts](layouts.md) |
| `maxToasts` | `5` | see "Capacity and eviction" below |
| `evictOldest` | `true` | |
| `pauseOnHover` | `true` | also governs focus-to-pause; see [Timers](timers.md) |
| `pauseOnPageHidden` | `true` | pauses while the page is hidden; see [Timers](timers.md) |
| `progress` | `false` | see [Progress bar](progress.md) |
| `promiseTimeout` | `0` (disabled) | ms; see "Timeout" in [Lifecycle](lifecycle.md) |
| `locale` | `undefined` (auto-detect) | see [Localization](localization.md) |
| `translations` | `undefined` | see [Localization](localization.md) |
| `theme` | `undefined` | see [Theming](theming.md) |
| `colors` | `{ ...ToastColor }` | see "Severity and accessibility" below |
| `injectStyles` | `true` | see "Headless / unstyled mode" below |
| `injectLayoutStyles` | `true` | see "Headless / unstyled mode" below |
| `gap` | `8` | px; see "Stacking spacing and z-index" below |
| `zIndex` | `10000` | see "Stacking spacing and z-index" below |

There's no `ToastsConfig` field for observing *when* a toast is shown/updated/paused - that's
`on()`/`off()`, a separate subscription API rather than a config default; see "Lifecycle events"
in [Lifecycle](lifecycle.md), including the testability use case ("did my code show a toast") this
was originally built for.

Two `ToastOptions` fields have no `ToastsConfig` counterpart to set
library-wide, since they're inherently per-call: `onClose` (called with a
`reason` as soon as a toast starts closing - see "Why a toast closed" in
[Lifecycle](lifecycle.md#why-a-toast-closed); there's no sensible shared
default for a callback) and `reverseOrder` (inserts a toast at the far end
of its position's stack instead of nearest the anchor edge; creation-time
only, a no-op passed to `updateToast`).

## Severity and accessibility

`ToastOptions.severity` (`ToastSeverity.INFO` / `SUCCESS` / `WARNING` /
`ERROR`) is the sole source of a toast's `role`/`aria-live`:
`WARNING`/`ERROR` render `role="alert"`/`aria-live="assertive"`;
`INFO`/`SUCCESS` (or no `severity` at all) render `role="status"`/
`aria-live="polite"`. Every toast also gets `aria-atomic="true"`, so a
screen reader re-announces the toast's whole content on a later
`updateToast`, not just whichever text node happened to change. `color` is
purely presentational and has **no** bearing on any of this - unlike
versions before this, nothing ever inspects a `color` value to guess what
it means.

A `closable` toast's row (see `ToastOptions.closable`) is focusable with
`role="button"` and an accessible name (the localized "Close" string),
dismissible with Enter/Space while the row itself is focused or Escape from
anywhere inside the toast - not just mouse-clickable.

`dismissOnClick` (default `true`) narrows just the mouse-click path: set it
`false` to stop a click on the row body from dismissing, e.g. because the
toast's content is otherwise interactive and stray clicks kept closing it by
accident. Every other `closable` dismissal path is untouched - Enter/Space on
a focused row, Escape from anywhere inside the toast, and the close icon's own
click all keep working. Because the close icon becomes the only click-based
way to dismiss in that case, it renders permanently visible instead of only
on hover/focus - it can't rely on a reveal a touch user (no hover) might never
trigger:

```ts live
toasts.showToast('Drag me around freely.', { dismissOnClick: false });
```

`dismissOnClick: false` has no effect when `closable` is itself `false` -
there's nothing to disable click-dismissal on.

`severity` also picks this toast's default `color`, via `configure()`'s
`colors` palette, when `color` itself is left unset - so
`severity: ToastSeverity.WARNING` alone gets you both the right look and
the right role for free:

```ts live
toasts.showToast('Please sign in to use this feature.', {
  severity: ToastSeverity.WARNING,
});
```

Pass `color` too if you want a custom look with the same semantics - it
overrides just the visual, `severity` still drives the role:

```ts live
toasts.showToast('Please sign in to use this feature.', {
  severity: ToastSeverity.WARNING,
  color: '#ffc107', // your app's own warning color
});
```

`colors` defaults to the bundled `ToastColor` (`{ INFO, SUCCESS, WARNING,
ERROR }`) and also supplies the default `color` `promise()` applies to its
`success`/`error`/`timeout` outcomes (each of which also carries the
matching `severity` - see [Lifecycle](lifecycle.md)). Reskinning your
palette is just:

```ts live
toasts.configure({
  colors: { WARNING: '#ffc107', ERROR: '#dc3545' },
});
```

`colors` merges key-by-key over the current value (like `theme`), so a
partial override - just `WARNING`, say - leaves `INFO`/`SUCCESS`/`ERROR` at
their bundled defaults rather than losing them. Because accessibility comes
from `severity` alone, reskinning `colors` never risks changing which
toasts get announced as `alert`s - that's controlled independently via
`configure({ severity })` (the library-wide default) or each call's own
`severity`.

Builder equivalents: `.withSeverity(severity)`, or the shorthands
`.asInfo()` / `.asSuccess()` / `.asWarning()` / `.asError()` (each sets
`severity`, not just `color`).

## Capacity and eviction

`maxToasts` (default `5`) caps how many toasts can be visible at once **per
position**; each position's snackbar is tracked independently, so five
`BOTTOM_CENTER` toasts and five `TOP_RIGHT` toasts can coexist. When a new
toast would exceed the cap and `evictOldest` is `true` (the default), the
oldest toast *by creation order* (not DOM position; a `reverseOrder` toast
can be prepended, so DOM position 0 isn't reliably "the oldest") in that
position is dismissed to make room.

A `maxToasts` less than `1` (via `configure()` or `configurePosition()`) or a `duration` that's
negative or `NaN` (per-toast or via `configure()`) is invalid - it warns once and falls back to
the configured default rather than producing broken behavior.

## Stacking spacing and z-index

`gap` (default `8`) is the pixel spacing the stacking math (`recalculatePositions`/
`stackExistingAway`/`totalStackedExtent`) adds on top of each toast's own rendered height when
positioning toasts within a stack:

```ts live
toasts.configure({ gap: 16 });
```

`zIndex` (default `10000`) sets every snackbar's stacking context, applied as the `--bt-z-index`
CSS custom property (same inline-override-over-stylesheet-default pattern [Theming](theming.md)'s
`--bt-*` properties use, so plain CSS targeting `.bt-snackbar` still works) - raise it if toasts
need to render above some other fixed/high-`z-index` element in your app:

```ts live
toasts.configure({ zIndex: 2147483000 });
```

Both are library-wide only (no per-toast `ToastOptions` equivalent, since spacing/stacking-order
are properties of the whole snackbar, not one toast) and re-apply to already-rendered snackbars
live, the same way a later `configure({ locale })` updates an existing snackbar's `aria-label`. A
negative or `NaN` `gap` is invalid - warns once and falls back to the previous default, the same
`maxToasts`/`duration` treatment above.

## Per-position overrides

`Toasts.configurePosition(position, { maxToasts?, evictOldest? })` overrides
just those two settings for one position, layered on top of the
library-wide defaults from `configure()`, e.g. a small `TOP_RIGHT`
notification stack alongside a larger default `BOTTOM_CENTER` one:

```ts live
toasts.configurePosition(ToastPosition.TOP_RIGHT, { maxToasts: 2 });
```

Merges into any existing override for that position, the same merge
behavior `configure()` itself uses; pass a key as `undefined` to drop that
key back to the global `config` value rather than needing a separate
"clear" method. Deliberately scoped to just `maxToasts`/`evictOldest`, not
every `ToastsConfig` field, since other fields (`color`, `duration`, ...)
are already per-toast options via `ToastOptions`, so a position-wide
override for those would duplicate that surface rather than fill a gap.
Overrides are stored on the public `positionConfig: Map<ToastPositionValue,
PositionConfig>` field.

## Positions on narrow screens

On a wide viewport, `BOTTOM_LEFT`/`BOTTOM_CENTER`/`BOTTOM_RIGHT` (and the
`TOP_*` equivalents) render as visually distinct stacks. Below
`responsiveBreakpoint` px wide (default `800`, roughly tablet-portrait width),
there's no longer enough room to tell them apart, so `*_LEFT`/`*_RIGHT`
positions collapse into their edge's `*_CENTER` position and share one
stack instead of overlapping. This is re-evaluated live on resize/orientation
change, so toasts already on screen move into (or back out of) the shared
container as the breakpoint is crossed. Set `responsiveBreakpoint: 0` to
disable collapsing entirely:

```ts live
toasts.configure({ responsiveBreakpoint: 0 }); // always keep positions distinct
```

Collapsing only changes which physical container a toast renders into;
the toast's own *identity* `position` (what it was created with) is never
mutated by this.

## Headless / unstyled mode

The library's bundled CSS is split into two independently injected sheets, each a
`<style>` tag added to `<head>` the first time any toast renders - there's no separate
stylesheet to `<link>`, which is what makes the library drop-in:

- **`toasts.css`** (`<style id="toasts-styles">`, gated by `injectStyles`) - the toast
  card's own look: colors, borders, spacing, the built-in modifier looks. This is what
  most "headless" consumers actually want to opt out of.
- **`toasts-layout.css`** (`<style id="toasts-layout-styles">`, gated by
  `injectLayoutStyles`) - positioning and stacking only: `.bt-snackbar`/
  `.bt-toast-container`'s fixed positioning, z-index, and the flex layout that anchors
  toasts to their configured edge and stacks them without overlapping.

The two are independent, so you can opt out of just the look while keeping working
positioning/stacking for free - the common case, e.g. a design system that wants to
style `.bt-toast`/`.bt-toast-row`/`.bt-toast-details`/etc. from scratch instead of
overriding the bundled sheet:

```ts live
toasts.configure({ injectStyles: false });
```

Or opt out of both, for a strict CSP `style-src` that blocks runtime-injected `<style>`
tags entirely (no `unsafe-inline`/nonce support) - note that toasts will render in
normal document flow rather than as fixed, stacked notifications unless you also supply
equivalent positioning CSS yourself (`toasts-layout.css` in the package is exactly what
to reproduce):

```ts live
toasts.configure({ injectStyles: false, injectLayoutStyles: false });
```

The `.bt-toast`, `.bt-toast-row`, `.bt-toast-details`, `.bt-snackbar`,
`.bt-toast-container`, and every other class name/DOM structure the library renders are
unaffected either way and remain the public styling surface - toasts still function
fully with both `false`, they just render with no built-in look or positioning until you
supply your own CSS targeting those classes (see [Theming](theming.md) for the full list
of `--bt-*` custom properties the bundled sheet itself relies on, if you want to reuse
them).

Each only has an effect if set **before the first toast is shown** by any `Toasts`
instance on the page: each injected `<style>` tag is a single document-wide resource
(deduped by its `id`, not per-instance), so once any instance has injected one, a later
`configure({ injectStyles: false })`/`configure({ injectLayoutStyles: false })` on a
different instance can't retroactively remove it. Set them as early as possible - e.g.
immediately after import, before your app's first `showToast()` call.

## Page/section-local instances

For defaults scoped to one page or section, instantiate your own `Toasts`
and configure that instead. It renders into the same on-screen snackbar
(same-position instances share one physical container, see below), so you
get different defaults without a second visual container:

```ts live
import { Toasts } from 'brents-toasts';

const pageToasts = new Toasts();
pageToasts.configure({ severity: ToastSeverity.WARNING, closable: false });

pageToasts.showToast('This page only.');
new ToastBuilder('Also this page only.', pageToasts).show();
```

A same-position `Toasts` instance (e.g. two instances both left at the
default `BOTTOM_CENTER`) shares one physical DOM snackbar with every other
instance at that position, so `removeToast`/`updateToast`/timer methods
etc. always resolve to whichever instance actually created a given toast
`id` internally, even if called on a different instance. If you're using a
page-scoped instance, call helper-producing methods (`closeButton()`,
`confirmButton()`, ...) on *that* instance, not the singleton, so the
resulting button dismisses/updates via the right instance's own bookkeeping.

See `ToastOptions`/`ToastsConfig` in `dist/index.d.ts` for the full list of
per-toast and library-wide settings with their JSDoc.
