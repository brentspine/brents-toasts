# Layouts & modifiers

Two independent, composable knobs control a toast's *structure* (as
distinct from `theme`'s colors and `titleMode`'s title DOM shape - any
combination of all of these works):

- **`modifiers`** - small, composable design tweaks. Any number can be
  active on one toast at once: density, close-button treatment, width,
  action-button wrapping, background fill. These are the atomic building
  blocks. Set them per-toast (`ToastOptions.modifiers`), library-wide
  (`configure({ modifiers })`), or via `ToastBuilder.withModifiers()`.
- **`layout`** - a mutually-exclusive named "look" (only one applies at a
  time). `layout` is deliberately kept short - `default` plus real,
  recognizable design patterns worth a name - rather than one entry per
  modifier. Set it per-toast (`ToastOptions.layout`), library-wide
  (`configure({ layout })`), or via `ToastBuilder.withLayout()`.

Every non-default built-in `layout` is itself just a *preset* - a named set
of `modifiers` (see the table below). Picking a `layout` and then adding
extra `modifiers` on top never produces contradictory CSS for whatever they
share, because the layout's own CSS *is* its modifiers' CSS, not a separate
copy. A layout composing just one modifier isn't worth a name of its own -
there's no built-in `layout` for `compact`/`wide`/`accent-top` etc. on their
own, only for genuine multi-modifier combinations. If you want a tweak that
isn't itself a named "look", reach for `modifiers` directly instead of
looking for a matching `layout` entry - not every modifier has one.

## Built-in modifiers

`ToastModifier` values, keyed off `[data-bt-modifiers~="name"]`. Usable
standalone, stacked with each other, and/or layered on top of a `layout`:

