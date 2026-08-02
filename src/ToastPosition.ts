/*
  Where a toast's snackbar container renders on screen. All six positions
  are implemented: `_getSnackbar` (Toasts.ts) keys a container by position
  and writes `data-position`, `.bt-snackbar[data-position$="-left"/"-right"]`
  (toasts.css) handles horizontal alignment, and `POSITION_EDGE` below
  drives which edge (top/bottom) the vertical stacking math anchors to.
  Passing a value outside `ToastPosition` still falls back to
  BOTTOM_CENTER with a console warning instead of failing silently.
*/
export const ToastPosition = {
    BOTTOM_CENTER: 'bottom-center',
    TOP_CENTER: 'top-center',
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right',
} as const;

export type ToastPositionValue = typeof ToastPosition[keyof typeof ToastPosition];

export const IMPLEMENTED_POSITIONS: ReadonlySet<ToastPositionValue> = new Set([
    ToastPosition.BOTTOM_CENTER,
    ToastPosition.TOP_CENTER,
    ToastPosition.TOP_LEFT,
    ToastPosition.TOP_RIGHT,
    ToastPosition.BOTTOM_LEFT,
    ToastPosition.BOTTOM_RIGHT,
]);

/*
  Which viewport edge a position's snackbar stacks away from. Populated for
  all six positions (not just the implemented one) so the stacking math in
  Toasts.ts is edge-agnostic ahead of time — implementing a new position
  later is then "add CSS + register it in IMPLEMENTED_POSITIONS," not also a
  rewrite of the positioning engine.
*/
export const POSITION_EDGE: Record<ToastPositionValue, 'top' | 'bottom'> = {
    [ToastPosition.BOTTOM_CENTER]: 'bottom',
    [ToastPosition.BOTTOM_LEFT]: 'bottom',
    [ToastPosition.BOTTOM_RIGHT]: 'bottom',
    [ToastPosition.TOP_CENTER]: 'top',
    [ToastPosition.TOP_LEFT]: 'top',
    [ToastPosition.TOP_RIGHT]: 'top',
};

/*
  Below this viewport width (px), `*-left`/`*-right` positions collapse into
  their edge's `*-center` equivalent (see `collapsedPosition`) — on a narrow
  screen a toast's own width approaches the full viewport width, so the
  flexbox alignment that visually separates left/center/right on a wide
  viewport (`.bt-snackbar`'s `align-items` in toasts.css) no longer does,
  and independently-stacking sibling containers can overlap. Configurable
  via `ToastsConfig.responsiveBreakpoint`; `0` disables collapsing entirely.
*/
export const DEFAULT_RESPONSIVE_BREAKPOINT = 800;

/*
  Maps a `*-left`/`*-right` position to its edge's `*-center` equivalent so
  both share one container/stack on narrow viewports; `*-center` positions
  (and anything unrecognized) pass through unchanged. Used by
  `Toasts._effectivePosition` — never applied to the toast's own identity
  `position` (what `getToastOptions`-style introspection reports), only to
  which physical container it renders into.
*/
export function collapsedPosition(position: ToastPositionValue): ToastPositionValue {
    switch (position) {
        case ToastPosition.TOP_LEFT:
        case ToastPosition.TOP_RIGHT:
            return ToastPosition.TOP_CENTER;
        case ToastPosition.BOTTOM_LEFT:
        case ToastPosition.BOTTOM_RIGHT:
            return ToastPosition.BOTTOM_CENTER;
        default:
            return position;
    }
}
