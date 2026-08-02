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

As plain text (`allowHtml: false`, the default), `message` still honors line
breaks: a literal `\n` or `<br>`/`<br/>` in the string renders as a real line
break — everything else in the string stays inert text, no other markup is
parsed. `title`, every button label (`buttons`, `closeButton()`,
`detailsCopyButton()`, `confirmButton()`, `stepButton()`, the auto-added
details toggle, ...), and each `details` item's `label`/`value` follow the
same rule, regardless of `allowHtml` — none of them otherwise render HTML,
but all of them still honor `\n`/`<br>` line breaks.

Set `allowLineBreaks: false` (per-toast, or as a `configure()` default) to
turn that off — `\n`/`<br>` then render as inert text everywhere above,
same as any other character:

```ts
toasts.showToast('literal \\n stays as text', { allowLineBreaks: false });
```

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

`title` always renders as plain text regardless of `allowHtml`, by design
(see "Custom content" above for the `\n`/`<br>` line-break exception it
shares with `message`).

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

For the common case of a button that just dismisses the toast, use
`toasts.closeButton(label?, className?)` instead of writing the `onClick`
yourself:

```ts
toasts.showToast('Saved.', { buttons: [toasts.closeButton()] });
```

`label` defaults to `"Close"` but is a normal parameter, not a hardcoded
string, so it's ready to be swapped for a translated label. If you're using
a page-scoped `Toasts` instance (see below), call `.closeButton()` on that
instance, not the singleton, so it dismisses via the right instance.
Builder equivalent: `.withCloseButton(label?, className?)`.

#### Multi-step buttons (confirm, temporary feedback, ...)

For an action that shouldn't fire on a single accidental click, use
`toasts.confirmButton(label, onConfirm, options?)` instead of hand-rolling
a "click once to arm, click again to confirm" button:

```ts
toasts.showToast('3 items selected.', {
  buttons: [
    toasts.confirmButton('Delete', async (event, id) => {
      await deleteSelectedItems();
    }),
  ],
});
```

Clicking it swaps out the *whole toast*, not just this button: `message`
becomes `confirmMessage` (default `"Are you sure?"`) and every button on
the toast is replaced with a `yesLabel`/`noLabel` (default `"Yes"`/`"No"`)
pair. Clicking "Yes" runs `onConfirm`, optionally flashes `doneMessage`
(default `"Done"`; pass `null` to skip it) for `doneTimeoutMs` (default
`2000`), then restores the toast's original message and buttons. Clicking
"No" restores immediately, without ever running `onConfirm` — no revert
timer needed, since the explicit "No" *is* the revert. If `onConfirm`
returns a `Promise` (as above), every button on the toast disables itself
until it settles, so "Yes" can't be double-fired by an impatient second
click and "No" can't race a running confirm. Builder equivalent:
`.withConfirmButton(label, onConfirm, options?)`.

