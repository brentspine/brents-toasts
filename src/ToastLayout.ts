/*
  Which structural "look" a toast renders with - close button position/
  visibility, and any other future layout-level (not color) difference.
  Unlike ToastAnimation.ts's registry, an entry here carries no behavior:
  Toasts.ts stamps `data-bt-layout="<name>"` on `.bt-toast`, and every actual
  rule lives in plain CSS keyed off that attribute (toasts.css for built-ins,
  a consumer's own stylesheet for a custom one) - the same "or entirely in
  plain CSS, no API involvement" pattern `theme` already follows. Passing an
  unrecognized name still falls back to `default` with a console warning,
  same as an unrecognized `position`/`animation`.
*/

export const ToastLayout = {
    DEFAULT: 'default',
    PERSISTENT_CLOSE_RIGHT: 'persistent-close-right',
    COMPACT: 'compact',
    MINIMAL: 'minimal',
    WIDE: 'wide',
    ACCENT_TOP: 'accent-top',
    STACKED_ACTIONS: 'stacked-actions',
    CLOSE_CORNER: 'close-corner',
    FULL_BLEED: 'full-bleed',
} as const;

// Widened so a name registered via registerToastLayout still type-checks in
// ToastOptions/ToastBuilder.withLayout()/configure() without a cast - same
// pattern as ToastAnimationValue/ToastTransitionValue.
export type ToastLayoutValue = typeof ToastLayout[keyof typeof ToastLayout] | (string & {});

const registry = new Set<string>([
    ToastLayout.DEFAULT,
    ToastLayout.PERSISTENT_CLOSE_RIGHT,
    ToastLayout.COMPACT,
    ToastLayout.MINIMAL,
    ToastLayout.WIDE,
    ToastLayout.ACCENT_TOP,
    ToastLayout.STACKED_ACTIONS,
    ToastLayout.CLOSE_CORNER,
    ToastLayout.FULL_BLEED,
]);

/**
 * Registers `name` as a known layout so it no longer falls back to `default`
 * with a warning. Unlike `registerToastAnimation`, there's no behavior to
 * register here - a layout is purely a `data-bt-layout="<name>"` attribute
 * the library sets on `.bt-toast`; write your own CSS keyed off that
 * attribute (see `docs/guide/layouts.md`) the same way you'd write plain CSS
 * against `.bt-toast` for a custom `theme`.
 */
export function registerToastLayout(name: string): void {
    registry.add(name);
}

/** Whether `name` is a built-in or previously-registered layout. */
export function isKnownLayout(name: string): boolean {
    return registry.has(name);
}
