export const ToastColor = {
    INFO:    '#28a6f5ff',
    SUCCESS: '#4bb543ff',
    WARNING: '#dfb200ff',
    ERROR:   '#ff4433ff',
} as const;

export type ToastColorValue = typeof ToastColor[keyof typeof ToastColor];

/** Shape of the severity color set `ToastsConfig.colors` overrides - one CSS color
 *  string per `ToastColor` key, widened from the bundled literal hex defaults so a
 *  consumer's own palette can substitute any valid CSS color. */
export type ToastColorPalette = Record<keyof typeof ToastColor, string>;
