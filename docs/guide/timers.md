# Controlling the auto-dismiss timer

A timed toast (`duration > 0`) pauses its own countdown while hovered and
resumes where it left off on mouseleave, no config needed; this is
`pauseOnHover`, on by default (`toasts.showToast(msg, { pauseOnHover: false })`
or `toasts.configure({ pauseOnHover: false })` to turn it off). A sticky toast
(`duration: 0`) is unaffected either way; hovering and un-hovering it never
starts a timer, since it never gets timer state in the first place, so it
can't suddenly disappear after a hover.

`pauseOnHover` covers keyboard/screen-reader focus too, not just the mouse:
tabbing to the toast itself or anything inside it (its close button, an
action button, the "Details" toggle) pauses the countdown the same way,
resuming once focus leaves the toast entirely. Hovering and focusing are
tracked independently under the hood - either one pausing is enough to stop
the countdown, and both have to release before it resumes (e.g. tabbing to a
button leaves it focused even after the mouse moves away, so the timer stays
paused until that button loses focus too). This "focus" tracking only counts
*keyboard* focus, though - clicking a button also focuses it, but that focus
is deliberately ignored, since a mouse click is already covered by hovering
(the pointer has to be over the toast to click something inside it) and,
unlike a genuine Tab, doesn't release on its own when the mouse moves away;
otherwise a clicked button would keep the toast paused indefinitely, with no
way to resume it short of something else stealing focus.

A timed toast also pauses while the page itself is hidden - the browser tab
switched away from, or the window minimized/backgrounded (detected via the
Page Visibility API). This is `pauseOnPageHidden`, on by default (same
`showToast(msg, { pauseOnPageHidden: false })` / `toasts.configure({
pauseOnPageHidden: false })` opt-out as `pauseOnHover`). It's independent of
`pauseOnHover` - either one pausing is enough to stop the countdown, and if
both are active at once (e.g. the mouse is still over the toast when you
switch tabs), both have to release before it resumes, same as hover and
focus do. A toast shown while the page is already hidden starts paused
right away, rather than counting down unseen. Sticky toasts are unaffected
either way, for the same reason `pauseOnHover` doesn't affect them.

`pauseToastTimer`/`resumeToastTimer` (below) are a third, independent pause reason alongside
hover/focus and page-hidden, not an override of them - calling `resumeToastTimer(id)` while the
mouse is still over the toast (e.g. clicking a "Resume" button rendered via `buttons`) clears only
the manual reason; the countdown stays paused until hover (and page-hidden, if also active) release
too, then resumes automatically as soon as the mouse leaves - no extra click elsewhere needed. This
is what stops a manual pause/resume from being silently fought over and undone by the very next
hover/focus event.

For anything else (reset on a button click, extend while a related async
action is running, pause while a dropdown opened from the toast is open), call
the same timer controls the built-in hover behavior is built on, using the
toast's own `id`:

```ts live
const id = toasts.showToast('Uploading…', { duration: 5000 });

toasts.pauseToastTimer(id);   // stop the countdown, remembering time left
toasts.resumeToastTimer(id);  // continue from where it was paused
toasts.resetToastTimer(id);   // back to the full duration, right now
toasts.resetToastTimer(id, 8000); // ...or a new duration, which sticks for future resets
toasts.extendToastTimer(id, 2000); // add (or, negative, remove) time
toasts.removeToastTimer(id);  // cancel it entirely: the toast becomes sticky
```

`extendToastTimer` also raises the toast's stored full duration to match, whenever the extension
pushes `remaining` past it (repeatedly clicking a "+5s" button, say) - otherwise a `progress` bar's
elapsed-fraction math has no accurate "full" length to measure against once `remaining` exceeds it,
and visibly sits frozen at "nothing elapsed yet" until the countdown drops back under the original
duration.

All six are no-ops on a sticky toast: there's nothing to pause, resume,
reset, extend, or remove, because a sticky toast (`duration: 0`) never gets
a timer-state entry in the first place; and `resetToastTimer`/
`extendToastTimer` won't turn a sticky toast into a timed one; pass
`duration` at `showToast()`/via `updateToast(id, { duration })` for that
instead. Every built-in that shows a temporary, click-driven state calls
`resetToastTimer()` for exactly this reason: `confirmButton()` on every
click (so it can't time out from under the user mid-confirmation),
`detailsCopyButton()` on click (so the "Copied!" flash can't get cut short),
and opening the auto-added "Details" toggle (so a toast doesn't vanish
mid-read; closing it does not reset the timer). Plain buttons you supply
yourself (the top-level `buttons` option, or a details item's own) never do
this automatically; call `resetToastTimer(id)` from your own `onClick` if you
want the same behavior.

Reading the countdown back (instead of just controlling it) works the same
way: `toasts.getToastTimer(id)` returns `{ duration, remaining, paused }`
as a fresh snapshot (not a live-updating subscription), or `null` if `id`
doesn't exist or is sticky:

```ts
const info = toasts.getToastTimer(id);
if (info) console.log(`closes in ${(info.remaining / 1000).toFixed(1)}s`);
```

To observe pausing/resuming instead of just triggering it - e.g. to pause a page-level "closing
in Ns" ticker in sync with the toast's own countdown - subscribe to the `'pause'`/`'resume'`
[lifecycle events](lifecycle.md#lifecycle-events) instead of wrapping every timer call yourself:

```ts
toasts.on('pause', ({ id }) => console.log(`${id} paused`));
toasts.on('resume', ({ id }) => console.log(`${id} resumed`));
```

Both only fire on a real pause↔running transition (never for an already-paused/-running toast,
and never for a sticky one, which has no timer state to transition in the first place) - the same
no-op rules the timer methods above already follow.

## Guarding against instant dismissal

Nothing stops a `closable` toast from being clicked away, or `removeToast(id)` called, the
instant it appears - which can happen accidentally (a stray click landing where the toast just
rendered) or as a side effect of a fast-resolving async flow. `minVisibleDuration` guards against
that: a `removeToast()` call that arrives before the toast has been visible for at least this many
ms plays a `ToastTransition.SHAKE_LR` on the card as feedback and is **deferred**, not dropped -
it still closes, just once the remaining time has passed.

```ts live
toasts.showToast('Are you sure?', { duration: 0, minVisibleDuration: 1000 });
```

Set it per-toast (`showToast`'s `options`/`ToastBuilder.withMinVisibleDuration()`) or library-wide
via `configure({ minVisibleDuration })`. `0` (the default) disables the guard entirely. It never
delays a `'timeout'` removal (that's already governed by `duration` itself) or an `'evicted'` one
(`maxToasts` capacity has to be freed immediately) - see [`ToastCloseReason`](lifecycle.md). A
negative or `NaN` value is invalid - warns once and falls back to the configured default, same as
an invalid `duration`.

A common use: reflecting the countdown back onto the toast itself via
[`updateToast`](lifecycle.md) instead of spawning a new one every time:

```ts
const timer = toasts.getToastTimer(id);
const ratio = timer.remaining / timer.duration;
toasts.updateToast(id, {
  message: `Closes in ${(timer.remaining / 1000).toFixed(1)}s`,
  severity: ratio > 0.5 ? ToastSeverity.SUCCESS : ratio > 0.2 ? ToastSeverity.WARNING : ToastSeverity.ERROR,
});
```
