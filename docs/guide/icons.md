# Icons

An opt-in icon rendered between the accent bar and the message. Nothing
renders unless you set one - there's no automatic severity-derived icon.
Set it per-toast (`ToastOptions.icon`), library-wide (`configure({ icon })`),
via `ToastBuilder.withIcon()`, or - for `toasts.promise()` specifically - via
`configure({ promiseIcons })` (see below). Purely decorative (`aria-hidden`)
- it has no effect on `role`/`aria-live`, which come from `severity` alone,
the same independence `color` already has.

## Built-in icons

`ToastIcon` values - single-color (`currentColor`), so they inherit the
toast's own text color with no extra config:

| Name | `ToastIcon` constant | Notes |
|---|---|---|
| `'info'` | `ToastIcon.INFO` | |
| `'success'` | `ToastIcon.SUCCESS` | |
| `'warning'` | `ToastIcon.WARNING` | |
| `'error'` | `ToastIcon.ERROR` | Matches `ToastSeverity`'s naming - `icon: ToastIcon.SUCCESS` reads the same way `withSeverity(ToastSeverity.SUCCESS)` does, though the two are independent (setting one never sets the other). |
| `'spinner'` | `ToastIcon.SPINNER` | A CSS-`@keyframes`-animated loading ring - mainly meant for `configure({ promiseIcons })`'s `pending` outcome (see below), but usable anywhere `icon` is. |

```ts live
toasts.showToast('Saved!', { icon: ToastIcon.SUCCESS });
toasts.configure({ icon: ToastIcon.INFO }); // library-wide default
new ToastBuilder('Heads up.').withIcon(ToastIcon.WARNING).show();
```

## Custom icons

`icon` accepts more than a built-in name - the same option/field takes any
of these forms:

```ts live
// An image URL:
toasts.showToast('Custom art', { icon: { src: 'https://example.com/icon.svg' } });
// A consumer-owned CSS class (icon-font/background-image style - style
// `.bt-toast-icon .my-icon-font` yourself, the library renders an empty span):
toasts.showToast('Icon font', { icon: { class: 'my-icon-font' } });
// A hand-built Node:
const node = document.createElement('span');
node.textContent = '★';
toasts.showToast('Node icon', { icon: node });
// A renderer function, called fresh on every render - the safest form for a
// Node that shouldn't be shared/moved between toasts, and the natural place
// to wire up something like an animation library the toast itself doesn't render:
toasts.showToast('Function icon', { icon: () => {
  const el = document.createElement('span');
  el.textContent = '⚡';
  return el;
} });
```

A bare `string` is always a name to look up (built-in or registered - see
below), never a literal URL - use `{ src }` for that.

## Registering a custom icon

```ts live
import { registerToastIcon } from 'brents-toasts';

registerToastIcon('brand-logo', { src: 'https://example.com/logo.svg' });
```

```ts live
toasts.showToast('Reusable by name', { icon: 'brand-logo' });
```

Passing an unrecognized icon name drops it (with a one-time `console.warn`)
instead of falling back to anything, same as an unrecognized `layout`/`modifier`.

## Placement

Placement is controlled via `ToastModifier` (see
[layouts.md](layouts.md#built-in-modifiers)), not a separate icon-specific
option: `ToastModifier.ICON_LEFT` pins the icon to its default leading
position so it stays there under modifiers that reorder the row's other
children (e.g. `close-pinned-right`), and `ToastModifier.ICON_DISABLED`
force-hides it regardless of what `icon` is set to.

```ts live
toasts.showToast('Always visible close, icon stays put', {
  icon: ToastIcon.SUCCESS,
  modifiers: [ToastModifier.CLOSE_PINNED_RIGHT, ToastModifier.ICON_LEFT],
});
```

Further icon placements (icon on the right, above the message, replacing the
accent bar entirely) aren't implemented yet - only the default left position
and disabling are, for now.

## Entrance animation

Also modifier-driven, and opt-in: `ToastModifier.ICON_POP` plays a quick
scale+fade pop-in when the icon (re)renders, `ToastModifier.ICON_BOUNCE`
plays an elastic bounce-in instead. Both are plain CSS `@keyframes` on
`.bt-toast-icon` itself - no JS involved, and they replay naturally on an
`updateToast({ icon })` that changes the icon, since it's rebuilt from
scratch like every other icon change. Mutually exclusive in effect (pick
one, not both); composes fine with `ToastIcon.SPINNER`, since the spinner's
own continuous rotation animates its inner `<svg>`, not this wrapper.

```ts live
toasts.showToast('Saved!', {
  icon: ToastIcon.SUCCESS,
  modifiers: [ToastModifier.ICON_BOUNCE],
});
```

## `toasts.promise()` integration

`configure({ promiseIcons })` sets a default icon for `promise()`'s
`pending`/`success`/`error`/`timeout` outcomes - `true` is shorthand for the
built-in set (`ToastIcon.SPINNER`/`SUCCESS`/`ERROR`/`WARNING`), or pass a
partial object to only set some outcomes. Overridable per call via
`promise()`'s own `options.icon` (shared across all outcomes) or a specific
outcome's `messages.success.icon`/etc. (wins over everything). Unset/`false`
by default - fully opt-in, and can be turned back off any time by
`configure()`-ing it to `false`/`undefined` again.

```ts live
toasts.configure({ promiseIcons: true });
toasts.promise(
  new Promise((resolve) => setTimeout(() => resolve('done'), 1000)),
  { loading: 'Saving...', success: 'Saved!' }
);
```
