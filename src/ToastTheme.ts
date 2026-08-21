/**
 * Extra color knobs beyond `ToastOptions.color`/`ToastsConfig.color` - the
 * toast's overall chrome (card, text, details block, action text), not just
 * its accent bar. Settable library-wide via `configure({ theme })`, per-toast
 * via `ToastOptions.theme` (merged over the configured default, key by key),
 * or skipped entirely in favor of plain CSS - every field here mirrors a
 * `--bt-*` custom property on `.bt-toast` (see `toasts.css`), so a stylesheet
 * rule targeting `.bt-toast` or `:root` works with no JS/API involvement at
 * all. Only fields actually set (here or in CSS) override the built-in
 * defaults; everything else keeps the library's normal look.
 */
export interface ToastTheme {
    /** Toast card background. CSS var `--bt-background`. Default `#333`. */
    background?: string;
    /** Toast text color. CSS var `--bt-text`. Default `#fff`. */
    text?: string;
    /** Details block background. CSS var `--bt-details-background`. Default `rgba(0, 0, 0, 0.15)`. */
    detailsBackground?: string;
    /** Action button (and details toggle) text color. Defaults to `text`. CSS var `--bt-action-color`. */
    actionColor?: string;
    /**
     * Close ("×") icon color. Unless set here, it's picked automatically -
     * dark or light - for contrast against the toast's own `color`, so a
     * light accent color (e.g. `#fff`) never renders an invisible white-on-white
     * close icon. CSS var `--bt-close-icon`.
     */
    closeIcon?: string;
}

// Every ToastTheme field except `closeIcon`, which always gets an explicit
// value from `autoCloseIconColor()`/an explicit override rather than being
// left to plain CSS - see the comment on that function.
const THEME_CSS_VARS: Record<Exclude<keyof ToastTheme, 'closeIcon'>, string> = {
    background: '--bt-background',
    text: '--bt-text',
    detailsBackground: '--bt-details-background',
    actionColor: '--bt-action-color',
};

/**
 * Sets (or clears) `--bt-background`/`--bt-text`/`--bt-details-background`/
 * `--bt-action-color` on `el` from `theme`. A key left unset is actively
 * cleared, not skipped - so a later `updateToast` that drops a previously-set
 * field falls back to plain CSS (the stylesheet default, or a consumer's own
 * `.bt-toast { --bt-background: ... }` rule) instead of leaving a stale
 * inline value behind. `closeIcon` is handled separately by
 * `autoCloseIconColor()`'s caller, not here.
 */
export function applyThemeVars(el: HTMLElement, theme: ToastTheme | undefined): void {
    for (const key of Object.keys(THEME_CSS_VARS) as (keyof typeof THEME_CSS_VARS)[]) {
        const value = theme?.[key];
        if (value) el.style.setProperty(THEME_CSS_VARS[key], value);
        else el.style.removeProperty(THEME_CSS_VARS[key]);
    }
}

// Resolves an arbitrary CSS color string (hex, rgb()/rgba(), named, ...) to
// its r/g/b channels by letting the browser's own CSSOM parse it, instead of
// hand-rolling a hex/rgb/named-color parser here. Returns undefined for an
// unparseable string (or outside a DOM environment). Note: named CSS colors
// (e.g. "red") aren't normalized by an uncomputed `style.color` read, only
// hex/rgb()/rgba()/hsl() are - a known limitation shared by every caller of
// this function, not just `isLightColor` below (see `detectSeverityFromColor`
// in `ToastColor.ts`).
export function resolveRgb(color: string): [number, number, number] | undefined {
    if (typeof document === 'undefined') return undefined;
    const probe = document.createElement('span');
    probe.style.color = color;
    const resolved = probe.style.color;
    if (!resolved) return undefined;
    const match = resolved.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!match) return undefined;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Perceived-brightness heuristic (ITU-R BT.601 luma weights), 0-255 scale.
// Threshold 186 is a widely used cutoff for this exact "light or dark icon"
// problem - chosen here specifically because every bundled ToastColor lands
// well under it (~120-171), so the built-in palette keeps its current white
// icon, while true light colors (white, pastels) correctly cross it and flip
// to a dark one. Ignores alpha - a semi-transparent accent is treated as if
// opaque, the same simplification `color`'s other consumers (progress bar,
// role/aria-live) already make.
function isLightColor(color: string): boolean | undefined {
    const rgb = resolveRgb(color);
    if (!rgb) return undefined;
    const [r, g, b] = rgb;
    return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

/**
 * Picks a close-icon color that reads clearly against `accentColor` - `dark`
 * if `accentColor` is light (e.g. white/pastel), otherwise `light` (the
 * library's usual white). Falls back to `light` if `accentColor` can't be
 * resolved (e.g. an unparseable string, or no DOM available yet) - the same
 * safe default the icon has always had.
 */
export function autoCloseIconColor(accentColor: string, dark = '#333', light = '#fff'): string {
    return isLightColor(accentColor) ? dark : light;
}
