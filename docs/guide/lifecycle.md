# Removing, updating, and promise-based toasts

## Lifecycle events

`toasts.on(event, handler)` subscribes `handler` to one of six events fired over a toast's
lifetime; `toasts.off(event, handler)`, or the unsubscribe function `on()` itself returns,
removes it again:

```ts live
const stop = toasts.on('show', ({ id, severity, message }) => {
  console.log(`toast ${id} fired: [${severity}] ${message}`);
});

toasts.showToast('Saved!', { severity: ToastSeverity.SUCCESS });

stop(); // same as toasts.off('show', handler)
```

| Event | Payload | Fires |
|---|---|---|
| `'show'` | `{ id, severity, message }` | Synchronously inside `showToast()`, before anything renders - the same two extra fields regardless of which of the three call shapes (options object, legacy positional, `ToastBuilder`) produced them, and regardless of any other option passed alongside them. `message` is always a plain string, even for a `Node` message (reduced to its `textContent`, `''` if that's `null`). |
| `'open'` | `{ id }` | Once the toast's DOM element is mounted into its snackbar - after `show`, before the entrance animation has necessarily finished. |
| `'visible'` | `{ id }` | Once the entrance animation finishes (per the resolved `ToastAnimationDefinition`'s `enterDurationMs` - see [Animations](animations.md)) - "the toast is now actually on screen", as distinct from `open`'s "the toast now exists in the DOM". Never fires for a toast that's already gone (dismissed, or evicted) before its own entrance finished. |
| `'update'` | `{ id, update }` | Once per `updateToast(id, update)` call, `update` passed through unmodified - including the internal `updateToast` calls `promise()` makes for its loading→success/error/timeout swap. Not fired for the initial `showToast()` render itself. |
| `'pause'` | `{ id }` | Once the auto-dismiss timer actually transitions to paused - manually via `pauseToastTimer(id)`, or via `pauseOnHover`/`pauseOnPageHidden`. Never fires for an already-paused toast or a sticky one (`duration: 0`, which has no timer state to pause in the first place). |
| `'resume'` | `{ id }` | The `resume` counterpart to `pause` above - same "only on a real transition, never for a sticky toast" rules. |

Multiple handlers on the same event all run (in registration order), independent of each other -
unlike a single `configure()`-style callback, which one `configure()` call would silently replace,
`on()` lets your app's own analytics and, say, a test's spy both listen to `'show'` at once
without stepping on each other:

```ts
toasts.on('show', (e) => trackEvent('toast_shown', e));
toasts.on('show', (e) => console.log('also logged', e));
```

A throwing handler is caught and warned about (`console.warn`), never left to break the toast it's
reporting on or block the other handlers still registered for that event.

Listeners are scoped to the `Toasts` instance they're registered on, same as `configure()`: a
page-scoped `new Toasts()`'s listeners only fire for toasts shown via that instance. `updateToast`/
`pauseToastTimer`/`resumeToastTimer`/etc. delegate to whichever instance actually owns a given
toast `id` when a same-position sibling instance calls them (see "Page/section-local instances"
below), so it's the *owning* instance's listeners that run either way, same as its own `onClose`/
timer state would.

### Testability

`'show'`'s stable `{ id, severity, message }` shape - the same regardless of which `showToast()`
call form produced it, and regardless of later refactors to `showToast`'s own internals - makes it
a better spy target than `showToast` itself for testing "did my code show a toast":

```ts
const onShow = vi.fn(); // or jest.fn()
toasts.on('show', onShow);

runAppCodeThatShowsAToast();

expect(onShow).toHaveBeenCalledWith(
  expect.objectContaining({ severity: ToastSeverity.ERROR, message: 'Failed to save changes.' })
);
```

## Removing toasts

`toasts.removeToast(id)` dismisses a single toast by the id returned from
`showToast`. To clear everything at once, across all positions, use
`toasts.removeAllToasts()`:

```ts live
const id = toasts.showToast('Uploading...', { duration: 0 });
// ...
toasts.removeAllToasts(); // fades out every currently visible toast
```

Each toast still animates out individually via `removeToast` under the hood
(`removeAllToasts` queries the DOM for every `.bt-snackbar`'s children
rather than iterating a fixed list, so it also reaches toasts created by a
different page-scoped `Toasts` instance sharing the same physical
snackbar). `showToast(msg, { removeOtherToasts: true })` does the same thing
before showing its own toast, for the common "replace whatever's on screen"
case.

## Updating a toast

`toasts.updateToast(id, update)` changes an already-shown toast in place,
instead of removing it and showing a new one. `update` is the same shape as
`showToast`'s `options` (plus `message`, since that's normally the separate
first argument); only the keys you pass change, everything else about the
toast stays as it was:

```ts live
const id = toasts.showToast('Uploading…', { color: ToastColor.INFO, duration: 5000 });

toasts.updateToast(id, {
  message: 'Upload complete!',
  color: ToastColor.SUCCESS,
});
```

A common use: reflecting `getToastTimer(id)`'s countdown back onto the toast
itself instead of spawning a new one every time; see [Timers](timers.md).

`buttons`/`details`/`theme` passed to `updateToast` **replace the whole
array/object** (unlike the key-by-key merge `theme` gets against
`configure()`'s default at creation time). To append or insert/remove a
single button or detail line without reconstructing the current array
yourself, use:

```ts
toasts.addToastButton(id, { label: 'Retry', onClick: retry });     // append
toasts.addToastButton(id, { label: 'Retry', onClick: retry }, 0);  // insert at index 0
toasts.removeToastButton(id, 0);

toasts.addToastDetail(id, 'Retried once already');
toasts.removeToastDetail(id, 1);
```

`position`, `animation`, `removeOtherToasts`, and `reverseOrder` are
accepted (for shape-compatibility with `ToastOptions`) but are no-ops here;
they only describe how a toast is shown, not a state it can be updated
into. `updateToast` is a no-op if `id` doesn't exist.

Passing `duration` restarts the countdown at the new value (or cancels/starts
a timer outright, if the toast was sticky or vice versa); see
[Timers](timers.md) for finer-grained alternatives like `extendToastTimer`,
which adjust the countdown without also touching the toast's content.

## Transitions (animating an update)

Pass `transition` alongside a visual change (`message`, `color`, `title`,
`buttons`, `progress`, ...) to animate into it instead of swapping
instantly:

```ts
toasts.updateToast(id, {
  message: 'Upload complete!',
  color: ToastColor.SUCCESS,
  transition: ToastTransition.FADE,
});
```

- `ToastTransition.FADE`: the toast fades out (150ms), the update applies,
  then it fades back in (150ms).
- `ToastTransition.SHAKE_LR`: the update applies immediately and the toast
  shakes left-right over it (7 steps, 60ms each), to draw attention to the
  change rather than hide it.
- `ToastTransition.NONE`, or omitting `transition` entirely, applies
  instantly (the default). `NONE` is registered like any other named
  transition, so it can be overridden via `registerToastTransition('none',
  ...)` if you really want that.

Register a custom one with `registerToastTransition(name, { run(toast, mutate) { ... } })`;
call `mutate()` whenever the new content should appear, and pass its
`name` anywhere `transition` is accepted. `run` receives the `.bt-toast`
card element and a `mutate` callback that applies every visual field the
update touched in one go, so a multi-field patch (message *and* color
changing together, say) reads as one clean change instead of pieces
settling at different times.

It's a no-op passed to `showToast`/`ToastBuilder`; there's nothing to
transition from on a toast's first render (`ToastBuilder.withTransition()`
only takes effect if the built options object later reaches `updateToast`/
`promise()` some other way).

Call `toasts.playToastTransition(id, transition)` to play a transition by
itself, with no content change, e.g. to shake a toast that's still waiting
on the user, without patching it via `updateToast`:

```ts
toasts.playToastTransition(id, ToastTransition.SHAKE_LR);
```

## Promise-based toasts

`toasts.promise(promise, messages, options?)` ties a toast to a `Promise`'s
lifecycle; this is the built-in version of the "show a pending toast, then
patch it to success/error" pattern above, for the common case of wrapping a
single `fetch`/async call:

```ts
toasts.promise(
  fetch('/api/posts').then(r => r.json()),
  {
    loading: 'Fetching posts...',
    success: (posts) => `Fetched ${posts.length} posts`,
    error: (err) => `Failed to fetch posts: ${err.message}`,
  }
);
```

It shows `loading` right away as a forced-sticky toast (`duration: 0`;
there's nothing sensible to auto-dismiss into while the promise is still
pending), then, once `promise` settles, patches that same toast via
`updateToast` to `success` or `error`, defaulting the toast's `severity` to
`ToastSeverity.SUCCESS`/`ToastSeverity.ERROR` (and its `color` to
`configure()`'s matching `colors` entry) and its `duration` back to
`configure()`'s current default (so the resolved toast auto-dismisses
normally, unless overridden) unless overridden. `loading`/`success`/`error`
each accept a plain message (shorthand for `{ message }`), a full
`updateToast`-shaped options object, or, for `success`/`error`, a function
of the resolved value/rejection reason returning either, for outcome
messages that depend on the result:

```ts live
toasts.promise(uploadFile(file), {
  loading: { message: 'Uploading…', closable: false },
  success: { message: 'Uploaded!', duration: 4000 },
  error: { message: 'Upload failed.', duration: 6000 },
});
```

Omit `success` or `error` to just dismiss the toast on that outcome instead
of showing one. A third `options` argument is shared `ToastOptions` applied
under the loading toast and both outcomes alike (`position`, `theme`, ...);
per-state entries in `messages` win over it:

```ts live
toasts.promise(
  savePost(post),
  { loading: 'Saving...', success: 'Saved!', error: 'Could not save.' },
  { position: ToastPosition.TOP_RIGHT }
);
```

Set `transition` (on `options`, or per-outcome in `messages`) to animate the
loading→success/error swap instead of an instant jump. Different outcomes
can use different transitions, e.g. fading in on success but shaking on
error:

```ts live
toasts.promise(
  savePost(post),
  {
    loading: 'Saving...',
    success: { message: 'Saved!', transition: ToastTransition.FADE },
    error: { message: 'Could not save.', transition: ToastTransition.SHAKE_LR },
  }
);
```

`promise()` returns `promise` itself, unchanged, so it still resolves/rejects
and can be `await`ed/chained normally; turning a rejection into an `error`
toast here doesn't count as handling it for `promise` itself, so you still
need your own `.catch`/try-catch around it to avoid an unhandled rejection.

### Timeout

`options.timeout` bounds how long the loading toast is allowed to stay
sticky - if `promise` hasn't settled within `timeout` ms, the toast is
patched to a fourth `messages.timeout` entry instead (same shapes as
`success`/`error`, minus the resolved value/reason - just a plain
message/options patch/zero-arg thunk), defaulting the toast's `severity` to
`ToastSeverity.WARNING`:

```ts
toasts.promise(
  fetch('/api/posts').then(r => r.json()),
  {
    loading: 'Fetching posts...',
    success: (posts) => `Fetched ${posts.length} posts`,
    error: (err) => `Failed to fetch posts: ${err.message}`,
    timeout: 'Still working on it...',
  },
  { timeout: 8000 }
);
```

Omit `messages.timeout` to just dismiss the loading toast on timeout instead
of showing one. `promise` itself is never touched by a timeout - it's purely
about what the toast shows; if `promise` settles later anyway, that's
ignored, since the toast has already moved on. `options.timeout` falls back
to `configure()`'s `promiseTimeout` (default `0`, disabled) for a
library-wide default across every `promise()` call.
