/*
  How a toast enters/leaves the snackbar. Only SLIDE is implemented today
  (the existing bottom-offset + opacity transition). FADE is reserved for
  a future opacity-only variant — see ROADMAP.md.
*/
export const ToastAnimation = {
    SLIDE: 'slide',
    // Reserved for future implementation:
    FADE: 'fade',
} as const;

export type ToastAnimationValue = typeof ToastAnimation[keyof typeof ToastAnimation];

export const IMPLEMENTED_ANIMATIONS: ReadonlySet<ToastAnimationValue> = new Set([ToastAnimation.SLIDE]);
