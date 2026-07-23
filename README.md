# brents-toasts
A simple drop-in vanilla and beginner friendly toast system

Demo live under: https://brentspine.github.io/brents-toasts/<br>
Permalink for v1.0: https://brentspine.github.io/brents-toasts/toasts-1.0.js

This is a rewrite of an old optimistic previous attempt, that I used on various projects: https://github.com/brentspine/tinder-but-for-horses/blob/main/scripts/toasts.js

## Install

```bash
npm install brents-toasts
```

```ts
// TypeScript / bundlers — types come free from dist/index.d.ts
import { toasts, ToastColor, ToastBuilder, Toasts } from 'brents-toasts';
```

Or drop it straight into a page with no build step, no module system required:

```html
<script src="https://unpkg.com/brents-toasts/dist/index.umd.min.js"></script>
<script>
  BrentsToasts.toasts.showToast('Hello, toast.');
</script>
```

`BrentsToasts` mirrors the npm named exports exactly: `BrentsToasts.toasts`
(the ready-to-use instance), `BrentsToasts.Toasts` (the class), plus
`ToastColor`, `ToastPosition`, `ToastAnimation`, `ToastBuilder`.

## Usage

`toasts` is a ready-to-use singleton — just call `showToast`. The API scales
from a single argument up to full control, in whatever form fits the call site:

```ts
// 1. Just a message
toasts.showToast('Saved!');

// 2. + a color
toasts.showToast('Saved!', ToastColor.SUCCESS);

// 3. Legacy positional form: message, color, duration (ms), closable
toasts.showToast('Saved!', ToastColor.SUCCESS, 5000, false);

// 4. Options object — the recommended form once you need more than color
toasts.showToast('Saved!', {
  color: ToastColor.SUCCESS,
  duration: 5000,
  closable: false,
  title: 'Done',
});

// 5. Fluent builder — same options under the hood, chainable
new ToastBuilder('Saved!')
  .asSuccess()
  .withTitle('Done')
  .withDuration(5000)
  .show();
```

Forms 3 and 4 are permanently supported side by side — pick whichever reads
better at the call site. The builder (form 5) always normalizes into the same
options object as form 4, so behavior is identical across all three.

### Custom content

For a simple HTML string, opt in with `allowHtml` (sanitize the input
yourself — this renders via `innerHTML`):

```ts
toasts.showToast('<b>Saved!</b> Undo?', { allowHtml: true });
```

For fully custom, interactive content (buttons, links, anything), pass a
real DOM node instead of a string. It's appended directly — no `innerHTML`,
no `allowHtml`, no XSS surface:

```ts
const content = document.createElement('span');
content.textContent = 'Undo? ';
const undoBtn = document.createElement('button');
undoBtn.textContent = 'Undo';
undoBtn.onclick = () => restore();
content.appendChild(undoBtn);

toasts.showToast(content, { closable: true });
```

`title` always renders as plain text regardless of `allowHtml`, by design.

### Buttons

For simple actions (Undo, Dismiss, Expand, ...), use the native `buttons`
option instead of building a custom `Node` — it renders as plain, underlined
clickable text (not a native-looking button, by design), vertically centered
regardless of whether `title` is present:

```ts
toasts.showToast('Item deleted.', {
  title: 'Item deleted',
  buttons: [
    {
      label: 'Undo',
      onClick: (event, id) => {
        toasts.removeToast(id);
        toasts.showToast('Restored!', { color: ToastColor.SUCCESS });
      },
    },
  ],
});
```

`onClick` receives the click/keyboard-activation event and the toast's own
`id`, so you can dismiss it yourself, show a follow-up toast, or reach the
toast's DOM node directly (`document.getElementById(id)`) to update its
content in place. Button clicks never trigger the toast's own `closable`
dismiss behavior. `label` always renders as plain text, like `title`. Pass
`className` for extra styling hooks without losing the default plain-link
look. Builder equivalent: `.withButton(label, onClick, className)`
(repeatable — call it once per button).

### Details (expandable extra info)

For information that shouldn't clutter the main message — a status code, a
backend error, anything only needed on request — pass `details` instead of
building your own button. A "Details" toggle button is added automatically;
clicking it reveals a block below the message that's visually distinct
(bordered, monospace) and structurally separate from the clickable/
dismissable part of the toast, so it never accidentally triggers dismissal.
Each item gets its own "Copy" button:

```ts
toasts.showToast('Account settings could not be updated.', {
  title: 'Action Failed',
  color: ToastColor.ERROR,
  details: [
    { label: 'Error', value: '500 Internal Server Error' },
    { label: 'Status', value: 'failed' },
  ],
});
```

Strings are shorthand for `{ value: '...' }` with no label. Set
`copyable: false` on an item to hide its "Copy" button, or `detailsCopyable: false`
on the toast to hide every item's Copy button at once without repeating it
(an item's own `copyable` still wins if set). Toggling details open/closed
(or mutating a toast's own content some other way) automatically repositions
the whole stack, so an expanded toast never overlaps the ones above it.
Customize the toggle button text with `detailsLabel`/`detailsHideLabel`
(default `"Details"`/`"Hide details"`). Builder equivalent:
`.withDetails(details, detailsLabel?, detailsHideLabel?)` /
`.withDetailsCopyable(copyable)`.

Each detail item can also have its own action buttons, same shape as the
top-level `buttons` option:

```ts
toasts.showToast('Payment failed.', {
  title: 'Payment Failed',
  color: ToastColor.ERROR,
  details: [
    {
      label: 'Transaction',
      value: 'tx_8f2a1c',
      buttons: [{ label: 'Retry', onClick: (event, id) => retryPayment('tx_8f2a1c') }],
    },
  ],
});
```

### Config: project-wide vs. page/section-local

`toasts.configure({...})` sets defaults on the shared singleton — use this
for project-wide defaults (e.g. every toast in your app defaults to
`duration: 4000`):

```ts
toasts.configure({ duration: 4000, position: ToastPosition.BOTTOM_CENTER });
```

For defaults scoped to one page or section, instantiate your own `Toasts`
and configure that instead. It renders into the same on-screen snackbar, so
you get different defaults without a second visual container:

```ts
import { Toasts } from 'brents-toasts';

const pageToasts = new Toasts();
pageToasts.configure({ color: ToastColor.WARNING, closable: false });

pageToasts.showToast('This page only.');
new ToastBuilder('Also this page only.', pageToasts).show();
```

See `ToastOptions`/`ToastsConfig` in `dist/index.d.ts` for the full list of
per-toast and library-wide settings (position, animation, `onClose`,
`removeOtherToasts`, `buttons`, `details`, `maxToasts`, `evictOldest`, ...).