For flows `confirmButton()` doesn't cover directly (it doesn't use
`stepButton()` under the hood — it swaps the toast's own content instead
of a single button's label), build them with `toasts.stepButton(steps,
className?)`, the same general-purpose primitive `detailsCopyButton()`
below is built on. Each `ToastButtonStep` has its own `label` and optional
`onClick`; a step's `onClick` can return (or resolve to) `false` to stay
on that step instead of advancing to the next one — e.g. a guard that
isn't met, or an action that failed:

```ts
toasts.showToast('Draft ready.', {
  buttons: [
    toasts.stepButton([
      { label: 'Publish', onClick: () => (isValid() ? undefined : false) },
      { label: 'Are you sure?', onClick: (event, id) => publish(), revertAfterMs: 4000 },
      { label: 'Published!', revertAfterMs: 2000 },
    ]),
  ],
});
```

Add `revertAfterMs` (and, if not step `0`, `revertToStep`, default `0`) to
a step to auto-advance after it's been active that long — cancelled if the
button is clicked again first. `revertAfterMs` has no effect on `steps[0]`:
the first step is applied when the button renders, not via a click, so no
timer ever starts for it. The returned `ToastButton` is safe to build once
and reuse across multiple simultaneously-visible toasts (e.g. hoisted out
of a loop) — each rendered button tracks its own current step
independently. Builder equivalent: `.withStepButton(steps, className?)`.

### Removing toasts

`toasts.removeToast(id)` dismisses a single toast by the id returned from
`showToast`. To clear everything at once — across all positions — use
`toasts.removeAllToasts()`:

```ts
const id = toasts.showToast('Uploading...', { duration: 0 });
// ...
toasts.removeAllToasts(); // fades out every currently visible toast
```

Each toast still animates out individually via `removeToast` under the hood.
`showToast(msg, { removeOtherToasts: true })` does the same thing before
showing its own toast, for the common "replace whatever's on screen" case.

### Updating a toast

`toasts.updateToast(id, update)` changes an already-shown toast in place,
instead of removing it and showing a new one. `update` is the same shape as
`showToast`'s `options` (plus `message`, since that's normally the separate
first argument) — only the keys you pass change, everything else about the
toast stays as it was:

```ts
const id = toasts.showToast('Uploading…', { color: ToastColor.INFO, duration: 5000 });

toasts.updateToast(id, {
  message: 'Upload complete!',
  color: ToastColor.SUCCESS,
});
```

A common use: reflecting `getToastTimer(id)`'s countdown back onto the toast
itself instead of spawning a new one every time —

```ts
const timer = toasts.getToastTimer(id);
const ratio = timer.remaining / timer.duration;
toasts.updateToast(id, {
  message: `Closes in ${(timer.remaining / 1000).toFixed(1)}s`,
  color: ratio > 0.5 ? ToastColor.SUCCESS : ratio > 0.2 ? ToastColor.WARNING : ToastColor.ERROR,
});
```

`buttons`/`details` passed to `updateToast` replace the whole array. To
append or insert/remove a single button or detail line without reconstructing
the current array yourself, use:

```ts
toasts.addToastButton(id, { label: 'Retry', onClick: retry });     // append
toasts.addToastButton(id, { label: 'Retry', onClick: retry }, 0);  // insert at index 0
toasts.removeToastButton(id, 0);

toasts.addToastDetail(id, 'Retried once already');
toasts.removeToastDetail(id, 1);
```

`position`, `animation`, and `removeOtherToasts` are accepted (for
shape-compatibility with `ToastOptions`) but are no-ops here — they only
describe how a toast is shown, not a state it can be updated into.
`updateToast` is a no-op if `id` doesn't exist.

Passing `duration` restarts the countdown at the new value (or cancels/starts
a timer outright, if the toast was sticky or vice versa) — see the timer
controls below for finer-grained alternatives like `extendToastTimer`, which
adjust the countdown without also touching the toast's content.

### Controlling the auto-dismiss timer

A timed toast (`duration > 0`) pauses its own countdown while hovered and
resumes where it left off on mouseleave, no config needed — this is
`pauseOnHover`, on by default (`toasts.showToast(msg, { pauseOnHover: false })`
or `toasts.configure({ pauseOnHover: false })` to turn it off). A sticky toast
(`duration: 0`) is unaffected either way — hovering and un-hovering it never
starts a timer, so it can't suddenly disappear after a hover.

For anything else — reset on a button click, extend while a related async
action is running, pause while a dropdown opened from the toast is open — call
the same timer controls the built-in hover behavior is built on, using the
toast's own `id`:

```ts
const id = toasts.showToast('Uploading…', { duration: 5000 });

