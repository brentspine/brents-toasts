# Roadmap

Ideas rescued from an old Angular/ng-bootstrap toast implementation
(`brentspine/transfer`), sorted by what's scaffolded vs. what's still open.
Goal of this pass was to prepare the config surface (position, animation,
per-toast options) without fully implementing every value yet.

## Scaffolded (config accepted, partially implemented)

- **`ToastAnimation`** (`src/ToastAnimation.js`) — only `SLIDE` (the existing
  bottom-offset + opacity transition) is implemented. `FADE` falls back with
  a warning. Needs an opacity-only transition path in `showToast`/`removeToast`
  that skips the `bottom` animation.
- **`showToast(message, options)` vs. builder vs. legacy positional args** —
  all three are implemented and equivalent (`ToastBuilder.show()` and the
  legacy `showToast(message, color, duration, closable, allowHtml)` both
  normalize into the same options object as `showToast(message, { ... })`).
- **`title`** — supported end-to-end (option, builder, rendering), always
  plain text regardless of `allowHtml`.
- **`onClose`**, **`removeOtherToasts`** — supported end-to-end.
- **`configure()`** for library-wide defaults (position, animation, color,
  duration, closable, allowHtml, maxToasts, evictOldest) — supported.
- **Custom content** — `message` accepts either a string (plain text, or
  HTML via `allowHtml`) or a real `Node` (`HTMLElement`/`DocumentFragment`),
  appended directly with no `innerHTML`/XSS surface. Supported in both
  `showToast()` and `ToastBuilder`.

## Decided (don't re-litigate)

- **`ToastPosition`** (`src/ToastPosition.ts`) — all six positions
  (`BOTTOM_CENTER`/`BOTTOM_LEFT`/`BOTTOM_RIGHT`/`TOP_CENTER`/`TOP_LEFT`/
  `TOP_RIGHT`) are implemented and in `IMPLEMENTED_POSITIONS`. Vertical
  anchoring (top vs. bottom edge, stacking direction) is driven by
  `POSITION_EDGE` — `Toasts.ts`'s `_recalculatePositions`/
  `_stackExistingAway`/`showToast` read it off the snackbar's own
  `data-position` instead of hardcoding `bottom`. Horizontal alignment is
  pure CSS: `.bt-snackbar[data-position$="-left"/"-right"]` set
  `align-items`, relying on the CSS static-position algorithm for the
  (`position: fixed`) toast containers — no JS needed for that half.
  `maxToasts`/`evictOldest` already apply per position for free, since
  `Toasts.snackbars` was already a `Map<position, containerElement>`.
- **`buttons: ToastButton[]`** — the generic, deliberate replacement for
  porting `Hinweis`/`ToastClick` directly (see "Not ported" below). Supported
  end-to-end (`ToastOptions`, `ToastBuilder.withButton()`, rendered as
  `.bt-toast-actions`/`.bt-toast-action` — styled as plain clickable text, not
  native-looking buttons, per design intent). Buttons render as a flex
  sibling of the title/message column so they vertically center regardless
  of whether `title` is present, and clicks/keyboard activation both
  `stopPropagation()` so they never trigger the toast's own `closable`
  dismissal. `onClick(event, id)` gives consumers the toast's own id, so
  patterns like "Undo" (dismiss + show a new toast) are buildable without a
  dedicated built-in API.
- **`details: (string | ToastDetailItem)[]`** — the fuller, purpose-built
  replacement for `Hinweis`'s expand/collapse + clipboard-copy UX (see "Not
  ported" below). Auto-adds a "Details" toggle button; the revealed block
  (`.bt-toast-details`) is a sibling of `.bt-toast-row` (the part that
  actually has the click/keydown-to-dismiss listeners), not a descendant of
  it — so it's structurally impossible for anything inside it (including a
  hover near it) to trigger dismissal, not just accidentally-prevented via
  `stopPropagation()`. A `ResizeObserver` on every toast's root element calls
  `_recalculatePositions` on any height change — covers details being
  toggled open/closed, and any other future in-place content mutation — so
  an expanded toast never overlaps the ones stacked above it. Nothing is
  copyable automatically: an earlier pass auto-added a per-item "Copy"
  button (opt-out via `copyable`/`detailsCopyable`), but that baked-in
  default was reverted — see `Toasts.detailsCopyButton()` below for the
  opt-in replacement. Don't re-add an auto-shown copy button.
