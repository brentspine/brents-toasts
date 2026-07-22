/*
  Where a toast's snackbar container renders on screen.
  Only BOTTOM_CENTER is actually implemented (CSS + stacking direction).
  The rest are reserved so a future implementation only needs to add CSS
  and register itself in IMPLEMENTED_POSITIONS — Toasts.ts already keys
  its containers by position. Passing an unimplemented value falls back
  to BOTTOM_CENTER with a console warning instead of failing silently.
*/
export const ToastPosition = {
    BOTTOM_CENTER: 'bottom-center',
    // Reserved for future implementation:
    TOP_CENTER: 'top-center',
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right',
} as const;

export type ToastPositionValue = typeof ToastPosition[keyof typeof ToastPosition];

export const IMPLEMENTED_POSITIONS: ReadonlySet<ToastPositionValue> = new Set([ToastPosition.BOTTOM_CENTER]);
