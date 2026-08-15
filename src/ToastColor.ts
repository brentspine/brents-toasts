export const ToastColor = {
    INFO:    '#28a6f5ff',
    SUCCESS: '#4bb543ff',
    WARNING: '#dfb200ff',
    ERROR:   '#ff4433ff',
} as const;

export type ToastColorValue = typeof ToastColor[keyof typeof ToastColor];

/** Shape of `ToastsConfig.colors` - one default CSS color string per `ToastSeverity`, widened
 *  from the bundled literal hex defaults so a consumer's own palette can substitute any valid
 *  CSS color. Purely a lookup table (`severity` -> default `color`) - unlike the pre-#56 design,
 *  nothing ever matches a `color` value back against this to infer severity; see `ToastSeverity`. */
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