toasts.pauseToastTimer(id);   // stop the countdown, remembering time left
toasts.resumeToastTimer(id);  // continue from where it was paused
toasts.resetToastTimer(id);   // back to the full duration, right now
toasts.resetToastTimer(id, 8000); // ...or a new duration, which sticks for future resets
toasts.extendToastTimer(id, 2000); // add (or, negative, remove) time
toasts.removeToastTimer(id);  // cancel it entirely — the toast becomes sticky
```

All five are no-ops on a sticky toast — there's nothing to pause, resume,
reset, extend, or remove — and `resetToastTimer`/`extendToastTimer` won't
turn a sticky toast into a timed one; pass `duration` at `showToast()` time
for that instead. Every built-in that shows a temporary, click-driven state
calls `resetToastTimer()` for exactly this reason: `confirmButton()` on every
click (so it can't time out from under the user mid-confirmation),
`detailsCopyButton()` on click (so the "Copied!" flash can't get cut short),
and opening the auto-added "Details" toggle (so a toast doesn't vanish
mid-read). Plain buttons you supply yourself — the top-level `buttons` option,
or a details item's own — never do this automatically; call
`resetToastTimer(id)` from your own `onClick` if you want the same behavior.

Reading the countdown back (instead of just controlling it) works the same
way — `toasts.getToastTimer(id)` returns `{ duration, remaining, paused }`,
or `null` if `id` doesn't exist or is sticky:

```ts
const info = toasts.getToastTimer(id);
if (info) console.log(`closes in ${(info.remaining / 1000).toFixed(1)}s`);
```

### Per-toast data (a shared handler instead of one closure per toast)

For a button that means something different on every toast — "Undo" needs to
know *which* item to restore — you don't have to give each toast its own
`onClick` closure just to capture that. Attach the payload as `data` at
`showToast()` time, then read it back by `id` inside a single handler
reused across every toast:

```ts
// Defined once — reused by every toast's Undo button, not recreated per toast.
function handleUndo(event, id) {
  const item = toasts.getToastData(id);
  toasts.removeToast(id);
  toasts.showToast(`Restored "${item.name}"!`, ToastColor.SUCCESS);
}

