import { vi } from 'vitest';

// jsdom implements none of these three - Toasts.ts relies on all of them
// (ResizeObserver to reflow the stack, navigator.clipboard for
// detailsCopyButton(), matchMedia for the reduced-motion check in
// ToastAnimation.ts's systemPrefersReducedMotion()). Real layout/resize
// firing isn't needed for behavioral assertions here, so these are
// no-op/mock stand-ins rather than full polyfills.
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

// Defaults to "no reduced-motion preference" (matches: false) - a test that wants to simulate
// `prefers-reduced-motion: reduce` overrides this per-test via
// `vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)`, restored
// via `vi.restoreAllMocks()` in that test's `afterEach`. Deliberately a plain function, not a
// `vi.fn()` - `vi.spyOn` on a property that's already a mock doesn't produce a properly
// restorable spy (there's no non-mock original left to revert to), so a test's `mockReturnValue`
// would otherwise leak into every test that runs after it in the same file.
Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
    writable: true,
    configurable: true
});
