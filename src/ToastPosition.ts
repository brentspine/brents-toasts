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
