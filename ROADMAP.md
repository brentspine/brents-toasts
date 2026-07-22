# Roadmap

Ideas rescued from an old Angular/ng-bootstrap toast implementation
(`brentspine/transfer`), sorted by what's scaffolded vs. what's still open.
Goal of this pass was to prepare the config surface (position, animation,
per-toast options) without fully implementing every value yet.

## Scaffolded (config accepted, partially implemented)

- **`ToastPosition`** (`src/ToastPosition.js`) — only `BOTTOM_CENTER` has real
  placement CSS. Other values are accepted, stored, and keyed correctly in
  `Toasts.snackbars` (a `Map<position, containerElement>`), but fall back to
  `BOTTOM_CENTER` at runtime with a console warning. To implement a new
  position: add CSS rules for `.bt-snackbar[data-position="..."]` (left/right/
  top instead of the current bottom-only offset math), decide the stacking
  direction for top-anchored positions (probably needs `_recalculatePositions`
  to grow downward instead of up), then add it to `IMPLEMENTED_POSITIONS`.
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

## Not ported (from the old codebase, intentionally)

- **`Hinweis`** — a list-of-detail-items-with-clipboard-copy feature tied to
  a specific internal API error-object shape from the old employer's backend.
  Not a generic toast concept; would need a fresh design if wanted here
  (e.g. a generic `details: string[]` option with an expand/collapse UI).
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