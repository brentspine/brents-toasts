---
name: brents-toasts
description: Write correct code against brents-toasts, a zero-dependency toast/snackbar UI library for JavaScript/TypeScript. Covers install, the showToast/ToastBuilder call shapes, buttons (plain/confirm/multi-step), details, updating/removing toasts, promise-based toasts, timers, progress bars, animations, theming, localization, and config. Use whenever a task involves adding, changing, or debugging toast/snackbar notifications built with brents-toasts (imports from `brents-toasts`, or `BrentsToasts.*` on a page using the UMD script tag).
---

# brents-toasts

To install this skill in a project that isn't this one: copy this file to
that project's `.claude/skills/brents-toasts/SKILL.md`.

Zero-dependency, framework-agnostic toast/snackbar library. Works as an
ESM/CJS import or a plain `<script>` tag (UMD, global `BrentsToasts`). No
CSS to link: the stylesheet is bundled into the JS.

## Install

```bash
npm install brents-toasts
```

```ts
import { toasts, ToastColor, ToastBuilder, Toasts } from 'brents-toasts';
```

No-build-step alternative:

```html
<script src="https://unpkg.com/brents-toasts/dist/index.umd.min.js"></script>
<script>BrentsToasts.toasts.showToast('Hello, toast.');</script>
```

`BrentsToasts` mirrors the npm named exports 1:1.

## The core decision: which call shape

`toasts` is a ready-to-use singleton. Three equivalent, permanently
supported call shapes for `showToast`; pick whichever reads best, don't
mix conventions within one codebase without reason:

```ts
// Options object: default choice once you need more than a bare message
toasts.showToast('Saved!', { color: ToastColor.SUCCESS, duration: 5000, title: 'Done' });

// Legacy positional: message, color, duration(ms), closable, allowHtml (5 args, all after message optional)
toasts.showToast('Saved!', ToastColor.SUCCESS, 5000, false, false);

// Fluent builder: chainable, same options object under the hood
new ToastBuilder('Saved!').asSuccess().withDuration(5000).withTitle('Done').show();
```

`showToast()` returns the toast's `id` (string); save it if you'll
`removeToast`/`updateToast`/control its timer later. Defaults: `color`
`ToastColor.INFO`, `duration` `3000`ms, `closable` `true`, `allowHtml`
`false`, `allowLineBreaks` `true` (all overridable via `configure()`).

**Content rule**: `message`/`title`/every button label/detail label-value
render as plain text; `\n` and literal `<br>`/`<br/>` still become real
line breaks (opt out with `allowLineBreaks: false`), nothing else is
parsed. Pass `allowHtml: true` for an HTML string (sanitize it yourself;
`title` is never affected by `allowHtml`). Pass a real `Node` as `message`
for fully custom interactive content: appended directly, no `innerHTML`,
no XSS surface, `allowHtml` irrelevant.

## Buttons

```ts
// Plain action button
toasts.showToast('Item deleted.', {
  buttons: [{ label: 'Undo', onClick: (event, id) => { toasts.removeToast(id); /* ... */ } }],
});

// Ready-made close button
toasts.showToast('Saved.', { buttons: [toasts.closeButton()] });

// Confirm-before-action: swaps the WHOLE toast (message+buttons+color) to a Yes/No step,
// then to a pending step (if pendingMessage set) while onConfirm's promise runs, then a
// "Done" flash: restores original title/message/buttons/color, or closes (doneAction:'close')
toasts.showToast('3 items selected.', {
  buttons: [toasts.confirmButton('Delete', async (event, id) => { await deleteItems(); }, {
    confirmColor: ToastColor.ERROR, doneAction: 'close',
  })],
});

// Multi-step: general-purpose primitive behind confirmButton/detailsCopyButton.
// A step's onClick returning `false` stays on that step instead of advancing.
toasts.showToast('Draft ready.', {
  buttons: [toasts.stepButton([
    { label: 'Publish', onClick: () => publish() },
    { label: 'Published!', revertAfterMs: 2000 },
  ])],
});
```

Button clicks never trigger the toast's own `closable` dismiss (they
`stopPropagation()`). `confirmButton()` and `stepButton()`/
`detailsCopyButton()` both call `resetToastTimer(id)` on every click so the
toast can't auto-dismiss mid-interaction; do the same yourself in a plain
button's `onClick` if you want that.

## Details (expandable extra info)

```ts
toasts.showToast('Action failed.', {
  color: ToastColor.ERROR,
  details: [
    { label: 'Error', value: '500', buttons: [toasts.detailsCopyButton('500')] },
    'Plain string is shorthand for { value: "..." }',
  ],
});
```

Auto-adds a "Details" toggle button. `detailsCopyButton(text)` is the only
built-in way to make a detail copyable; nothing is copyable by default.

## Removing / updating

```ts
toasts.removeToast(id);
toasts.removeAllToasts(); // every position, animated out individually
toasts.showToast('New', { removeOtherToasts: true }); // dismiss everything else first

// updateToast is a PATCH: only keys present in `update` change. buttons/details/theme
// are whole-value replacements, not merges; use addToastButton/removeToastButton/
// addToastDetail/removeToastDetail for incremental changes without rebuilding the array.
toasts.updateToast(id, { message: 'Upload complete!', color: ToastColor.SUCCESS });
toasts.addToastButton(id, { label: 'Retry', onClick: retry });

// Animate an update instead of an instant swap:
toasts.updateToast(id, { message: 'Done', transition: ToastTransition.FADE }); // or SHAKE_LR
```

