/*
  Which structural "look" a toast renders with - close button position/
  visibility, card background, and any other future layout-level (not
  color) difference. `layout` is deliberately kept to a handful of named,
  recognizable "starter looks" (`default` plus real design patterns worth
  a name) rather than one entry per modifier - see ToastModifier.ts for
  the small composable tweaks (`compact`, `wide`, `close-corner`, ...)
  those looks are built from and that can also be reached for directly.
  A layout is a *preset*: it's defined as the set of ToastModifier.ts
  modifiers it composes (see the registry below), so its actual CSS lives
  exactly once, in each modifier's own `[data-bt-modifiers~="name"]` rules -
  never duplicated per layout. A layout composing just one modifier isn't
  worth a name of its own - reach for that modifier directly instead (e.g.
  there's no `ToastLayout.CLOSE_HIDDEN` - pass `modifiers:
  [ToastModifier.CLOSE_HIDDEN]`). Toasts.ts stamps `data-bt-layout="<name>"`
  on `.bt-toast` (for simple external CSS targeting, and so a bare custom
  registration - see `registerToastLayout` below - can still write its own
  from-scratch `[data-bt-layout="name"]` CSS), and separately unions this
  layout's modifiers with any explicitly-passed `ToastOptions.modifiers`
  into `data-bt-modifiers` - see ToastModifier.ts. Passing an unrecognized
  layout name still falls back to `default` with a one-time console
  warning, same as an unrecognized `position`/`animation`.
*/

import { ToastModifier, type ToastModifierValue } from './ToastModifier';

export const ToastLayout = {
    DEFAULT: 'default',
    PROMINENT: 'prominent',
} as const;

// Widened so a name registered via registerToastLayout still type-checks in
// ToastOptions/ToastBuilder.withLayout()/configure() without a cast - same
// pattern as ToastAnimationValue/ToastTransitionValue.
export type ToastLayoutValue = typeof ToastLayout[keyof typeof ToastLayout] | (string & {});

// name -> the modifiers it expands to. An empty array means "no modifiers" -
// `default` (today's hover-revealed left accent bar, entirely from
// toasts.css's unscoped base rules) for a built-in, or "nothing beyond your
// own hand-written [data-bt-layout=name] CSS" for a bare
// `registerToastLayout(name)` call with no second argument.
const registry = new Map<string, ToastModifierValue[]>([
    [ToastLayout.DEFAULT, []],
    // Deliberately named PROMINENT rather than after either modifier it
    // composes (avoids the earlier confusion of a layout and a modifier
    // sharing one identifier while meaning different things) - a filled,
    // always-visible-close card is the "hard to miss" look, composed from
    // two independent, individually-reusable modifiers rather than one
    // bundled always-visible-close-plus-filled-background modifier.
    [ToastLayout.PROMINENT, [ToastModifier.CLOSE_PINNED_RIGHT, ToastModifier.FILLED_BACKGROUND]],
]);

/**
 * Registers `name` as a known layout so it no longer falls back to `default`
 * with a warning. `modifiers`, if given, is what this layout expands to -
 * e.g. `registerToastLayout('banner-with-close', [ToastModifier.FULL_BLEED,
 * ToastModifier.CLOSE_CORNER])` reuses those built-ins' existing CSS
 * verbatim. Omit it (or pass `[]`) for the original behavior: a purely
 * custom look with no modifier composition, defined entirely by your own
 * `[data-bt-layout="name"]` CSS (see `docs/guide/layouts.md`).
 */
export function registerToastLayout(name: string, modifiers: ToastModifierValue[] = []): void {
    registry.set(name, modifiers);
}

/** Whether `name` is a built-in or previously-registered layout. */
export function isKnownLayout(name: string): boolean {
    return registry.has(name);
}

/** The modifiers `name` expands to - `[]` if `name` is unknown or composes none of its own. */
export function getLayoutModifiers(name: string): ToastModifierValue[] {
    return registry.get(name) ?? [];
}
