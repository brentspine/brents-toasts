import { vi } from 'vitest';

// jsdom implements neither of these, and the demo exercises the real brents-toasts
// library end to end (Playground's run()/tryExample()/surpriseMe() actually call
// .show()), which needs both: ResizeObserver to reflow the stack, navigator.clipboard
// for detailsCopyButton()/the demo's own Copy buttons. Mirrors the root library's own
// test/setup.ts shim.
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});
