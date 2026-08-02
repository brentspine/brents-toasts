import { vi } from 'vitest';

// jsdom implements none of these, and the demo exercises the real brents-toasts
// library end to end (Playground's run()/tryExample()/surpriseMe() actually call
// .show()), which needs: ResizeObserver to reflow the stack, navigator.clipboard for
// detailsCopyButton()/the demo's own Copy buttons, and IntersectionObserver for the
// Playground's Examples-section nav highlight. Mirrors the root library's own
// test/setup.ts shim.
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// jsdom throws "Not implemented" for window.scrollTo (used by app.ts to reset scroll
// position on plain route navigations).
window.scrollTo = vi.fn();

Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});
