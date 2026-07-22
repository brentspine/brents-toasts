export const ToastColor = {
    INFO:    '#28a6f5ff',
    SUCCESS: '#4bb543ff',
    WARNING: '#dfb200ff',
    ERROR:   '#ff4433ff',
} as const;

export type ToastColorValue = typeof ToastColor[keyof typeof ToastColor];