`position`/`animation`/`removeOtherToasts`/`reverseOrder` are accepted by
`updateToast` (shape-compatible with `ToastOptions`) but are no-ops
post-creation.

## Promise-based toasts

```ts
toasts.promise(fetch('/api/x').then(r => r.json()), {
  loading: 'Loading...',
  success: (data) => `Got ${data.length} items`,
  error: (err) => `Failed: ${err.message}`,
});
```

Shows `loading` as a forced-sticky toast immediately, patches to
`success`/`error` (default color `SUCCESS`/`ERROR`, duration reverts to the
configured default) once the promise settles. Omit `success`/`error` to
just dismiss on that outcome. Returns `promise` unchanged; still needs
your own `.catch` to avoid an unhandled rejection.

## Timers

```ts
toasts.pauseToastTimer(id);
toasts.resumeToastTimer(id);
toasts.resetToastTimer(id);          // back to full duration
toasts.resetToastTimer(id, 8000);    // new duration, sticks for future resets
toasts.extendToastTimer(id, 2000);   // add/remove ms
toasts.removeToastTimer(id);         // cancel: toast becomes sticky
toasts.getToastTimer(id);            // { duration, remaining, paused } | null
```

All no-ops on a sticky toast (`duration: 0`); it never has timer state.
`pauseOnHover: true` (default) already pauses/resumes on hover automatically.

## Progress bar

```ts
toasts.showToast('Uploading…', { duration: 6000, progress: { mode: 'drain' } }); // synced to countdown

const id = toasts.showToast('Uploading…', { duration: 0, progress: { mode: 'manual' } });
toasts.setToastProgress(id, 0.5); // drive it yourself, 0-1, works on sticky toasts
```

`mode`: `'fill'` (empty→full), `'drain'` (full→empty, default), `'manual'`
(ignores the timer entirely; set via `setToastProgress`).

## Animations (entrance/exit/reflow)

```ts
toasts.configure({ animation: ToastAnimation.FADE }); // or SLIDE (default) / NONE
```

Custom via `registerToastAnimation(name, { containerTransition, enterFrom, enterTo, exit, exitDurationMs })`.

## Theming

```ts
toasts.configure({ theme: { background: '#1e1e2e', text: '#cdd6f4', actionColor: '#89b4fa' } });
toasts.showToast('Heads up.', { theme: { background: '#2a2a3d' } }); // merges over the default
```

Fields: `background` (`--bt-background`, default `#333`), `text`
(`--bt-text`, `#fff`), `detailsBackground` (`--bt-details-background`,
`rgba(0,0,0,0.15)`), `actionColor` (`--bt-action-color`, defaults to
`text`), `closeIcon` (`--bt-close-icon`, auto-picked dark/light for
contrast against `color` unless set). Every field also works as a plain
CSS custom property on `.bt-toast` with no JS involved.

## Localization

```ts
toasts.configure({ locale: 'de' }); // force a bundled pack: en (default) / de / es / fr
toasts.configure({ translations: { close: 'Schließen' } }); // partial override
```

Only affects the library's own chrome text (close/details/copy/confirm
labels, aria-label); your own `title`/`message`/button text is never
auto-translated. Separately, `ToastQuickActions.yes()/.no()/.ok()/
.cancel()/.confirm()/.dismiss()/.undo()/.retry()/.save()/.delete()`
gives pre-translated common words for your own labels, independent of
`configure()`'s locale.

## Config

```ts
toasts.configure({ duration: 4000, position: ToastPosition.BOTTOM_CENTER, maxToasts: 5 });
toasts.configurePosition(ToastPosition.TOP_RIGHT, { maxToasts: 2 }); // per-position override

// Page/section-scoped defaults without a second visual container:
const pageToasts = new Toasts();
pageToasts.configure({ color: ToastColor.WARNING });
```

Six positions (`ToastPosition.BOTTOM_CENTER` default,
`TOP_CENTER`/`TOP_LEFT`/`TOP_RIGHT`/`BOTTOM_LEFT`/`BOTTOM_RIGHT`). Below
`responsiveBreakpoint` px (default `800`), `*-left`/`*-right` collapse into
their edge's `*-center`. `maxToasts` (default `5`, per position) +
`evictOldest` (default `true`, oldest-by-creation-order) cap how many show
at once.

## Common mistakes to avoid

- Don't hand-roll "click to arm, click again to confirm"; use `confirmButton()`.
- Don't rebuild `buttons`/`details` arrays by hand for one insert/remove; use `addToastButton`/`removeToastButton`/`addToastDetail`/`removeToastDetail`.
- Don't call `resetToastTimer`/`extendToastTimer` expecting it to make a sticky (`duration: 0`) toast timed; it won't. Pass `duration` explicitly.
- Don't assume `updateToast({ buttons: [...] })` merges; it replaces the whole array.
- Don't reach for `setToastData`/`getToastData` as general app state; it's meant for one narrow case: a shared button handler looking up a per-toast payload by the `id` it already receives.
- When using a page-scoped `new Toasts()` instance, call `.closeButton()`/`.confirmButton()`/etc. on *that* instance, not the shared `toasts` singleton, so the button dismisses via the right instance.