| Name | `ToastModifier` constant | Behavior |
|---|---|---|
| `'compact'` | `ToastModifier.COMPACT` | Denser - smaller min-width, tighter row height/padding, smaller hover-reveal close bar. For high-frequency/low-importance notifications. |
| `'wide'` | `ToastModifier.WIDE` | Bigger min/max-width and roomier padding. For content-heavy toasts (long messages, several details) that feel cramped at the default width. |
| `'stacked-actions'` | `ToastModifier.STACKED_ACTIONS` | Buttons and the details toggle wrap onto their own full-width row below the message instead of sharing the row with it. For toasts with several or long-labeled buttons. |
| `'full-bleed'` | `ToastModifier.FULL_BLEED` | Edge-to-edge banner look - square corners, stretches to the snackbar's full width instead of shrink-wrapping. Most effective at a `*-center` position. |
| `'accent-top'` | `ToastModifier.ACCENT_TOP` | The color accent becomes a thin horizontal strip across the top of the card instead of a left vertical bar, and the now-redundant default hover-reveal close bar is removed entirely. Dismissal still works via click/Enter/Space/Escape on the row. |
| `'close-hidden'` | `ToastModifier.CLOSE_HIDDEN` | No accent-bar/close-swatch chrome at all - just text (and buttons/progress, if present). Dismissal still works the same way as `accent-top` above. |
| `'close-corner'` | `ToastModifier.CLOSE_CORNER` | Close button is a small circle overlaid on the card's top-right corner (modal-`×`-style) instead of living in the row's flex flow, letting content/actions use the row's full width beneath it. |
| `'close-pinned-right'` | `ToastModifier.CLOSE_PINNED_RIGHT` | Close button is always visible, pinned to the row's trailing/right edge, in the row's normal flex flow (as opposed to `close-corner`'s overlaid circle). No swatch of its own - pair with `filled-background` below for the "colored bar with an always-on close" look. |
| `'filled-background'` | `ToastModifier.FILLED_BACKGROUND` | Paints the whole card background from the toast's own color instead of the flat default background. An explicit `theme.background` still overrides this. Independent of the close-button variants - stacks with any of them (or none). |

`compact`/`wide` are mutually exclusive in effect, as are the three
close-button variants (`close-hidden`/`close-corner`/`close-pinned-right`)
- combining two from the same group produces a well-defined but unintended
result (CSS source order decides which one visually wins) rather than a
supported look. `filled-background` isn't part of either group and stacks
cleanly with anything. Nothing prevents an unsupported combination at the
type level, the same way nothing stops you from passing two conflicting
plain CSS classes.

```ts live
// Stack modifiers freely, with or without a layout:
toasts.showToast('Shipped!', { modifiers: [ToastModifier.WIDE, ToastModifier.STACKED_ACTIONS] });
new ToastBuilder('Always-visible close, no swatch').withModifiers([ToastModifier.CLOSE_PINNED_RIGHT]).show();
```

Passing an unrecognized modifier name drops it from the applied set (with a
one-time `console.warn`) rather than falling back to anything - the rest of
the list still applies.

## Built-in layouts

| Name | `ToastLayout` constant | Modifiers it composes | Behavior |
|---|---|---|---|
| `'default'` | `ToastLayout.DEFAULT` | *(none)* | **Default.** Close button is a thin accent bar on the left, hidden until the toast is hovered. |
| `'prominent'` | `ToastLayout.PROMINENT` | `close-pinned-right`, `filled-background` | Hard to miss: close button always visible, pinned to the right edge; the whole card is filled with the toast's own color. |

```ts live
toasts.showToast('Heads up.', { layout: ToastLayout.PROMINENT });
toasts.configure({ layout: ToastLayout.PROMINENT }); // library-wide default
new ToastBuilder('Always-visible close').withLayout(ToastLayout.PROMINENT).show();
```

Passing an unregistered layout name falls back to `default` with a one-time
`console.warn` (same pattern as an unrecognized `position` or `animation`).

Stack extra `modifiers` on top of a named `layout`:

```ts live
toasts.showToast('Shipped!', {
  layout: ToastLayout.PROMINENT,
  modifiers: [ToastModifier.WIDE],
});
```

For a look that isn't a built-in `layout` at all - e.g. the classic
"top accent strip with a corner close glyph" - just combine the underlying
modifiers directly instead of looking for a matching layout name:

```ts live
toasts.showToast('Deployed.', {
  modifiers: [ToastModifier.ACCENT_TOP, ToastModifier.CLOSE_CORNER],
});
```

## How it works

Unlike `animation`, neither a layout nor a modifier carries any JS behavior.
`showToast`/`updateToast` stamp `data-bt-layout="<name>"` on the toast's
`.bt-toast` element, and separately union that layout's own modifiers (see
`ToastLayout.ts`'s registry) with the explicit `modifiers` option into one
space-separated `data-bt-modifiers="name1 name2"` attribute - every actual
visual rule lives in plain CSS keyed off one of those two attributes, the
same "or entirely in plain CSS, no API involvement" pattern `theme` already
follows. `registerToastLayout(name, modifiers?)`/`registerToastModifier(name)`
only mark a name as known so it doesn't warn-and-fall-back/get-dropped; they
don't take a CSS definition object themselves.

## Registering a custom layout or modifier

A custom layout can compose existing (or your own custom) modifiers instead
of writing CSS from scratch:

```ts live
import { registerToastLayout, ToastModifier } from 'brents-toasts';

registerToastLayout('banner-with-close', [ToastModifier.FULL_BLEED, ToastModifier.CLOSE_CORNER]);
```

```ts live
toasts.showToast('Reused full-bleed + close-corner CSS, no new rules needed', { layout: 'banner-with-close' });
```

Or write fully custom CSS from scratch - `registerToastLayout(name)` with no
second argument (or `registerToastModifier(name)`) is purely a name
whitelist, same as before:

```ts live
import { registerToastLayout } from 'brents-toasts';

registerToastLayout('title-right');
```

```css
/* .bt-toast-row is already display: flex, so most structural changes are
   just a flex `order` reorder - no DOM manipulation needed. */
.bt-toast[data-bt-layout="title-right"] .bt-toast-title {
  order: 2;
  text-align: right;
}
```

```ts live
toasts.showToast('Custom look', { title: 'Note', layout: 'title-right' });
```
