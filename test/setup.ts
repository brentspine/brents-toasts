import { vi } from 'vitest';

// jsdom implements neither of these - Toasts.ts relies on both (ResizeObserver
// to reflow the stack, navigator.clipboard for detailsCopyButton()). Real
// layout/resize firing isn't needed for behavioral assertions here, so these
// are no-op/mock stand-ins rather than full polyfills.
class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true
});
