# Config: library-wide, per-position, and page/section-local

## Library-wide defaults

`toasts.configure({...})` sets defaults on the shared singleton; use this
for project-wide defaults (e.g. every toast in your app defaults to
`duration: 4000`):

```ts
toasts.configure({ duration: 4000, position: ToastPosition.BOTTOM_CENTER });
```

Per-call `showToast`/`ToastBuilder` options still take precedence over
whatever `configure()` set.

`ToastsConfig` fields and their defaults (`Toasts.ts`'s `DEFAULT_CONFIG`):

| Field | Default | Notes |
|---|---|---|
| `color` | `ToastColor.INFO` | |
| `duration` | `3000` | ms |
| `closable` | `true` | |
| `allowHtml` | `false` | |
| `allowLineBreaks` | `true` | |
| `titleMode` | `'stacked'` | |
| `position` | `ToastPosition.BOTTOM_CENTER` | |
| `responsiveBreakpoint` | `800` | px; see "Positions on narrow screens" below |
| `animation` | `ToastAnimation.SLIDE` | see [Animations](animations.md) |
| `maxToasts` | `5` | see "Capacity and eviction" below |
| `evictOldest` | `true` | |
| `pauseOnHover` | `true` | also governs focus-to-pause; see [Timers](timers.md) |
| `progress` | `false` | see [Progress bar](progress.md) |
| `promiseTimeout` | `0` (disabled) | ms; see "Timeout" in [Lifecycle](lifecycle.md) |
| `locale` | `undefined` (auto-detect) | see [Localization](localization.md) |
| `translations` | `undefined` | see [Localization](localization.md) |
| `theme` | `undefined` | see [Theming](theming.md) |
| `colors` | `{ ...ToastColor }` | see "Severity colors and accessibility" below |

Two `ToastOptions` fields have no `ToastsConfig` counterpart to set
library-wide, since they're inherently per-call: `onClose` (called as soon
as a toast starts closing, manually or via duration timeout; there's no
sensible shared default for a callback) and `reverseOrder` (inserts a toast
at the far end of its position's stack instead of nearest the anchor edge;
creation-time only, a no-op passed to `updateToast`).

## Severity colors and accessibility

A toast's `role`/`aria-live` (`role="alert"`/`aria-live="assertive"` vs.
`role="status"`/`aria-live="polite"`) is derived from its resolved `color`:
a value that exactly matches `configure()`'s `colors.WARNING`/`colors.ERROR`
gets the assertive `alert` treatment; anything else - including `INFO`/
`SUCCESS`, and any color of your own that isn't one of the four severities -
gets the passive `status` treatment. `colors` defaults to the bundled
`ToastColor` (`{ INFO, SUCCESS, WARNING, ERROR }`), and also supplies the
default `color` `promise()` applies to its `success`/`error`/`timeout`
outcomes.

**If your app reskins its palette, override `colors`, not just `color`.**
Passing your own hex as a one-off `color` (e.g. to match your app's design
system) doesn't tell the library what that color *means* - it'll render
`role="status"` even for something semantically a warning or error, since
it no longer matches the bundled `ToastColor.WARNING`/`ERROR` byte-for-byte.
Instead, override the severities themselves:

```ts
toasts.configure({
  colors: { WARNING: '#ffc107', ERROR: '#dc3545' },
});

// Now correctly gets role="alert"/aria-live="assertive":
toasts.showToast('Please sign in to use this feature.', { color: '#ffc107' });
```

`colors` merges key-by-key over the current value (like `theme`), so a
partial override - just `WARNING`, say - leaves `INFO`/`SUCCESS`/`ERROR` at
their bundled defaults rather than losing them.

## Capacity and eviction

`maxToasts` (default `5`) caps how many toasts can be visible at once **per
position**; each position's snackbar is tracked independently, so five
`BOTTOM_CENTER` toasts and five `TOP_RIGHT` toasts can coexist. When a new
toast would exceed the cap and `evictOldest` is `true` (the default), the
oldest toast *by creation order* (not DOM position; a `reverseOrder` toast
can be prepended, so DOM position 0 isn't reliably "the oldest") in that
position is dismissed to make room.

## Per-position overrides

`Toasts.configurePosition(position, { maxToasts?, evictOldest? })` overrides
just those two settings for one position, layered on top of the
library-wide defaults from `configure()`, e.g. a small `TOP_RIGHT`
notification stack alongside a larger default `BOTTOM_CENTER` one:

```ts
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

```ts
toasts.configure({ responsiveBreakpoint: 0 }); // always keep positions distinct
```

Collapsing only changes which physical container a toast renders into;
the toast's own *identity* `position` (what it was created with) is never
mutated by this.

## Page/section-local instances

For defaults scoped to one page or section, instantiate your own `Toasts`
and configure that instead. It renders into the same on-screen snackbar
(same-position instances share one physical container, see below), so you
get different defaults without a second visual container:

```ts
import { Toasts } from 'brents-toasts';

const pageToasts = new Toasts();
pageToasts.configure({ color: ToastColor.WARNING, closable: false });

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
