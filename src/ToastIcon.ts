/*
  Opt-in per-toast icon, rendered as `.bt-toast-icon` between the accent bar
  and the message content (see `applyIcon` in ToastRender.ts) - nothing
  renders unless `ToastOptions.icon`/`ToastsConfig.icon`/`ToastsConfig.promiseIcons`
  is explicitly set; there is no automatic severity-derived icon. Follows the
  same name -> concrete-value registry pattern as ToastLayout.ts (a Map, not
  ToastModifier.ts's membership-only Set - a name here always resolves to an
  actual icon source, not just a boolean "is this known").

  A bare `string` means different things depending on which type it's typed
  as: as `ToastIconValue` (what a caller passes to `icon`), a bare string is
  always a registered/built-in *name* to look up - consistent with how
  `layout`/`modifiers`/`animation` already treat bare strings as names, not
  literal values. As `ToastIconSource` (what's stored *in* the registry, or
  what a resolved lookup returns), a bare string instead means literal inline
  SVG markup - it's never re-interpreted as another name, so there's no
  lookup recursion. A raw image URL is never a bare string on either side -
  wrap it as `{ src: url }` - which is what keeps "name" and "URL" from ever
  colliding as the same shape.

  Built-in icons are single-color (`fill="currentColor"`/`stroke="currentColor"`),
  so they inherit the toast's own text color for free - unlike the close
  glyph (which sits on the colored accent bar and needs real contrast
  math, see `autoCloseIconColor` in ToastTheme.ts), the icon slot sits on
  the card's own background, so plain inheritance is enough.
*/

/** What a registered icon name resolves to, or what a raw (non-name) `ToastIconValue` already is
 *  once name-resolution is out of the way. A bare `string` here is literal inline SVG markup. */
export type ToastIconSource = string | { src: string } | { class: string } | Node | (() => Node);

/** Built-in icon names - matches `ToastSeverity`'s naming for the four severity icons, so
 *  `icon: ToastIcon.SUCCESS` reads the same way `withSeverity(ToastSeverity.SUCCESS)` does.
 *  `SPINNER` is a CSS-`@keyframes`-animated loading ring, mainly meant for `ToastsConfig.promiseIcons.pending`. */
export const ToastIcon = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    SPINNER: 'spinner',
} as const;

// Widened so a name registered via registerToastIcon still type-checks in
// ToastOptions/ToastBuilder.withIcon()/configure() without a cast - same
// pattern as ToastLayoutValue/ToastModifierValue.
export type ToastIconNameValue = typeof ToastIcon[keyof typeof ToastIcon] | (string & {});

/** `ToastOptions.icon`'s full shape - a built-in/registered name, an image URL, a consumer-owned
 *  CSS class (icon-font/background-image style), an arbitrary pre-built `Node` (e.g. hand-authored
 *  animated SVG), or a renderer function called fresh on every render (the safest form for a `Node`
 *  that shouldn't be shared/moved between toasts, and the natural place to wire up something like
 *  a Lottie animation without the library depending on it). */
export type ToastIconValue = ToastIconNameValue | { src: string } | { class: string } | Node | (() => Node);

function buildSpinner(): Node {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.classList.add('bt-toast-icon-spin');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '10');
    circle.setAttribute('cy', '10');
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2.5');
    // Gap in the ring (32 of a ~50-long circumference is drawn, rest is gap) is what makes the
    // rotation read as spinning motion rather than a static ring - see the bt-spin keyframes in toasts.css.
    circle.setAttribute('stroke-dasharray', '32 20');
    circle.setAttribute('stroke-linecap', 'round');
    svg.appendChild(circle);
    return svg;
}

const registry = new Map<string, ToastIconSource>([
    [ToastIcon.INFO, '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm1 15H9V9h2v6zm0-8H9V5h2v2z"/></svg>'],
    [ToastIcon.SUCCESS, '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm-1.2 14.6L4.6 10.4l1.4-1.4 2.8 2.8 6-6 1.4 1.4-7.4 7.4z"/></svg>'],
    [ToastIcon.WARNING, '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 1.5L19 18H1L10 1.5zM9 8v5h2V8H9zm0 6.5v2h2v-2H9z"/></svg>'],
    [ToastIcon.ERROR, '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm4.5 12.9L12.9 14.5 10 11.6l-2.9 2.9L5.5 12.9 8.4 10 5.5 7.1 7.1 5.5 10 8.4l2.9-2.9 1.6 1.6L11.6 10l2.9 2.9z"/></svg>'],
    [ToastIcon.SPINNER, buildSpinner],
]);

/** Registers `name` as a known icon, resolving to `source` - like `registerToastLayout`,
 *  usable anywhere a built-in `ToastIcon` name is (`ToastOptions.icon`, `configure({ icon })`,
 *  `configure({ promiseIcons })`, `ToastBuilder.withIcon()`). Overwrites a previous registration
 *  (including a built-in's) if `name` is reused. */
export function registerToastIcon(name: string, source: ToastIconSource): void {
    registry.set(name, source);
}

/** Whether `name` is a built-in or previously-registered icon. */
export function isKnownIcon(name: string): boolean {
    return registry.has(name);
}

/** The concrete source `name` resolves to - `undefined` if `name` is unrecognized. */
export function getIconSource(name: string): ToastIconSource | undefined {
    return registry.get(name);
}
