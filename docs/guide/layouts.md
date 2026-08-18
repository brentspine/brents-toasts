# Layouts

`layout` controls a toast's *structure* - close button position/visibility,
and any other non-color layout difference. It's independent of `theme`
(colors) and `titleMode` (whether `title` is a stacked block or an inline
lead-in) - any combination of the three works. Set it per-toast
(`ToastOptions.layout`), library-wide (`configure({ layout })`), or via
`ToastBuilder.withLayout()`.

## Built-ins

| Name | `ToastLayout` constant | Behavior |
|---|---|---|
| `'default'` | `ToastLayout.DEFAULT` | **Default.** Close button is a thin accent bar on the left, hidden until the toast is hovered. |
| `'persistent-close-right'` | `ToastLayout.PERSISTENT_CLOSE_RIGHT` | Close button is always visible, pinned to the right edge of the row, with no swatch of its own. The whole card is painted from the toast's `color` instead of the flat default background (e.g. a `ToastSeverity.SUCCESS` toast renders fully green). An explicit `theme.background` still overrides this. |

```ts live
toasts.showToast('Heads up.', { layout: ToastLayout.PERSISTENT_CLOSE_RIGHT });
toasts.configure({ layout: ToastLayout.PERSISTENT_CLOSE_RIGHT }); // library-wide default
new ToastBuilder('Always-visible close').withLayout(ToastLayout.PERSISTENT_CLOSE_RIGHT).show();
```

Passing an unregistered layout name falls back to `default` with a one-time
`console.warn` (same pattern as an unrecognized `position` or `animation`).

## How it works

Unlike `animation`, a layout carries no JS behavior. `showToast`/`updateToast`
simply stamp `data-bt-layout="<name>"` on the toast's `.bt-toast` element -
every actual visual rule lives in plain CSS keyed off that attribute, the
same "or entirely in plain CSS, no API involvement" pattern `theme` already
follows. `registerToastLayout(name)` only marks a name as known so it
doesn't warn-and-fall-back; it doesn't take a definition object.

## Registering a custom layout

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
