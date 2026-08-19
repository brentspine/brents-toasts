/*
  Small, composable design tweaks - unlike ToastLayout.ts's structural
  "looks" (mutually exclusive, one per toast), any number of modifiers can
  be active on one toast at once. These are the atomic building blocks:
  every built-in `layout` is defined purely as a named set of these (see
  ToastLayout.ts's registry), and a consumer can reach for any of them
  directly - alone, stacked with each other, or layered on top of a
  `layout` - without needing a named layout at all. Toasts.ts stamps the
  union of a toast's own `modifiers` option and whatever its active
  `layout` implies as a single space-separated
  `data-bt-modifiers="name1 name2"` attribute on `.bt-toast`, and every
  actual rule lives in plain CSS keyed off that attribute via the `~=`
  ("contains this whitespace-separated token") selector (toasts.css for
  built-ins, a consumer's own stylesheet for a custom one) - the same "or
  entirely in plain CSS, no API involvement" pattern ToastLayout.ts/theme
  already follow. Passing an unrecognized name is dropped (with a one-time
  console warning), same as an unrecognized `position`/`animation`/`layout`.

  The three close-button variants (`close-hidden`, `close-corner`,
  `close-pinned-right`) are mutually exclusive in effect - stacking two
  of them produces a well-defined but unintended result (later rule in
  toasts.css wins, see the comments there), not a design a consumer should
  reach for. Same for the density pair `compact`/`wide`. `filled-background`
  is independent of that group - it only changes the card's background
  color, so it stacks cleanly with any of the three close-button variants
  (that's exactly what `ToastLayout.PROMINENT` does - see ToastLayout.ts).
  Nothing stops an unintended combination at the type level, same as
  nothing stops passing two conflicting plain CSS classes - document it,
  don't contort the API to prevent it.
*/

export const ToastModifier = {
    COMPACT: 'compact',
    WIDE: 'wide',
    ACCENT_TOP: 'accent-top',
    STACKED_ACTIONS: 'stacked-actions',
    CLOSE_CORNER: 'close-corner',
    CLOSE_HIDDEN: 'close-hidden',
    CLOSE_PINNED_RIGHT: 'close-pinned-right',
    FILLED_BACKGROUND: 'filled-background',
    FULL_BLEED: 'full-bleed',
} as const;

// Widened so a name registered via registerToastModifier still type-checks
// in ToastOptions/ToastBuilder.withModifiers()/configure() without a cast -
// same pattern as ToastLayoutValue/ToastAnimationValue/ToastTransitionValue.
export type ToastModifierValue = typeof ToastModifier[keyof typeof ToastModifier] | (string & {});

const registry = new Set<string>(Object.values(ToastModifier));

/**
 * Registers `name` as a known modifier so it no longer gets dropped (with a
 * warning) from `data-bt-modifiers`. Like `registerToastLayout`, there's no
 * behavior to register here beyond the name itself - write your own CSS
 * keyed off `[data-bt-modifiers~="name"]` (see `docs/guide/layouts.md`).
 */
export function registerToastModifier(name: string): void {
    registry.add(name);
}

/** Whether `name` is a built-in or previously-registered modifier. */
export function isKnownModifier(name: string): boolean {
    return registry.has(name);
}