deletedItems.forEach((item) => {
  toasts.showToast(`${item.name} deleted.`, {
    data: item,
    buttons: [{ label: 'Undo', onClick: handleUndo }],
  });
});
```

`getToastData(id)` returns `undefined` if `id` doesn't exist or has no data
attached; `setToastData(id, data)` attaches or replaces it after the toast's
already showing (e.g. once an async step resolves the real payload).
Builder equivalent: `.withData(data)`. See the "More examples" section of the
demo for this combined with `getToastTimer()` (an "Undo"/"Time left" button
pair, both built from the same shared-handler pattern).

### Details (expandable extra info)

For information that shouldn't clutter the main message — a status code, a
backend error, anything only needed on request — pass `details` instead of
building your own button. A "Details" toggle button is added automatically;
clicking it reveals a block below the message that's visually distinct
(bordered, monospace) and structurally separate from the clickable/
dismissable part of the toast, so it never accidentally triggers dismissal:

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

Strings are shorthand for `{ value: '...' }` with no label. Nothing is
copyable by default — like `closeButton()`, a "Copy" button is opt-in via
`toasts.detailsCopyButton(text, label?, copiedLabel?, className?)`, appended
to a specific item's `buttons` (or every item's, via `.map()`) rather than
happening automatically:

```ts
toasts.showToast('Account settings could not be updated.', {
  title: 'Action Failed',
  color: ToastColor.ERROR,
  details: [
    { label: 'Error', value: '500', buttons: [toasts.detailsCopyButton('500')] },
    { label: 'Status', value: 'failed' }, // no copy button for this one
  ],
});
```

It copies `text` via the Clipboard API (no-op if unavailable) and flashes its
own label to `copiedLabel` (default `"Copied!"`) for 2s — built on the
`stepButton()` primitive (see "Multi-step buttons" above). Toggling details
open/closed (or mutating a toast's own content some other way) automatically
repositions the whole stack, so an expanded toast never overlaps the ones
above it. Customize the toggle button text with `detailsLabel`/
`detailsHideLabel` (default `"Details"`/`"Hide details"`). Builder
equivalent: `.withDetails(details, detailsLabel?, detailsHideLabel?)`.

Each detail item's `buttons` works like the top-level `buttons` option —
`detailsCopyButton()` is just the first ready-made entry for it, mix in your
own alongside it:

```ts
toasts.showToast('Payment failed.', {
  title: 'Payment Failed',
  color: ToastColor.ERROR,
  details: [
    {
      label: 'Transaction',
      value: 'tx_8f2a1c',
      buttons: [
        toasts.detailsCopyButton('tx_8f2a1c'),
        { label: 'Retry', onClick: (event, id) => retryPayment('tx_8f2a1c') },
      ],
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
`removeOtherToasts`, `buttons`, `details`, `pauseOnHover`, `data`,
`maxToasts`, `evictOldest`, `locale`, `translations`, ...).

### Theming

`color` sets the accent bar/indicator, same as always. For the rest of a
toast's look — card background, text, the details block, action button
text — there's `theme`, settable library-wide (`configure({ theme })`),
per-toast (`showToast(msg, { theme })`), or entirely in plain CSS with no
API involvement at all:

```ts
// Library-wide default
toasts.configure({
  theme: { background: '#1e1e2e', text: '#cdd6f4', actionColor: '#89b4fa' },
});

// Per-toast — merges key-by-key over the configured default, so you only
// need to give the field(s) you want to change
toasts.showToast('Heads up.', {
  theme: { background: '#2a2a3d' },
});
```

Every `theme` field mirrors a `--bt-*` custom property on `.bt-toast`
(`--bt-background`, `--bt-text`, `--bt-details-background`,
`--bt-action-color`), so a plain stylesheet rule works just as well if you'd
rather not touch the JS API at all:

```css
.bt-toast {
  --bt-background: #1e1e2e;
  --bt-text: #cdd6f4;
}
```

The close ("×") icon is the one exception: its color is always picked for
you — dark or light — based on contrast against the toast's own `color`, so
a light accent (e.g. `#fff`) never renders an invisible white-on-white close
icon. Set `theme.closeIcon` to override the automatic pick with a specific
color instead. Builder equivalent: `.withTheme(theme)`.

### Localization

The library's own text — `closeButton()`'s `"Close"`, `detailsLabel`
(`"Details"`) / `detailsHideLabel` (`"Hide details"`), `detailsCopyButton()`'s
`"Copy"`/`"Copied!"`, `confirmButton()`'s `confirmMessage` (`"Are you
sure?"`) / `yesLabel`/`noLabel` (`"Yes"`/`"No"`) / `doneMessage` (`"Done"`),
and the snackbar region's `aria-label`
(`"Notifications"`) — is auto-translated based on the browser's
`navigator.language`(s), no config required. Bundled packs today: `en`
(default/fallback), `de`, `es`, `fr` (see `ToastLocales` in
`dist/index.d.ts`). Everything else — `title`, `message`, per-button/detail
text, `confirmButton()`'s own `label` (e.g. `"Delete"`) — is your own
application text and was never auto-translated.

To force a specific bundled pack instead of auto-detecting:

```ts
toasts.configure({ locale: 'de' });
```

To add a language that isn't bundled, or tweak individual strings, layer a
partial override on top of the resolved pack:

```ts
toasts.configure({ translations: { close: 'Schließen', done: 'Erledigt' } });
```

An unrecognized `locale` falls back to `en` with a one-time console warning,
same as an unimplemented `position`/`animation` value. Per-call params
(`detailsLabel`, `closeButton(label)`, `detailsCopyButton(text, label,
copiedLabel)`, `confirmButton(label, onConfirm, { confirmMessage, yesLabel,
noLabel, doneMessage })`) still win over the resolved translations, same
precedence as every other option.
