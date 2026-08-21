import { resolveRgb } from './ToastTheme';

export const ToastColor = {
    INFO:    '#28a6f5ff',
    SUCCESS: '#4bb543ff',
    WARNING: '#dfb200ff',
    ERROR:   '#ff4433ff',
} as const;

export type ToastColorValue = typeof ToastColor[keyof typeof ToastColor];

/** Shape of `ToastsConfig.colors` - one default CSS color string per `ToastSeverity`, widened
 *  from the bundled literal hex defaults so a consumer's own palette can substitute any valid
 *  CSS color. Purely a lookup table (`severity` -> default `color`) by default - unlike the
 *  pre-#56 design, nothing matches a `color` value back against this to infer severity *unless*
 *  `ToastsConfig.autoDetectSeverity` is explicitly opted into (see `detectSeverityFromColor`
 *  below); see `ToastSeverity`. */
export type ToastColorPalette = Record<keyof typeof ToastColor, string>;

/** The four severities a toast can carry - see `ToastOptions.severity`. Keys match `ToastColor`'s
 *  (and `ToastColorPalette`'s), since a severity's whole job is naming which palette entry is its
 *  default `color`. */
export const ToastSeverity = {
    INFO:    'INFO',
    SUCCESS: 'SUCCESS',
    WARNING: 'WARNING',
    ERROR:   'ERROR',
} as const;

export type ToastSeverityValue = typeof ToastSeverity[keyof typeof ToastSeverity];

/** Which severities get the assertive `role="alert"`/`aria-live="assertive"` treatment
 *  (`WARNING`/`ERROR`) vs. the passive `role="status"`/`aria-live="polite"` one (everything
 *  else). The sole source of a toast's accessible role - `color` has no bearing on it at all,
 *  see `applyColor` in `ToastRender.ts`. */
export const SEVERITY_ROLE: Record<ToastSeverityValue, 'alert' | 'status'> = {
    INFO: 'status',
    SUCCESS: 'status',
    WARNING: 'alert',
    ERROR: 'alert',
};

/** Minimum saturation (0-1, HSL) for a color to be considered for detection at all. Below this,
 *  a color reads as gray/near-neutral and its numeric hue is a meaningless artifact of tiny,
 *  incidental channel differences rather than a real color - e.g. Bootstrap's neutral gray
 *  `#6c757d` happens to compute to a hue right next to the bundled `INFO` color's, which would
 *  otherwise make gray text/borders silently read as "informational". Gating on saturation first
 *  means a genuinely gray/black/white/near-neutral `color` never matches any severity, regardless
 *  of `threshold`. */
const MIN_SATURATION_FOR_DETECTION = 0.15;

function rgbToHueSaturation([r, g, b]: [number, number, number]): { hue: number; saturation: number } {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const delta = max - min;
    if (delta === 0) return { hue: 0, saturation: 0 };

    const lightness = (max + min) / 2;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue: number;
    if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
    else hue = 60 * ((rn - gn) / delta + 4);
    if (hue < 0) hue += 360;
    return { hue, saturation };
}

function hueDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 360 - diff);
}

/** Default `threshold` for `detectSeverityFromColor`, in degrees of hue (0-180 max, since hue is
 *  circular). Worked out by hand against the bundled `ToastColor` palette: pure red (`#ff0000`)
 *  and Bootstrap's `#dc3545` land 5-11 degrees from the bundled `ERROR`, `#ffc107` lands ~3
 *  degrees from `WARNING`, while the *next*-nearest bundled entry for each of those is always
 *  48+ degrees away - `27` sits comfortably in that gap, on the stricter side deliberately (a
 *  missed match is a no-op; a false match on `WARNING`/`ERROR` is a disruptive `alert`/assertive
 *  announcement, which is worse to get wrong than a passive `status`). Tune via
 *  `ToastsConfig.autoDetectSeverity`'s `threshold`. */
export const DEFAULT_SEVERITY_DETECTION_THRESHOLD = 27;

/** Opt-in heuristic behind `ToastsConfig.autoDetectSeverity` (see there) - infers a severity from
 *  how close `color`'s hue is to one of `palette`'s four entries' hues (circular hue distance in
 *  degrees), gated by `MIN_SATURATION_FOR_DETECTION` on both sides so neutral/grayish colors
 *  never match. Hue (not raw RGB distance) is what actually tracks "is this clearly red/green/
 *  yellow/blue" - a raw RGB distance previously let the bundled `ERROR`'s more orange-leaning
 *  `#ff4433` make literal pure red (`#ff0000`) miss the default threshold entirely, which is the
 *  one color most people would call "clearly an error".
 *
 *  Returns `undefined` (no confident match) when `color` can't be parsed to RGB at all (including
 *  named CSS colors like `"red"` - see the note on `resolveRgb` in `ToastTheme.ts`), when `color`
 *  is too desaturated to have a meaningful hue, when none of `palette`'s entries parse or have a
 *  meaningful hue either, or when the nearest one is farther than `threshold`. Never called for a
 *  toast that already has an explicit `severity` - that always wins outright. */
export function detectSeverityFromColor(
    color: string,
    palette: ToastColorPalette,
    threshold: number = DEFAULT_SEVERITY_DETECTION_THRESHOLD
): ToastSeverityValue | undefined {
    const targetRgb = resolveRgb(color);
    if (!targetRgb) return undefined;
    const target = rgbToHueSaturation(targetRgb);
    if (target.saturation < MIN_SATURATION_FOR_DETECTION) return undefined;

    let nearest: ToastSeverityValue | undefined;
    let nearestDistance = Infinity;
    for (const severity of Object.keys(ToastSeverity) as ToastSeverityValue[]) {
        const candidateRgb = resolveRgb(palette[severity]);
        if (!candidateRgb) continue;
        const candidate = rgbToHueSaturation(candidateRgb);
        if (candidate.saturation < MIN_SATURATION_FOR_DETECTION) continue;
        const distance = hueDistance(target.hue, candidate.hue);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = severity;
        }
    }
    return nearest !== undefined && nearestDistance <= threshold ? nearest : undefined;
}
