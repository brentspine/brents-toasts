# Reading a toast's full state

`toasts.getToastState(id)` returns a fresh snapshot of everything there is to know about a
currently-shown toast: its fully-resolved options (defaults already applied, reflecting any
`updateToast` patches since creation - not just the original `showToast()` call) plus its current
`message`, and what's happening to it right now. Returns `null` if `id` doesn't exist:

```ts live
const id = toasts.showToast('Uploading…', { duration: 5000, details: ['file.png (2.1 MB)'] });

const state = toasts.getToastState(id);
console.log(state.color, state.closable, state.message); // the resolved options + current content
```

Like `getToastTimer(id)`, this is a snapshot computed fresh from the moment you call it, not a
live-updating subscription - some fields can be stale moments after the call returns (see below).

## What's on it

Every field of a toast's resolved options (`color`, `severity`, `closable`, `duration`, `theme`,
`buttons`, ...) is included directly, alongside:

- **`message`** - the toast's current content: a plain string, or the exact `Node` passed to
  `showToast`/`updateToast`, if any.
- **`timer`** - the same `{ duration, remaining, paused }` shape `getToastTimer(id)` returns;
  `null` for a sticky toast (`duration: 0`). See [Timers](timers.md).
- **`detailsOpen`** - whether the auto-added "Details" toggle is currently expanded. `false` if
  the toast has no `details` block at all. See [Details](details.md).
- **`transitioning`** - whether an `updateToast(id, { transition })`/`playToastTransition()`
  transition is currently playing on the card. See "Transitions" in [Lifecycle](lifecycle.md).
- **`inStepAction`** - whether any of the toast's buttons is currently mid multi-step flow: a
  `stepButton()`/`detailsCopyButton()` past its first step, or *any* button on the toast disabled
  - which also catches `confirmButton()`'s pending `onConfirm` (it disables every button on the
  toast, not just itself). It does *not* catch `confirmButton()`'s initial Yes/No prompt, since
  that's a full toast content swap rather than a disabled/stepped button. See [Buttons](buttons.md).

```ts live
const id = toasts.showToast('Copy this?', {
  duration: 0,
  buttons: [toasts.detailsCopyButton('some-value')],
});

console.log(toasts.getToastState(id).inStepAction); // false - still on "Copy"
```

## `transitioning`'s limits

`transitioning` is only ever `true` for a transition whose definition sets `durationMs` - the
built-in `ToastTransition.FADE` (300ms round trip) and `ToastTransition.SHAKE_LR` (420ms) both do.
`ToastTransition.NONE` never has a visible duration, and a custom one registered via
`registerToastTransition(name, definition)` without `durationMs` set never reports as
`transitioning` either - there's no way to infer how long an arbitrary `run()` takes without it:

```ts
registerToastTransition('my-transition', {
  run(toast, mutate) { /* ... */ },
  durationMs: 400, // total time from start to finish - lets getToastState() track it
});
```

Because `transitioning`/`timer` are computed fresh per call rather than pushed to you, prefer the
`'update'`/`'pause'`/`'resume'` [lifecycle events](lifecycle.md#lifecycle-events) instead if you
need to *react* the moment something changes, rather than poll `getToastState()` for it.
