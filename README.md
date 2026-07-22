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
`removeOtherToasts`, `maxToasts`, `evictOldest`, ...).