- **`Toasts.closeButton()`** / **`ToastBuilder.withCloseButton()`** and
  **`Toasts.detailsCopyButton()`** — a small set of ready-made `ToastButton`
  factories ("standard buttons") consumers append to `buttons` (or a details
  item's own `buttons`) instead of hand-wiring the `onClick` themselves —
  `closeButton()` replaces `onClick: (e, id) => toasts.removeToast(id)`,
  `detailsCopyButton(text)` replaces the clipboard-write-and-flash-the-label
  dance. Both are opt-in per call site (nothing is added unless a consumer
  explicitly pushes it into `buttons`), deliberately unlike the reverted
  auto-copy-button behavior above — mirrors how `buttons` itself already
  works, so there's one mental model for "extra actions on a toast," not two.
  `closeButton()` is a method on `Toasts` (not a free function) so it closes
  over the right instance's `removeToast` — matters for the page-scoped-
  instance pattern (see "Config: project-wide vs. page/section-local" in the
  README), where a button built from the wrong instance would call
  `removeToast` without that instance's `_onCloseCallbacks`/
  `_resizeObservers` bookkeeping. `detailsCopyButton()`'s clipboard-write
  doesn't need an instance, but lives there too for discoverability/symmetry
  with `closeButton()`. Both take their button label(s) as plain parameters
  (`closeButton`'s `label` defaults `"Close"`; `detailsCopyButton`'s `label`/
  `copiedLabel` default `"Copy"`/`"Copied!"`) rather than hardcoded strings,
  same as `detailsLabel`/`detailsHideLabel` — so they're already
  override-friendly for whenever localization is added, instead of needing a
  rework then.
- **`ToastButtonStep`** / **`Toasts.stepButton()`** / **`Toasts.confirmButton()`**
  (`src/ToastButton.ts`) — the general-purpose multi-step engine behind
  advanced action-bar buttons (temporary feedback, confirm-before-action).
  `ToastButton` itself is deliberately left untouched (no union arm, no new
  optional fields) — `stepButton(steps, className?)` instead *produces* a
  plain `ToastButton` whose `onClick` walks through `steps` in order,
  exactly like `closeButton()`/`detailsCopyButton()` already produce plain
  `ToastButton`s. This is a direct lesson from the `detailsCopyable`/
  `detailsCopyableSingle` revert above: that design bolted config knobs
  onto `ToastOptions`/`ToastDetailItem` and got reverted back to a small
  opt-in factory; the steps engine follows that same factory precedent
  instead of repeating the bolted-on-config mistake one level up as a
  `ToastButton` union. Per-step state (current index, pending revert
  timer) lives in a `WeakMap<HTMLButtonElement, ...>` keyed off the
  rendered `<button>` itself — not in the `stepButton()`/`confirmButton()`
  call's closure — so the exact same returned `ToastButton` descriptor is
  safe to reuse across multiple simultaneously-visible toasts without
  their state machines colliding, and so state is released automatically
  once a toast's button is removed; this mirrors `Toasts`'s own
  `_onCloseCallbacks`/`_resizeObservers: WeakMap<HTMLElement, ...>` fields.
  Advancing is always `min(currentIndex + 1, steps.length - 1)` — there's
  deliberately no jump-to-arbitrary-step field, since every real flow so
  far (2-step copy feedback, 3-step confirm) is strictly sequential. A
  step's `onClick` can return (or resolve to) `false` to stay on that step
  instead of advancing — a guard that isn't met, or a failed action — and
  a `Promise` return disables the button until it settles so a slow/real
  action can't be double-fired by a second click. `detailsCopyButton()`
  is now implemented on top of `stepButton()` (2 steps: the copy itself,
  then a `revertAfterMs`-timed "Copied!"); this is not perfectly identical
  to the old hand-rolled implementation — one **deliberate, accepted
  divergence**: clicking again while "Copied!" is showing no longer
  re-copies/re-arms via a fresh clipboard write (that step has no
  `onClick` of its own), it just resets the reveal timer. `closeButton()`
  needed no changes at all — a single fire-and-forget dismiss has no
  feedback/revert cycle, so it never touches the steps engine.
  `stepButton()`/`confirmButton()` are `Toasts` methods (not free
  functions), same discoverability/symmetry rationale as
  `detailsCopyButton()` above, even though the engine itself needs no
  `Toasts` instance.

- **Exports**: `src/index.ts` exports `toasts` (singleton) both as a named
  export and as `default`, alongside `Toasts`, `ToastColor`,
  `ToastPosition`, `ToastAnimation`, `ToastBuilder`. Both `import { toasts }
  from 'brents-toasts'` and `import toasts from 'brents-toasts'` must keep
  working — dropping either broke the live demo once already (v2.0.2).
- **UMD global**: `window.BrentsToasts` is a namespace object mirroring the
  ESM named exports 1:1 (`BrentsToasts.toasts`, `BrentsToasts.Toasts`, ...),
  not the singleton itself. Comes for free from `rollup.config.js`'s `{
  format: 'umd', exports: 'named', name: 'BrentsToasts' }` — don't change
  `exports` to `'default'` there.
- **Demo header GitHub badge**: fetches `stargazers_count` from
  `api.github.com/repos/Brentspine/brents-toasts` client-side (unauthenticated,
  same pattern as the existing changelog `raw.githubusercontent.com` fetch),
  formatted compactly (`2100` → `"2.1k"`). Lives in the same flex row as the
  `<h1>` so it never pushes below the fold on mobile; below 420px the
  "Star on GitHub" label itself is hidden and only the icon/star/count remain,
  rather than wrapping to a second line. The "All releases & changelogs" link
  next to "Other versions" points straight at the GitHub Releases page instead
  of duplicating changelog content in the demo.
- **Demo footer repo stats**: `loadGithubRepoInfo()` makes a single fetch to
  `api.github.com/repos/Brentspine/brents-toasts` and feeds both the header
  star badge and the footer stats row, instead of fetching twice. Footer shows
  owner avatar + "Built by @login" (links to the profile), open issue count,
  fork count, and watcher count (each linking to the matching GitHub page),
  plus a relative "Last commit" time computed from `pushed_at` (hand-rolled
  formatting, hover title shows the absolute local timestamp) — same
  unauthenticated-fetch-with-silent-fallback pattern as the star badge.
- **Timer control** (`pauseToastTimer`/`resumeToastTimer`/`resetToastTimer`/
  `extendToastTimer`/`removeToastTimer`, all `Toasts` methods taking the
  toast's own `id`) — the generic interface for pausing, resetting,
  extending, or cancelling a toast's auto-dismiss countdown, for the library
  itself and consumers alike to build on ("pause on hover", "reset on
  interaction", etc. are all just call sites of this, not separate features).
  State (`duration`/`remaining`/`startedAt`/`timeoutId`) lives in a
  `WeakMap<HTMLElement, ToastTimerState>` keyed off the toast's own root
  element, mirroring `_onCloseCallbacks`/`_resizeObservers`. Deliberately
  **only created for `duration > 0`** — a sticky toast (`duration: 0`) never
  gets an entry, which is what makes every method above a safe no-op for it
  rather than needing an explicit sticky check at every call site. This is
  the direct fix for the bug this feature had to avoid: hovering, then
  un-hovering, a sticky toast must never cause it to start (and later fire) a
  timer it was never supposed to have. `resetToastTimer`/`extendToastTimer`
  keep that same guarantee — no-ops on a sticky toast rather than
  "helpfully" promoting it into a timed one; pass `duration` at `showToast()`
  time if that's actually wanted.
  - **`pauseOnHover`** (`ToastOptions`/`ToastsConfig`, defaults `true`) —
    built directly on the timer control API above: `mouseenter`/`mouseleave`
    listeners on the toast's root call `pauseToastTimer`/`resumeToastTimer`.
    Listeners are unconditionally attached whenever `pauseOnHover` isn't
    explicitly turned off, even for a toast that turns out to be sticky —
    safe, since both calls no-op without timer state to act on.
  - **`confirmButton()`** now calls `resetToastTimer(id)` on every click
    (both the initial "arm" click and the confirm click) — the concrete
    "reset the timer on button click" example this was built for: without
    it, a toast could time out and disappear while showing "Are you sure?",
    losing the in-progress confirmation out from under the user.
  - Every other built-in that shows a temporary, click-driven state gets the
    same treatment, not just `confirmButton()`: **`detailsCopyButton()`**
    resets on click too (so the "Copied!" flash can't get cut short), and
    opening the auto-added **Details toggle** button resets on open (so a
    toast whose details someone just asked to read doesn't vanish mid-read).
    Closing details, and clicking any *plain* `buttons`/detail-item button a
    consumer supplied themselves, deliberately don't auto-reset anything —
    only the library's own built-ins reach for `resetToastTimer()`; a
    consumer's own `onClick` opts in explicitly, same "up to the developer"
    stance as the timer API itself.
  - **`getToastTimer(id)`** — the read-only counterpart to the control
    methods above: `{ duration, remaining, paused } | null`, computed fresh
    per call (not a live-updating subscription — polled from a click/interval
    if a consumer wants a live countdown). `null` for the same two cases
    every control method already no-ops on: `id` doesn't exist, or it's
    sticky.
  - **`data` (`ToastOptions`/`ToastBuilder.withData()`) + `getToastData(id)`/
    `setToastData(id, data)`** — arbitrary per-toast data, stored in a
    `WeakMap<HTMLElement, unknown>` (`_data`) exactly like `_timers`/
    `_onCloseCallbacks` above, so it's released automatically once a toast
    is gone. The motivating case: an "Undo" button whose target differs per
    toast (which item to restore) doesn't need a bespoke `onClick` closure
    per toast just to capture that — attach the item as `data` at
    `showToast()` time, then one handler function, reused as-is across every
    toast's `buttons`, reads it back via `getToastData(id)` using the `id`
    its `onClick(event, id)` already receives. Demoed in `demo/app.js`'s
    "More examples" disclosure (`runSharedUndoDemo()`) alongside
    `getToastTimer()` — one "Undo"/"Time left" handler pair shared across 3
    simultaneously-shown toasts, not 3 separate closures.
  - **Demo: "More examples" disclosure** (`demo/index.html`'s
    `.advanced-presets`) — a second, collapsed-by-default `<details>` below
    the always-visible `.preset-row`, for demos that don't reduce to "fill
    in this toast's options" (multi-toast flows, shared handlers) and so
    can't reuse the existing quick-fill-the-form preset mechanism. Keeps the
    always-visible preset row from growing indefinitely as more of these
    ship — new entries go in `.preset-row-scroll` inside the disclosure
    (horizontal-scrolling, not wrapping, so it never pushes the page down
    either) instead of a 6th/7th/... top-level preset button. The disclosure
    arrow styling (`.disclosure` class) was factored out of what was
    `.playground`-only CSS so both `<details>` blocks share it, instead of
    duplicating the summary-arrow rules for the second one.

## Not ported (from the old codebase, intentionally)

- **`Hinweis`** — a list-of-detail-items-with-clipboard-copy feature tied to
  a specific internal API error-object shape from the old employer's backend
  (`Hinweis.getHinweisListFromApiErrorObject()` there parsed that shape
  directly). The *generic* UX it needed — expandable, distinct, per-item
  copyable details — is now built-in via `details`/`ToastDetailItem` (see
  "Decided" above). What's still intentionally not ported is the
  employer-specific error-object parsing itself and the "too many
  lines/items → collapse to a single copy-all button" density heuristic from
  the old `hinweisLineCountToBig()`; both are one-off concerns an app can
  layer on top by mapping its own error shape into `details` items itself.
- **Click-to-open-modal (`ToastClick` + `NgbModal`)** — Angular DI specific.
  If wanted, the vanilla equivalent is just exposing a raw `onClick` option
  and letting consumers open whatever modal/dialog they use.

## Open questions for later

- Per-position `maxToasts`/eviction (old code filtered by position before
  applying the cap) — right now `maxToasts`/`evictOldest` apply per
  snackbar container, which already gives this for free once more positions
  exist, but hasn't been tested with >1 real container.
- Whether `TOAST_HEIGHT`/`TOAST_BOTTOM_OFFSET`/`TOAST_TRANSITION_MS` should
  move from module constants into `configure()` (relevant once toasts can
  wrap to multiple lines or use the FADE animation).

## Other ideas (note-down now, decide later)
 - Other color options for:
   - close button
   - text color
 - Auto wrap for larger bodies
 - Preset types (define your own types for errors, info, warning and success for example)
 - ~~Compact version list in demo~~
 - ~~Pause timer for disappearing toasts for certain actions or via function call~~
 - ~~Changelog generation for minor and major which also get the changelogs for previous versions as context https://docs.npmjs.com/cli/v10/commands/npm-version?v=true~~
 - Improvement for minor and major releases by checking work and potentially changing args, like Model and max in/out tokens
 - Add a "Copy all" button for details with many items (or just a single long string)
 - ~~Hovering a large toast, that is closable will make the toast grow because of the missing space for the close button. Make it so the close button has enough space to expand without growing the toast. Remember, that we might add other toast designs later on, which would not need the logic.~~
 - not planned, does not make any sense: meta description tag write, if not present
 - Refactor /* 300ms must match TOAST_TRANSITION_MS in Toasts.ts */. Erstmal nicht ig, das ist nen Ding für den Zeitpunkt wenn wir andere Positionen und Styles einfügen
 - Remove Toast Instantly functionality -> No animation or fade, instant removal. Optional: Also instantly move toasts up/down
 - https://not-a-toast.vercel.app/
 - ~~Update toast easily by id~~
 - Reverse Toast Order (newest on top, oldest on bottom)

## Not a toast Ideas

Ranked list (to build into the artifact)

Tier 1 — right now (cheap, high value, architecture already supports it):
1. ❓ Multiline messages (white-space: pre-line on .bt-toast-message) — CSS-only.
2. ✅ Public removeAllToasts() — _removeAllToasts already exists privately, just needs exposing.
3. ✅ Finish TOP_CENTER/TOP_LEFT/TOP_RIGHT/BOTTOM_LEFT/BOTTOM_RIGHT — done, see "Decided" above.
4. Finish FADE animation — already scaffolded, opacity-only path.

Tier 2 — near future (valuable, needs a bit of new infrastructure, but fits the grain of the existing design):
5. ✅ updateToast(id, options) — done, along with addToastButton/removeToastButton/addToastDetail/removeToastDetail for incremental changes. Prerequisite for #6.
6. Promise-based toasts (toasts.promise(promise, { loading, success, error })) — built on #5.
7. Icon system (success/error/info/warn/loader + custom emoji/SVG) — natural pairing with the existing ToastColor semantic colors.
8. Progress bar — genuinely the best architectural fit of anything on this list: getToastTimer()/the _timers WeakMap already track exactly the state (duration/remaining/paused) a progress bar needs to nder.
   CSS custom-property theming layer (--bt-bg, --bt-fg, --bt-radius, ...) via a data-theme attribute (mirrors the existing data-position pattern) — not 40 themes, but the hook for a handful of curated ones.

Tier 3 — distant future (real value, but large scope or needs an architectural rework first):
. A real animation library beyond fade/slide (zoom, bounce, flip, directional slides) — requires switching from JS-computed bottom/opacity to transform+class-toggle CSS keyframes; not a small change.
11. A curated set of built-in themes (5-10, not 40+) once #9's token layer exists.
12. orderReversed stacking — folds naturally into the top-position work (#3) once that stacking-direction logic exists.

Tier 4 — maybe never (conflicts with brents-toasts' already-decided design philosophy, or low value for the added surface area):
. Heavily-styleable/native-looking action buttons and close buttons — ROADMAP.md already documents these as deliberately plain/minimal (see "Decided" section); chasing not-a-toast's button styling knobs reverses a stance the project already took on purpose.
14. 40+ preset themes / 20+ preset animations at parity — conflicts with "lightweight, beginner-friendly" positioning from README.md; bloat risk outweighs benefit vs. a small curated set (#11).
    . Framework-specific wrappers (React/Vue hooks) — not-a-toast doesn't really have these either (framework-agnostic like brents-toasts already is); no real gap to close.