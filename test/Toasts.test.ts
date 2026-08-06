import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from '../src/Toasts';
import { ToastBuilder } from '../src/ToastBuilder';
import { ToastColor } from '../src/ToastColor';
import { ToastPosition } from '../src/ToastPosition';
import { ToastAnimation, registerToastAnimation, getToastAnimation } from '../src/ToastAnimation';
import { ToastTransition, registerToastTransition } from '../src/ToastTransition';
import { recalculatePositions } from '../src/ToastStacking';
import { ToastQuickActions } from '../src/ToastQuickActions';

function nextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function cleanup(): void {
    document.body.innerHTML = '';
}

describe('showToast call shapes', () => {
    afterEach(cleanup);

    it('options-object and legacy-positional forms produce equivalent output', () => {
        const a = new Toasts();
        const b = new Toasts();
        const idA = a.showToast('hi', { color: ToastColor.ERROR, duration: 0, closable: false, allowHtml: false });
        const idB = b.showToast('hi', ToastColor.ERROR, 0, false, false);
        const elA = document.getElementById(idA)!;
        const elB = document.getElementById(idB)!;
        expect(elA.querySelector('.bt-toast-row')?.className).toBe(elB.querySelector('.bt-toast-row')?.className);
        expect(elA.querySelector('.bt-toast-message')?.textContent).toBe(elB.querySelector('.bt-toast-message')?.textContent);
        expect(elA.querySelector('.bt-toast-close')?.getAttribute('style')).toBe(elB.querySelector('.bt-toast-close')?.getAttribute('style'));
    });

    it('ToastBuilder produces the same result as an equivalent options object', () => {
        const t = new Toasts();
        const id1 = t.showToast('msg', { title: 'T', color: ToastColor.SUCCESS, duration: 0 });
        const id2 = new ToastBuilder('msg', t).withTitle('T').withColor(ToastColor.SUCCESS).withDuration(0).show();
        const el1 = document.getElementById(id1)!;
        const el2 = document.getElementById(id2)!;
        expect(el1.querySelector('.bt-toast-title')?.textContent).toBe(el2.querySelector('.bt-toast-title')?.textContent);
        expect(el1.querySelector('.bt-toast-message')?.textContent).toBe(el2.querySelector('.bt-toast-message')?.textContent);
    });

    it('returns a unique id usable with removeToast', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0 });
        expect(document.getElementById(id)).not.toBeNull();
        t.removeToast(id);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
    });
});

describe('content rendering / XSS surface', () => {
    afterEach(cleanup);

    it('message is rendered as plain text when allowHtml is false (default)', () => {
        const t = new Toasts();
        const id = t.showToast('<b>bold</b>', { duration: 0 });
        const msg = document.getElementById(id)!.querySelector('.bt-toast-message')!;
        expect(msg.querySelector('b')).toBeNull();
        expect(msg.textContent).toBe('<b>bold</b>');
    });

    it('message is rendered as HTML when allowHtml is true', () => {
        const t = new Toasts();
        const id = t.showToast('<b>bold</b>', { duration: 0, allowHtml: true });
        const msg = document.getElementById(id)!.querySelector('.bt-toast-message')!;
        expect(msg.querySelector('b')).not.toBeNull();
    });

    it('title is never parsed as HTML even when allowHtml is true', () => {
        const t = new Toasts();
        const id = t.showToast('msg', { duration: 0, allowHtml: true, title: '<b>bold</b>' });
        const title = document.getElementById(id)!.querySelector('.bt-toast-title')!;
        expect(title.querySelector('b')).toBeNull();
        expect(title.textContent).toBe('<b>bold</b>');
    });

    it('a Node message is appended directly regardless of allowHtml', () => {
        const t = new Toasts();
        const span = document.createElement('span');
        span.textContent = 'custom';
        const id = t.showToast(span, { duration: 0 });
        const msg = document.getElementById(id)!.querySelector('.bt-toast-message')!;
        expect(msg.contains(span)).toBe(true);
    });

    it('literal "\\n" and "<br>" render as real line breaks in plain text mode', () => {
        const t = new Toasts();
        const id = t.showToast('line1\nline2<br>line3', { duration: 0 });
        const msg = document.getElementById(id)!.querySelector('.bt-toast-message')!;
        expect(msg.querySelectorAll('br').length).toBe(2);
    });

    it('allowLineBreaks: false renders "\\n"/"<br>" as inert text', () => {
        const t = new Toasts();
        const id = t.showToast('line1\nline2', { duration: 0, allowLineBreaks: false });
        const msg = document.getElementById(id)!.querySelector('.bt-toast-message')!;
        expect(msg.querySelectorAll('br').length).toBe(0);
        expect(msg.textContent).toBe('line1\nline2');
    });
});

describe('updateToast', () => {
    afterEach(cleanup);

    it('only touches keys present in the patch', () => {
        const t = new Toasts();
        const id = t.showToast('original', { title: 'T', duration: 0 });
        t.updateToast(id, { title: 'Updated' });
        const el = document.getElementById(id)!;
        expect(el.querySelector('.bt-toast-title')?.textContent).toBe('Updated');
        expect(el.querySelector('.bt-toast-message')?.textContent).toBe('original');
    });

    it('message can be patched independently of title', () => {
        const t = new Toasts();
        const id = t.showToast('original', { duration: 0 });
        t.updateToast(id, { message: 'changed' });
        expect(document.getElementById(id)!.querySelector('.bt-toast-message')?.textContent).toBe('changed');
    });

    it('buttons is a whole-array replacement, not a merge', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, buttons: [{ label: 'A' }, { label: 'B' }] });
        t.updateToast(id, { buttons: [{ label: 'C' }] });
        const labels = Array.from(document.getElementById(id)!.querySelectorAll('.bt-toast-actions button')).map(b => b.textContent);
        expect(labels).toEqual(['C']);
    });

    it('position/animation/removeOtherToasts/reverseOrder are no-ops post-creation', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, position: ToastPosition.BOTTOM_CENTER });
        const before = document.getElementById(id)!.parentElement;
        t.updateToast(id, { position: ToastPosition.TOP_RIGHT, removeOtherToasts: true, reverseOrder: true });
        expect(document.getElementById(id)!.parentElement).toBe(before);
    });

    it('is a no-op for a nonexistent id', () => {
        const t = new Toasts();
        expect(() => t.updateToast('nope', { title: 'x' })).not.toThrow();
    });
});

describe('dismissal (click/keyboard)', () => {
    afterEach(cleanup);

    it('clicking the row dismisses when closable', () => {
        const t = new Toasts();
        const id = t.showToast('x', { closable: true, duration: 0 });
        document.getElementById(id)!.querySelector('.bt-toast-row')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('clicking the row does nothing when not closable', () => {
        const t = new Toasts();
        const id = t.showToast('x', { closable: false, duration: 0 });
        document.getElementById(id)!.querySelector('.bt-toast-row')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
    });

    it('updateToast can flip closable on an already-rendered toast (live-read, not captured at creation)', () => {
        const t = new Toasts();
        const id = t.showToast('x', { closable: false, duration: 0 });
        t.updateToast(id, { closable: true });
        document.getElementById(id)!.querySelector('.bt-toast-row')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('clicks inside the details block never trigger dismissal (structural sibling, not descendant, of the row)', () => {
        const t = new Toasts();
        const id = t.showToast('x', { closable: true, duration: 0, details: ['d1'] });
        const toggle = document.getElementById(id)!.querySelector('.bt-toast-actions button') as HTMLButtonElement;
        toggle.click();
        const detailsEl = document.getElementById(id)!.querySelector('.bt-toast-details')!;
        detailsEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
    });

    it('onClose fires exactly once, even if removeToast is called twice', () => {
        const t = new Toasts();
        const onClose = vi.fn();
        const id = t.showToast('x', { duration: 0, onClose });
        t.removeToast(id);
        t.removeToast(id);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('timer lifecycle', () => {
    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('auto-dismisses after duration, then is removed from the DOM after the transition', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000 });
        vi.advanceTimersByTime(1000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
        vi.advanceTimersByTime(300);
        expect(document.getElementById(id)).toBeNull();
    });

    it('a sticky toast (duration: 0) never gets a timer and is never auto-dismissed', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0 });
        expect(t.getToastTimer(id)).toBeNull();
        vi.advanceTimersByTime(1_000_000);
        expect(document.getElementById(id)).not.toBeNull();
    });

    it('pause/resume/reset/extend/remove are all safe no-ops for a sticky toast', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0 });
        expect(() => {
            t.pauseToastTimer(id);
            t.resumeToastTimer(id);
            t.resetToastTimer(id);
            t.extendToastTimer(id, 500);
            t.removeToastTimer(id);
        }).not.toThrow();
        expect(t.getToastTimer(id)).toBeNull();
        expect(document.getElementById(id)).not.toBeNull();
    });

    it('pauseToastTimer freezes remaining time; resumeToastTimer continues from there', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000 });
        vi.advanceTimersByTime(400);
        t.pauseToastTimer(id);
        const info = t.getToastTimer(id)!;
        expect(info.paused).toBe(true);
        expect(info.remaining).toBeCloseTo(600, -1);

        vi.advanceTimersByTime(5000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);

        t.resumeToastTimer(id);
        vi.advanceTimersByTime(600);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('resetToastTimer restarts the countdown, optionally at a new duration', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000 });
        vi.advanceTimersByTime(900);
        t.resetToastTimer(id, 2000);
        vi.advanceTimersByTime(1000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
        vi.advanceTimersByTime(1000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('extendToastTimer adds time to the remaining countdown', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000 });
        t.extendToastTimer(id, 500);
        vi.advanceTimersByTime(1000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
        vi.advanceTimersByTime(500);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('removeToastTimer cancels auto-dismiss and makes the toast sticky from then on', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000 });
        t.removeToastTimer(id);
        expect(t.getToastTimer(id)).toBeNull();
        vi.advanceTimersByTime(10_000);
        expect(document.getElementById(id)).not.toBeNull();
    });
});

describe('progress bar sync', () => {
    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('renders no progress bar unless opted into', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000 });
        expect(document.getElementById(id)!.querySelector('.bt-toast-progress')).toBeNull();
    });

    it('hides the bar when there is no active timer (sticky toast)', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: true });
        const wrap = document.getElementById(id)!.querySelector('.bt-toast-progress') as HTMLElement;
        expect(wrap.style.display).toBe('none');
    });

    it('freezes the fill at the correct elapsed fraction on pause (default drain mode)', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000, progress: true });
        vi.advanceTimersByTime(500);
        t.pauseToastTimer(id);
        const fill = document.getElementById(id)!.querySelector('.bt-toast-progress-fill') as HTMLElement;
        expect(fill.style.transition).toBe('none');
        const scale = parseFloat(fill.style.transform.match(/scaleX\(([\d.]+)\)/)![1]);
        expect(scale).toBeCloseTo(0.5, 1);
    });

    function fillScale(id: string): number {
        const fill = document.getElementById(id)!.querySelector('.bt-toast-progress-fill') as HTMLElement;
        return parseFloat(fill.style.transform.match(/scaleX\(([\d.]+)\)/)![1]);
    }

    it('setToastProgress moves a manual-mode bar to the given (clamped) fraction', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: { mode: 'manual' } });

        expect(fillScale(id)).toBe(0);
        t.setToastProgress(id, 0.4);
        expect(fillScale(id)).toBeCloseTo(0.4, 5);
        t.setToastProgress(id, 5);
        expect(fillScale(id)).toBe(1);
        t.setToastProgress(id, -1);
        expect(fillScale(id)).toBe(0);
    });

    it('a manual-mode bar stays visible on a sticky toast, unlike fill/drain', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: { mode: 'manual', value: 0.2 } });
        const wrap = document.getElementById(id)!.querySelector('.bt-toast-progress') as HTMLElement;
        expect(wrap.style.display).not.toBe('none');
        expect(fillScale(id)).toBeCloseTo(0.2, 5);
    });

    it('setToastProgress is a no-op for a fill/drain bar and for a nonexistent toast', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000, progress: true });
        const before = fillScale(id);
        t.setToastProgress(id, 0.9);
        expect(fillScale(id)).toBe(before);
        expect(() => t.setToastProgress('nonexistent', 0.5)).not.toThrow();
    });

    it('updateToast({ color }) alone does not reset a manual bar\'s live setToastProgress value', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: { mode: 'manual', value: 1 } });
        t.setToastProgress(id, 0.35);
        expect(fillScale(id)).toBeCloseTo(0.35, 5);

        t.updateToast(id, { color: '#123456' });
        expect(fillScale(id)).toBeCloseTo(0.35, 5);
    });

    it('updateToast({ progress }) still lets an explicit new value win over the live one', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: { mode: 'manual', value: 1 } });
        t.setToastProgress(id, 0.35);

        t.updateToast(id, { progress: { mode: 'manual', value: 0.7 } });
        expect(fillScale(id)).toBeCloseTo(0.7, 5);
    });

    it('updateToast({ color }) patches a defaulted progress bar color in place, without replacing the fill element', () => {
        const t = new Toasts();
        const id = t.showToast('x', { color: '#111111', duration: 0, progress: { mode: 'manual', value: 0.3 } });
        const fillBefore = document.getElementById(id)!.querySelector('.bt-toast-progress-fill') as HTMLElement;
        expect(fillBefore.style.background).toContain('17, 17, 17');

        t.updateToast(id, { color: '#222222' });
        const fillAfter = document.getElementById(id)!.querySelector('.bt-toast-progress-fill') as HTMLElement;
        expect(fillAfter).toBe(fillBefore); // same node - not rebuilt, so any in-flight transition survives
        expect(fillAfter.style.background).toContain('34, 34, 34');
    });

    it('updateToast({ color }) leaves an explicit progress.color untouched', () => {
        const t = new Toasts();
        const id = t.showToast('x', { color: '#111111', duration: 0, progress: { mode: 'manual', value: 0.3, color: '#abcdef' } });
        const fillBefore = document.getElementById(id)!.querySelector('.bt-toast-progress-fill') as HTMLElement;
        const colorBefore = fillBefore.style.background;

        t.updateToast(id, { color: '#222222' });
        expect(fillBefore.style.background).toBe(colorBefore);
    });

    it('exposes role=progressbar with a valuemin/valuemax/valuenow/label reflecting the manual value', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: { mode: 'manual', value: 0.4 } });
        const wrap = document.getElementById(id)!.querySelector('.bt-toast-progress') as HTMLElement;
        expect(wrap.getAttribute('role')).toBe('progressbar');
        expect(wrap.getAttribute('aria-valuemin')).toBe('0');
        expect(wrap.getAttribute('aria-valuemax')).toBe('100');
        expect(wrap.getAttribute('aria-valuenow')).toBe('40');
        expect(wrap.getAttribute('aria-label')).toBe('Progress');

        t.setToastProgress(id, 0.75);
        expect(wrap.getAttribute('aria-valuenow')).toBe('75');
    });

    it('progress.label overrides the default accessible name', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, progress: { mode: 'manual', label: 'Uploading file' } });
        const wrap = document.getElementById(id)!.querySelector('.bt-toast-progress') as HTMLElement;
        expect(wrap.getAttribute('aria-label')).toBe('Uploading file');
    });

    it('keeps aria-valuenow in sync with a fill/drain bar on pause', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 1000, progress: { mode: 'drain' } });
        vi.advanceTimersByTime(500);
        t.pauseToastTimer(id);
        const wrap = document.getElementById(id)!.querySelector('.bt-toast-progress') as HTMLElement;
        expect(Number(wrap.getAttribute('aria-valuenow'))).toBeCloseTo(50, 0);
    });
});

describe('eviction and stacking', () => {
    afterEach(cleanup);

    it('evicts the oldest toast by creation order (not DOM position) once maxToasts is exceeded', () => {
        const t = new Toasts();
        t.configure({ maxToasts: 2, evictOldest: true });
        const id1 = t.showToast('1', { duration: 0 });
        const id2 = t.showToast('2', { duration: 0 });
        const id3 = t.showToast('3', { duration: 0 });
        expect(document.getElementById(id1)?.classList.contains('bt-hiding')).toBe(true);
        expect(document.getElementById(id2)).not.toBeNull();
        expect(document.getElementById(id3)).not.toBeNull();
    });

    it('does not evict when evictOldest is false', () => {
        const t = new Toasts();
        t.configure({ maxToasts: 2, evictOldest: false });
        const id1 = t.showToast('1', { duration: 0 });
        t.showToast('2', { duration: 0 });
        t.showToast('3', { duration: 0 });
        expect(document.getElementById(id1)?.classList.contains('bt-hiding')).toBe(false);
    });

    it('reverseOrder prepends into the snackbar instead of appending', () => {
        const t = new Toasts();
        const id1 = t.showToast('1', { duration: 0 });
        const id2 = t.showToast('2', { duration: 0, reverseOrder: true });
        const snackbar = document.getElementById(id1)!.parentElement!;
        expect(Array.from(snackbar.children).map(c => c.id)).toEqual([id2, id1]);
    });

    it('removeAllToasts dismisses every visible toast across positions', () => {
        const t = new Toasts();
        const id1 = t.showToast('1', { duration: 0, position: ToastPosition.BOTTOM_CENTER });
        const id2 = t.showToast('2', { duration: 0, position: ToastPosition.TOP_RIGHT });
        t.removeAllToasts();
        expect(document.getElementById(id1)?.classList.contains('bt-hiding')).toBe(true);
        expect(document.getElementById(id2)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('gives simultaneously-visible snackbar regions distinct aria-labels per position', () => {
        const t = new Toasts();
        const idBottom = t.showToast('1', { duration: 0, position: ToastPosition.BOTTOM_CENTER });
        const idTop = t.showToast('2', { duration: 0, position: ToastPosition.TOP_RIGHT });
        const bottomLabel = document.getElementById(idBottom)!.parentElement!.getAttribute('aria-label');
        const topLabel = document.getElementById(idTop)!.parentElement!.getAttribute('aria-label');
        expect(bottomLabel).not.toBe(topLabel);
        expect(bottomLabel).toBe('Notifications, bottom center');
        expect(topLabel).toBe('Notifications, top right');
    });
});

describe('responsive position collapsing', () => {
    const originalInnerWidth = window.innerWidth;

    function setViewportWidth(width: number): void {
        Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
    }

    afterEach(() => {
        setViewportWidth(originalInnerWidth);
        cleanup();
    });

    it('collapses *-left/*-right into *-center on a narrow viewport', () => {
        setViewportWidth(350);
        const t = new Toasts();
        const idLeft = t.showToast('l', { duration: 0, position: ToastPosition.BOTTOM_LEFT });
        const idCenter = t.showToast('c', { duration: 0, position: ToastPosition.BOTTOM_CENTER });
        const idRight = t.showToast('r', { duration: 0, position: ToastPosition.BOTTOM_RIGHT });
        const snackbar = document.getElementById(idLeft)!.parentElement;
        expect(document.getElementById(idCenter)!.parentElement).toBe(snackbar);
        expect(document.getElementById(idRight)!.parentElement).toBe(snackbar);
        expect(snackbar!.dataset.position).toBe(ToastPosition.BOTTOM_CENTER);
    });

    it('keeps *-left/*-right in separate containers on a wide viewport', () => {
        setViewportWidth(1024);
        const t = new Toasts();
        const idLeft = t.showToast('l', { duration: 0, position: ToastPosition.TOP_LEFT });
        const idRight = t.showToast('r', { duration: 0, position: ToastPosition.TOP_RIGHT });
        expect(document.getElementById(idLeft)!.parentElement).not.toBe(document.getElementById(idRight)!.parentElement);
    });

    it('responsiveBreakpoint: 0 disables collapsing even on a narrow viewport', () => {
        setViewportWidth(350);
        const t = new Toasts();
        t.configure({ responsiveBreakpoint: 0 });
        const idLeft = t.showToast('l', { duration: 0, position: ToastPosition.BOTTOM_LEFT });
        const idCenter = t.showToast('c', { duration: 0, position: ToastPosition.BOTTOM_CENTER });
        expect(document.getElementById(idLeft)!.parentElement).not.toBe(document.getElementById(idCenter)!.parentElement);
    });

    it('migrates an already-shown toast into the shared container on resize, and back on widen', async () => {
        setViewportWidth(1024);
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, position: ToastPosition.TOP_LEFT });
        const wideParent = document.getElementById(id)!.parentElement!;
        expect(wideParent.dataset.position).toBe(ToastPosition.TOP_LEFT);

        setViewportWidth(350);
        window.dispatchEvent(new Event('resize'));
        await nextFrame();
        const narrowParent = document.getElementById(id)!.parentElement!;
        expect(narrowParent.dataset.position).toBe(ToastPosition.TOP_CENTER);
        expect(narrowParent).not.toBe(wideParent);
        expect(wideParent.children.length).toBe(0);

        setViewportWidth(1024);
        window.dispatchEvent(new Event('resize'));
        await nextFrame();
        expect(document.getElementById(id)!.parentElement).toBe(wideParent);
    });
});

describe('multiple instances sharing a snackbar', () => {
    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('removing a toast via a different instance still uses the owning instance\'s onClose/animation', () => {
        vi.useFakeTimers();
        const a = new Toasts();
        const b = new Toasts();
        const onClose = vi.fn();
        const id = b.showToast('x', { duration: 0, animation: ToastAnimation.NONE, onClose });
        a.removeToast(id); // cross-instance removal, both default to BOTTOM_CENTER
        vi.advanceTimersByTime(0);
        // NONE's exitDurationMs is 0 (instant removal) - if `a`'s own
        // fallback (SLIDE) animation had been used instead, the element
        // would still be mid-exit-transition here.
        expect(document.getElementById(id)).toBeNull();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('evicts by true cross-instance creation order, not a per-instance fallback', () => {
        const a = new Toasts();
        a.configure({ maxToasts: 2, evictOldest: true });
        const idA1 = a.showToast('a1', { duration: 0 }); // globally oldest
        const b = new Toasts();
        const idB1 = b.showToast('b1', { duration: 0 }); // created after idA1, foreign to `a`
        a.showToast('a2', { duration: 0 }); // 2 active toasts >= maxToasts(2) triggers eviction
        expect(document.getElementById(idA1)?.classList.contains('bt-hiding')).toBe(true);
        expect(document.getElementById(idB1)?.classList.contains('bt-hiding')).toBe(false);
    });

    it('removeAllToasts on one instance correctly closes toasts owned by another', () => {
        const a = new Toasts();
        const b = new Toasts();
        const onClose = vi.fn();
        b.showToast('mine', { duration: 0, onClose });
        a.removeAllToasts();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('updateToast via a different instance patches the owning instance\'s state', () => {
        const a = new Toasts();
        const b = new Toasts();
        const id = b.showToast('mine', { duration: 0 });
        a.updateToast(id, { message: 'changed' });
        expect(document.getElementById(id)?.querySelector('.bt-toast-content')?.textContent).toBe('changed');
    });

    it('getToastData/setToastData via a different instance read/write the owning instance\'s data', () => {
        const a = new Toasts();
        const b = new Toasts();
        const id = b.showToast('mine', { duration: 0, data: 'original' });
        expect(a.getToastData(id)).toBe('original');
        a.setToastData(id, 'updated');
        expect(b.getToastData(id)).toBe('updated');
    });

    it('pause/resume/reset/extend/removeToastTimer via a different instance act on the owning instance\'s timer', () => {
        vi.useFakeTimers();
        const a = new Toasts();
        const b = new Toasts();
        const id = b.showToast('mine', { duration: 1000 });

        a.pauseToastTimer(id);
        expect(a.getToastTimer(id)?.paused).toBe(true);

        a.resumeToastTimer(id);
        expect(a.getToastTimer(id)?.paused).toBe(false);

        a.resetToastTimer(id, 5000);
        expect(a.getToastTimer(id)?.duration).toBe(5000);

        a.extendToastTimer(id, 1000);
        expect(a.getToastTimer(id)?.remaining).toBeGreaterThan(5000);

        a.removeToastTimer(id);
        expect(a.getToastTimer(id)).toBeNull();

        // Since the timer was removed (toast is now sticky), it must not
        // auto-dismiss even though `b` is the actual owner.
        vi.advanceTimersByTime(10000);
        expect(document.getElementById(id)).not.toBeNull();
    });

    it('addToastButton/removeToastButton/addToastDetail/removeToastDetail via a different instance mutate the owning instance\'s state', () => {
        const a = new Toasts();
        const b = new Toasts();
        const id = b.showToast('mine', { duration: 0 });

        a.addToastButton(id, { label: 'Click me', onClick: () => {} });
        expect(document.getElementById(id)?.querySelectorAll('.bt-toast-action').length).toBe(1);

        a.removeToastButton(id, 0);
        expect(document.getElementById(id)?.querySelectorAll('.bt-toast-action').length).toBe(0);

        a.addToastDetail(id, 'detail line');
        expect(document.getElementById(id)?.querySelector('.bt-toast-details')).not.toBeNull();

        a.removeToastDetail(id, 0);
        expect(document.getElementById(id)?.querySelector('.bt-toast-details')).toBeNull();
    });
});

describe('locale resolution', () => {
    afterEach(cleanup);

    it('configure({ locale }) resolves the matching bundled translation pack', () => {
        const t = new Toasts();
        t.configure({ locale: 'de' });
        expect(t.closeButton().label).toBe('Schließen');
    });

    it('falls back to en and warns only once for an unrecognized locale', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const t = new Toasts();
        t.configure({ locale: 'xx' });
        expect(t.closeButton().label).toBe('Close');
        expect(t.closeButton().label).toBe('Close');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
    });

    it('translations partial overrides layer on top of the resolved locale pack', () => {
        const t = new Toasts();
        t.configure({ translations: { close: 'Dismiss' } });
        expect(t.closeButton().label).toBe('Dismiss');
    });
});

describe('theme', () => {
    afterEach(cleanup);

    it('per-toast theme merges key-by-key over the configured default', () => {
        const t = new Toasts();
        t.configure({ theme: { background: '#111', text: '#eee' } });
        const id = t.showToast('x', { duration: 0, theme: { background: '#222' } });
        const toast = document.getElementById(id)!.querySelector('.bt-toast') as HTMLElement;
        expect(toast.style.getPropertyValue('--bt-background')).toBe('#222');
        expect(toast.style.getPropertyValue('--bt-text')).toBe('#eee');
    });
});

describe('button/detail helpers', () => {
    afterEach(cleanup);

    it('addToastButton appends by default, and inserts at a given index', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, buttons: [{ label: 'A' }] });
        t.addToastButton(id, { label: 'C' });
        t.addToastButton(id, { label: 'B' }, 1);
        const labels = Array.from(document.getElementById(id)!.querySelectorAll('.bt-toast-actions button')).map(b => b.textContent);
        expect(labels).toEqual(['A', 'B', 'C']);
    });

    it('removeToastButton removes by index', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, buttons: [{ label: 'A' }, { label: 'B' }] });
        t.removeToastButton(id, 0);
        const labels = Array.from(document.getElementById(id)!.querySelectorAll('.bt-toast-actions button')).map(b => b.textContent);
        expect(labels).toEqual(['B']);
    });

    it('addToastDetail/removeToastDetail manage the details array', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, details: ['first'] });
        t.addToastDetail(id, 'second');
        let values = Array.from(document.getElementById(id)!.querySelectorAll('.bt-toast-detail-value')).map(v => v.textContent);
        expect(values).toEqual(['first', 'second']);

        t.removeToastDetail(id, 0);
        values = Array.from(document.getElementById(id)!.querySelectorAll('.bt-toast-detail-value')).map(v => v.textContent);
        expect(values).toEqual(['second']);
    });
});

describe('animations', () => {
    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('slide starts at the anchor edge (0px) and opacity 0 before the entrance frame runs', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, animation: ToastAnimation.SLIDE });
        const el = document.getElementById(id)!;
        expect(el.style.bottom).toBe('0px');
        expect(el.style.opacity).toBe('0');
    });

    it('fade starts already at its resting offset - only opacity animates, nothing slides', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, animation: ToastAnimation.FADE });
        const el = document.getElementById(id)!;
        expect(el.style.bottom).not.toBe('0px');
        expect(el.style.opacity).toBe('0');
    });

    it('none has no transition and is fully visible/positioned immediately, with instant removal', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, animation: ToastAnimation.NONE });
        const el = document.getElementById(id)!;
        expect(el.style.transition).toBe('none');
        expect(el.style.opacity).toBe('1');
        expect(el.style.bottom).not.toBe('0px');

        t.removeToast(id);
        vi.advanceTimersByTime(0);
        expect(document.getElementById(id)).toBeNull();
    });

    it('falls back to slide and warns only once for an unimplemented animation value', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const t = new Toasts();
        const slideTransition = getToastAnimation(ToastAnimation.SLIDE)!.containerTransition;
        const id1 = t.showToast('1', { duration: 0, animation: 'nope' });
        const id2 = t.showToast('2', { duration: 0, animation: 'nope' });
        expect(document.getElementById(id1)!.style.transition).toBe(slideTransition);
        expect(document.getElementById(id2)!.style.transition).toBe(slideTransition);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
    });

    it('registerToastAnimation() lets a custom name drive enter/exit and exitDurationMs', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const enterFrom = vi.fn();
        const enterTo = vi.fn();
        const exit = vi.fn();
        registerToastAnimation('custom-test', {
            containerTransition: 'opacity 50ms linear',
            enterFrom,
            enterTo,
            exit,
            exitDurationMs: 50,
        });

        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, animation: 'custom-test' });
        expect(enterFrom).toHaveBeenCalledTimes(1);
        expect(enterTo).not.toHaveBeenCalled();

        vi.useRealTimers();
        await nextFrame();
        expect(enterTo).toHaveBeenCalledTimes(1);

        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        t.removeToast(id);
        expect(exit).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(50);
        expect(document.getElementById(id)).toBeNull();
    });

    it('an entering NONE toast reflows a SLIDE sibling using its own (none) transition, then restores the sibling\'s SLIDE transition', () => {
        const slideTransition = getToastAnimation(ToastAnimation.SLIDE)!.containerTransition;
        const t = new Toasts();
        const id1 = t.showToast('a', { duration: 0, animation: ToastAnimation.SLIDE });
        const el1 = document.getElementById(id1)!;
        const initialBottom = el1.style.bottom;

        t.showToast('b', { duration: 0, animation: ToastAnimation.NONE });

        expect(el1.style.transition).toBe(slideTransition);
        expect(el1.style.bottom).not.toBe(initialBottom);
    });

    it('an entering SLIDE toast reflows a NONE sibling using its own (slide) transition, then restores the sibling\'s none transition', () => {
        const t = new Toasts();
        const id1 = t.showToast('a', { duration: 0, animation: ToastAnimation.NONE });
        const el1 = document.getElementById(id1)!;
        const initialBottom = el1.style.bottom;

        t.showToast('b', { duration: 0, animation: ToastAnimation.SLIDE });

        expect(el1.style.transition).toBe('none');
        expect(el1.style.bottom).not.toBe(initialBottom);
    });

    it('removing a NONE toast reflows a SLIDE sibling using the exiting toast\'s transition, restoring the sibling\'s own afterward', () => {
        vi.useFakeTimers();
        const slideTransition = getToastAnimation(ToastAnimation.SLIDE)!.containerTransition;
        const t = new Toasts();
        const id1 = t.showToast('a', { duration: 0, animation: ToastAnimation.SLIDE });
        const id2 = t.showToast('b', { duration: 0, animation: ToastAnimation.NONE });
        const el1 = document.getElementById(id1)!;

        t.removeToast(id2);
        expect(el1.style.transition).toBe(slideTransition);

        vi.advanceTimersByTime(0);
        expect(el1.style.transition).toBe(slideTransition);
    });

    it('recalculatePositions without a causingTransition (the resize path) leaves a toast\'s own transition untouched', () => {
        const t = new Toasts();
        const id = t.showToast('a', { duration: 0, animation: ToastAnimation.SLIDE });
        const el = document.getElementById(id)!;
        const ownTransition = el.style.transition;

        recalculatePositions(el.parentElement!);

        expect(el.style.transition).toBe(ownTransition);
    });
});

describe('toast data', () => {
    afterEach(cleanup);

    it('getToastData/setToastData round-trip arbitrary data', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, data: { foo: 1 } });
        expect(t.getToastData(id)).toEqual({ foo: 1 });
        t.setToastData(id, { foo: 2 });
        expect(t.getToastData(id)).toEqual({ foo: 2 });
    });

    it('returns undefined for a nonexistent id or unset data', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0 });
        expect(t.getToastData(id)).toBeUndefined();
        expect(t.getToastData('nope')).toBeUndefined();
    });
});

describe('confirmButton', () => {
    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    function actionLabels(id: string): (string | null)[] {
        return Array.from(document.getElementById(id)!.querySelectorAll('.bt-toast-actions button')).map(b => b.textContent);
    }

    function clickAction(id: string, label: string): void {
        const btn = Array.from(document.getElementById(id)!.querySelectorAll<HTMLButtonElement>('.bt-toast-actions button'))
            .find(b => b.textContent === label);
        btn!.click();
    }

    it('clicking it swaps the whole toast (message + every button), not just its own label', () => {
        const t = new Toasts();
        const onConfirm = vi.fn();
        const id = t.showToast('3 items selected.', { duration: 0, buttons: [t.confirmButton('Delete', onConfirm)] });

        expect(actionLabels(id)).toEqual(['Delete']);
        clickAction(id, 'Delete');

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Are you sure?');
        expect(actionLabels(id)).toEqual(['Yes', 'No']);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('"No" restores the original message and buttons without running onConfirm', () => {
        const t = new Toasts();
        const onConfirm = vi.fn();
        const id = t.showToast('3 items selected.', { duration: 0, buttons: [t.confirmButton('Delete', onConfirm)] });

        clickAction(id, 'Delete');
        clickAction(id, 'No');

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('3 items selected.');
        expect(actionLabels(id)).toEqual(['Delete']);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('"Yes" runs onConfirm, flashes the done message, then restores the original content', async () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const onConfirm = vi.fn();
        const id = t.showToast('3 items selected.', { duration: 0, buttons: [t.confirmButton('Delete', onConfirm)] });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Done');
        expect(actionLabels(id)).toEqual([]);

        await vi.advanceTimersByTimeAsync(2000);
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('3 items selected.');
        expect(actionLabels(id)).toEqual(['Delete']);
    });

    it('disables every action while an async onConfirm is pending, then restores after it resolves', async () => {
        const t = new Toasts();
        let resolveConfirm: () => void;
        const onConfirm = vi.fn(() => new Promise<void>(resolve => { resolveConfirm = resolve; }));
        const id = t.showToast('x', { duration: 0, buttons: [t.confirmButton('Delete', onConfirm, { doneMessage: null })] });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');

        const buttons = Array.from(document.getElementById(id)!.querySelectorAll<HTMLButtonElement>('.bt-toast-actions button'));
        expect(buttons.every(b => b.disabled)).toBe(true);

        resolveConfirm!();
        await Promise.resolve();
        await Promise.resolve();

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('x');
        expect(actionLabels(id)).toEqual(['Delete']);
    });

    it('doneMessage: null skips the "Done" flash and restores immediately', () => {
        const t = new Toasts();
        const id = t.showToast('x', { duration: 0, buttons: [t.confirmButton('Delete', () => {}, { doneMessage: null })] });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('x');
        expect(actionLabels(id)).toEqual(['Delete']);
    });

    it('honors custom confirmMessage/yesLabel/noLabel', () => {
        const t = new Toasts();
        const id = t.showToast('x', {
            duration: 0,
            buttons: [t.confirmButton('Delete', () => {}, { confirmMessage: 'Really delete?', yesLabel: 'Confirm', noLabel: 'Cancel' })],
        });

        clickAction(id, 'Delete');
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Really delete?');
        expect(actionLabels(id)).toEqual(['Confirm', 'Cancel']);
    });

    it('resets the toast timer on every click of the flow', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', { duration: 5000, buttons: [t.confirmButton('Delete', () => {}, { doneMessage: null })] });

        vi.advanceTimersByTime(4000);
        clickAction(id, 'Delete');
        expect(t.getToastTimer(id)!.remaining).toBe(5000);

        vi.advanceTimersByTime(4000);
        clickAction(id, 'No');
        expect(t.getToastTimer(id)!.remaining).toBe(5000);
    });

    function colorOf(id: string): string {
        return document.getElementById(id)!.querySelector<HTMLElement>('.bt-toast-close')!.style.getPropertyValue('--data-background');
    }

    it('confirmColor/pendingColor/doneColor swap the toast color per step, "No" restores the original', async () => {
        vi.useFakeTimers();
        const t = new Toasts();
        let resolveConfirm: () => void;
        const onConfirm = vi.fn(() => new Promise<void>(resolve => { resolveConfirm = resolve; }));
        const id = t.showToast('x', {
            duration: 0,
            color: ToastColor.WARNING,
            buttons: [t.confirmButton('Delete', onConfirm, {
                confirmColor: ToastColor.ERROR,
                pendingColor: ToastColor.INFO,
                doneColor: ToastColor.SUCCESS,
            })],
        });

        expect(colorOf(id)).toBe(ToastColor.WARNING);
        clickAction(id, 'Delete');
        expect(colorOf(id)).toBe(ToastColor.ERROR);

        clickAction(id, 'Yes');
        expect(colorOf(id)).toBe(ToastColor.INFO);

        resolveConfirm!();
        await vi.advanceTimersByTimeAsync(0);
        expect(colorOf(id)).toBe(ToastColor.SUCCESS);

        await vi.advanceTimersByTimeAsync(2000);
        expect(colorOf(id)).toBe(ToastColor.WARNING);
    });

    it('"No" restores the original color after a confirmColor step, without ever confirming', () => {
        const t = new Toasts();
        const id = t.showToast('x', {
            duration: 0,
            color: ToastColor.WARNING,
            buttons: [t.confirmButton('Delete', () => {}, { confirmColor: ToastColor.ERROR })],
        });

        clickAction(id, 'Delete');
        expect(colorOf(id)).toBe(ToastColor.ERROR);
        clickAction(id, 'No');
        expect(colorOf(id)).toBe(ToastColor.WARNING);
    });

    it('pendingMessage replaces the content (and clears buttons) while an async onConfirm is pending', async () => {
        const t = new Toasts();
        let resolveConfirm: () => void;
        const onConfirm = vi.fn(() => new Promise<void>(resolve => { resolveConfirm = resolve; }));
        const id = t.showToast('x', {
            duration: 0,
            buttons: [t.confirmButton('Delete', onConfirm, { pendingMessage: 'Processing...', doneMessage: null })],
        });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Processing...');
        expect(actionLabels(id)).toEqual([]);

        resolveConfirm!();
        await Promise.resolve();
        await Promise.resolve();

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('x');
        expect(actionLabels(id)).toEqual(['Delete']);
    });

    it('doneAction: "close" removes the toast instead of restoring, after the doneMessage flash', async () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', {
            duration: 0,
            buttons: [t.confirmButton('Delete', () => {}, { doneMessage: 'Deleted!', doneTimeoutMs: 500, doneAction: 'close' })],
        });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Deleted!');
        expect(document.getElementById(id)).not.toBeNull();

        await vi.advanceTimersByTimeAsync(500);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
        // removeToast() itself still runs the exit animation (300ms for the default
        // SLIDE animation) before actually detaching the element from the DOM.
        await vi.advanceTimersByTimeAsync(300);
        expect(document.getElementById(id)).toBeNull();
    });

    it('doneAction: "close" with doneMessage: null closes immediately, without a flash', async () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('x', {
            duration: 0,
            buttons: [t.confirmButton('Delete', () => {}, { doneMessage: null, doneAction: 'close' })],
        });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(true);
        await vi.advanceTimersByTimeAsync(300);
        expect(document.getElementById(id)).toBeNull();
    });

    it('a rejected onConfirm always restores, even with doneAction: "close"', async () => {
        const t = new Toasts();
        const onConfirm = vi.fn(() => Promise.reject(new Error('boom')));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const id = t.showToast('x', {
            duration: 0,
            buttons: [t.confirmButton('Delete', onConfirm, { doneMessage: null, doneAction: 'close' })],
        });

        clickAction(id, 'Delete');
        clickAction(id, 'Yes');
        await Promise.resolve();
        await Promise.resolve();

        expect(document.getElementById(id)).not.toBeNull();
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('x');
        expect(actionLabels(id)).toEqual(['Delete']);
        warn.mockRestore();
    });
});

describe('title-only / undefined message (#26)', () => {
    afterEach(cleanup);

    it('ToastBuilder with no message and only a title does not throw', () => {
        const t = new Toasts();
        expect(() => new ToastBuilder(undefined, t).withTitle('some title').show()).not.toThrow();
    });

    it('renders the title with an empty message instead of crashing', () => {
        const t = new Toasts();
        const id = new ToastBuilder(undefined, t).withTitle('some title').show();
        const el = document.getElementById(id)!;
        expect(el.querySelector('.bt-toast-title')?.textContent).toBe('some title');
        expect(el.querySelector('.bt-toast-message')?.textContent).toBe('');
    });

    it('renderTextWithBreaks-backed fields tolerate an undefined value directly via showToast', () => {
        const t = new Toasts();
        expect(() => t.showToast(undefined as unknown as string, { duration: 0 })).not.toThrow();
    });
});

describe('withX(boolean) builder defaults (#28)', () => {
    afterEach(cleanup);

    it('withAllowHtml() with no argument enables it, while the library default stays false', () => {
        const t = new Toasts();
        expect(t.config.allowHtml).toBe(false);
        const id = new ToastBuilder('<b>x</b>', t).withAllowHtml().show();
        expect(document.getElementById(id)!.querySelector('.bt-toast-message b')).not.toBeNull();
    });

    it('withClosable()/withPauseOnHover()/withAllowLineBreaks() with no argument all default to true', () => {
        const t = new Toasts();
        const id = new ToastBuilder('x', t).withClosable().withPauseOnHover().withAllowLineBreaks().withDuration(0).show();
        const row = document.getElementById(id)!.querySelector('.bt-toast-row')!;
        expect(row.classList.contains('bt-closable')).toBe(true);
    });
});

describe('titleMode (#27)', () => {
    afterEach(cleanup);

    it('defaults to stacked: title is a sibling block before the message', () => {
        const t = new Toasts();
        const id = t.showToast('body', { title: 'Head', duration: 0 });
        const content = document.getElementById(id)!.querySelector('.bt-toast-content')!;
        const title = content.querySelector('.bt-toast-title')!;
        const message = content.querySelector('.bt-toast-message')!;
        expect(title.tagName).toBe('DIV');
        expect(message.contains(title)).toBe(false);
        expect(message.textContent).toBe('body');
    });

    it('titleMode: "inline" renders the title as a bold lead-in inside the message', () => {
        const t = new Toasts();
        const id = t.showToast('body', { title: 'Head', titleMode: 'inline', duration: 0 });
        const content = document.getElementById(id)!.querySelector('.bt-toast-content')!;
        const message = content.querySelector('.bt-toast-message')!;
        const inlineTitle = message.querySelector('b.bt-toast-title')!;
        expect(inlineTitle).not.toBeNull();
        expect(inlineTitle.textContent).toBe('Head');
        expect(message.textContent).toBe('Head body');
        // No separate stacked title block - the only .bt-toast-title in the
        // whole content is the inline one nested inside .bt-toast-message.
        expect(content.querySelectorAll('.bt-toast-title').length).toBe(1);
        expect(message.contains(content.querySelector('.bt-toast-title')!)).toBe(true);
    });

    it('titleMode never lets title HTML through, even inline', () => {
        const t = new Toasts();
        const id = t.showToast('msg', { title: '<b>bold</b>', titleMode: 'inline', allowHtml: true, duration: 0 });
        const inlineTitle = document.getElementById(id)!.querySelector('b.bt-toast-title')!;
        expect(inlineTitle.querySelector('b')).toBeNull();
        expect(inlineTitle.textContent).toBe('<b>bold</b>');
    });

    it('configure({ titleMode }) sets the library-wide default; ToastBuilder.withTitle(title, mode) overrides per toast', () => {
        const t = new Toasts();
        t.configure({ titleMode: 'inline' });
        const id1 = t.showToast('body', { title: 'Head', duration: 0 });
        expect(document.getElementById(id1)!.querySelector('.bt-toast-message b.bt-toast-title')).not.toBeNull();

        const id2 = new ToastBuilder('body', t).withTitle('Head', 'stacked').withDuration(0).show();
        const el2 = document.getElementById(id2)!;
        const title2 = el2.querySelector('.bt-toast-title')!;
        expect(title2).not.toBeNull();
        expect(el2.querySelector('.bt-toast-message')!.contains(title2)).toBe(false);
    });

    it('updateToast({ titleMode }) rebuilds the content in the new mode', () => {
        const t = new Toasts();
        const id = t.showToast('body', { title: 'Head', duration: 0 });
        t.updateToast(id, { titleMode: 'inline' });
        const content = document.getElementById(id)!.querySelector('.bt-toast-content')!;
        expect(content.querySelector('.bt-toast-message b.bt-toast-title')).not.toBeNull();
    });

    it('ToastBuilder.withTitleMode() sets titleMode independently of withTitle()', () => {
        const t = new Toasts();
        const id = new ToastBuilder('body', t).withTitle('Head').withTitleMode('inline').withDuration(0).show();
        const content = document.getElementById(id)!.querySelector('.bt-toast-content')!;
        expect(content.querySelector('.bt-toast-message b.bt-toast-title')).not.toBeNull();
    });
});

describe('transition', () => {
    afterEach(() => { vi.useRealTimers(); cleanup(); });

    function toastOf(id: string): HTMLElement {
        return document.getElementById(id)!.querySelector('.bt-toast') as HTMLElement;
    }

    it('defers the DOM update behind a fade when transition: FADE, instead of applying it instantly', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.updateToast(id, { message: 'Updated', transition: ToastTransition.FADE });

        // Not applied yet - still mid fade-out.
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Original');
        expect(toast.style.opacity).toBe('0');

        vi.advanceTimersByTime(150);
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Updated');
        expect(toast.style.opacity).toBe('1');
    });

    it('applies instantly, with no opacity change, when transition is omitted', () => {
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.updateToast(id, { message: 'Updated' });

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Updated');
        expect(toast.style.opacity).toBe('');
    });

    it('applies instantly, with no opacity change, when transition: NONE', () => {
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.updateToast(id, { message: 'Updated', transition: ToastTransition.NONE });

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Updated');
        expect(toast.style.opacity).toBe('');
    });

    it('does not fade when transition: FADE but the patch has no visual keys', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.updateToast(id, { data: { foo: 1 }, transition: ToastTransition.FADE });

        expect(toast.style.opacity).toBe('');
        expect(t.getToastData(id)).toEqual({ foo: 1 });
    });

    it('shakes left-right and applies the mutation immediately when transition: SHAKE_LR', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.updateToast(id, { message: 'Updated', transition: ToastTransition.SHAKE_LR });

        // Applied right away - shake plays over the new content, doesn't hide it first.
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Updated');
        expect(toast.style.transform).toBe('translateX(-8px)');

        vi.advanceTimersByTime(7 * 60);
        expect(toast.style.transform).toBe('');
    });

    it('falls back to FADE with a one-time warning for an unregistered transition name', () => {
        vi.useFakeTimers();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.updateToast(id, { message: 'Updated', transition: 'nope' });
        expect(toast.style.opacity).toBe('0'); // fell back to the fade
        vi.advanceTimersByTime(150);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
    });

    it('runs a custom transition registered via registerToastTransition', () => {
        const runSpy = vi.fn((toast: HTMLElement, mutate: () => void) => mutate());
        registerToastTransition('custom-test', { run: runSpy });
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });

        t.updateToast(id, { message: 'Updated', transition: 'custom-test' });

        expect(runSpy).toHaveBeenCalledTimes(1);
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Updated');
    });
});

describe('playToastTransition', () => {
    afterEach(() => { vi.useRealTimers(); cleanup(); });

    function toastOf(id: string): HTMLElement {
        return document.getElementById(id)!.querySelector('.bt-toast') as HTMLElement;
    }

    it('plays SHAKE_LR on the toast card with no content change', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.playToastTransition(id, ToastTransition.SHAKE_LR);

        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Original');
        expect(toast.style.transform).toBe('translateX(-8px)');

        vi.advanceTimersByTime(7 * 60);
        expect(toast.style.transform).toBe('');
    });

    it('plays FADE on the toast card with no content change', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t.playToastTransition(id, ToastTransition.FADE);
        expect(toast.style.opacity).toBe('0');

        vi.advanceTimersByTime(150);
        expect(toast.style.opacity).toBe('1');
        expect(document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent).toBe('Original');
    });

    it('is a no-op for a nonexistent id', () => {
        const t = new Toasts();
        expect(() => t.playToastTransition('nope', ToastTransition.SHAKE_LR)).not.toThrow();
    });

    it('runs a custom transition registered via registerToastTransition', () => {
        const runSpy = vi.fn((_toast: HTMLElement, mutate: () => void) => mutate());
        registerToastTransition('custom-play-test', { run: runSpy });
        const t = new Toasts();
        const id = t.showToast('Original', { duration: 0 });

        t.playToastTransition(id, 'custom-play-test');

        expect(runSpy).toHaveBeenCalledTimes(1);
    });

    it('delegates to the owning instance for a toast created by another same-position instance', () => {
        vi.useFakeTimers();
        const t1 = new Toasts();
        const t2 = new Toasts();
        const id = t1.showToast('Original', { duration: 0 });
        const toast = toastOf(id);

        t2.playToastTransition(id, ToastTransition.SHAKE_LR);

        expect(toast.style.transform).toBe('translateX(-8px)');
    });
});

describe('promise', () => {
    afterEach(cleanup);

    function messageOf(id: string): string | null {
        return document.getElementById(id)!.querySelector('.bt-toast-content')!.textContent;
    }
    function colorOf(id: string): string {
        return document.getElementById(id)!.querySelector<HTMLElement>('.bt-toast-close')!.style.getPropertyValue('--data-background');
    }

    it('shows the loading message as a sticky toast, then patches it to success on resolve', async () => {
        const t = new Toasts();
        let resolve!: (v: string) => void;
        const p = new Promise<string>(r => { resolve = r; });

        const returned = t.promise(p, { loading: 'Loading...', success: (data) => `Got ${data}` });
        expect(returned).toBe(p);

        const toastId = document.querySelector('.bt-toast-container')!.id;
        expect(messageOf(toastId)).toBe('Loading...');
        expect(t.getToastTimer(toastId)).toBeNull(); // sticky while pending

        resolve('posts');
        await Promise.resolve();
        await Promise.resolve();

        expect(messageOf(toastId)).toBe('Got posts');
        expect(colorOf(toastId)).toBe(ToastColor.SUCCESS);
    });

    it('patches to an error message and color on rejection', async () => {
        const t = new Toasts();
        let reject!: (e: unknown) => void;
        const p = new Promise<string>((_res, rej) => { reject = rej; });
        p.catch(() => {}); // the returned promise is the caller's to handle

        t.promise(p, { loading: 'Loading...', error: (err) => `Failed: ${(err as Error).message}` });
        const toastId = document.querySelector('.bt-toast-container')!.id;

        reject(new Error('boom'));
        await Promise.resolve();
        await Promise.resolve();

        expect(messageOf(toastId)).toBe('Failed: boom');
        expect(colorOf(toastId)).toBe(ToastColor.ERROR);
    });

    it('dismisses the toast on an outcome with no matching message', async () => {
        const t = new Toasts();
        const p = Promise.resolve('x');
        t.promise(p, { loading: 'Loading...' });
        const toastId = document.querySelector('.bt-toast-container')!.id;

        await Promise.resolve();
        await Promise.resolve();

        expect(document.getElementById(toastId)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('accepts a plain string/object for loading and success/error alike', async () => {
        const t = new Toasts();
        const p = Promise.resolve('x');
        t.promise(p, { loading: { message: 'Loading...', closable: false }, success: 'Done!' });
        const toastId = document.querySelector('.bt-toast-container')!.id;
        expect(document.getElementById(toastId)!.querySelector('.bt-toast-row')?.classList.contains('bt-closable')).toBe(false);

        await Promise.resolve();
        await Promise.resolve();
        expect(messageOf(toastId)).toBe('Done!');
    });

    it('shared options apply to loading and outcome toasts, with per-state message overrides winning', async () => {
        const t = new Toasts();
        const p = Promise.resolve('x');
        t.promise(p, { loading: 'Loading...', success: { message: 'Done!', color: ToastColor.WARNING } }, { closable: false });
        const toastId = document.querySelector('.bt-toast-container')!.id;
        expect(document.getElementById(toastId)!.querySelector('.bt-toast-row')?.classList.contains('bt-closable')).toBe(false);

        await Promise.resolve();
        await Promise.resolve();
        expect(colorOf(toastId)).toBe(ToastColor.WARNING);
        expect(document.getElementById(toastId)!.querySelector('.bt-toast-row')?.classList.contains('bt-closable')).toBe(false);
    });

    it('crossfades the loading -> success patch when transition: FADE is set on the outcome', async () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const p = Promise.resolve('x');
        t.promise(p, { loading: 'Loading...', success: { message: 'Done!', transition: ToastTransition.FADE } });
        const toastId = document.querySelector('.bt-toast-container')!.id;
        const toast = document.getElementById(toastId)!.querySelector('.bt-toast') as HTMLElement;

        await vi.advanceTimersByTimeAsync(0); // flush the promise's .then microtask

        // Mid-fade: opacity dropped, but the DOM swap hasn't happened yet.
        expect(toast.style.opacity).toBe('0');
        expect(messageOf(toastId)).toBe('Loading...');

        await vi.advanceTimersByTimeAsync(150);
        expect(messageOf(toastId)).toBe('Done!');
        expect(toast.style.opacity).toBe('1');
        vi.useRealTimers();
    });

    describe('timeout', () => {
        afterEach(() => vi.useRealTimers());

        it('is disabled by default - the loading toast waits indefinitely', async () => {
            vi.useFakeTimers();
            const t = new Toasts();
            const p = new Promise<string>(() => {}); // never settles
            t.promise(p, { loading: 'Loading...', timeout: 'Timed out' });
            const toastId = document.querySelector('.bt-toast-container')!.id;

            await vi.advanceTimersByTimeAsync(1_000_000);
            expect(messageOf(toastId)).toBe('Loading...');
        });

        it('patches the toast to messages.timeout if the promise has not settled within options.timeout', async () => {
            vi.useFakeTimers();
            const t = new Toasts();
            const p = new Promise<string>(() => {}); // never settles
            t.promise(p, { loading: 'Loading...', timeout: () => 'Taking too long' }, { timeout: 5000 });
            const toastId = document.querySelector('.bt-toast-container')!.id;

            await vi.advanceTimersByTimeAsync(5000);
            expect(messageOf(toastId)).toBe('Taking too long');
            expect(colorOf(toastId)).toBe(ToastColor.WARNING);
        });

        it('dismisses the toast on timeout when messages.timeout is omitted', async () => {
            vi.useFakeTimers();
            const t = new Toasts();
            const p = new Promise<string>(() => {});
            t.promise(p, { loading: 'Loading...' }, { timeout: 5000 });
            const toastId = document.querySelector('.bt-toast-container')!.id;

            await vi.advanceTimersByTimeAsync(5000);
            expect(document.getElementById(toastId)?.classList.contains('bt-hiding')).toBe(true);
        });

        it('falls back to configure()\'s promiseTimeout when options.timeout is unset', async () => {
            vi.useFakeTimers();
            const t = new Toasts();
            t.configure({ promiseTimeout: 3000 });
            const p = new Promise<string>(() => {});
            t.promise(p, { loading: 'Loading...', timeout: 'Timed out' });
            const toastId = document.querySelector('.bt-toast-container')!.id;

            await vi.advanceTimersByTimeAsync(3000);
            expect(messageOf(toastId)).toBe('Timed out');
        });

        it('does not fire the timeout if the promise settles first', async () => {
            vi.useFakeTimers();
            const t = new Toasts();
            const p = Promise.resolve('x');
            // duration: 0 keeps the success toast sticky so this test can advance past the
            // (now-cleared) timeout without the default auto-dismiss timer removing it first.
            t.promise(p, { loading: 'Loading...', success: { message: 'Done!', duration: 0 }, timeout: 'Timed out' }, { timeout: 5000 });
            const toastId = document.querySelector('.bt-toast-container')!.id;

            await vi.advanceTimersByTimeAsync(0);
            expect(messageOf(toastId)).toBe('Done!');

            await vi.advanceTimersByTimeAsync(5000);
            expect(messageOf(toastId)).toBe('Done!'); // unaffected by the now-cleared timeout
        });

        it('ignores a late success/error settle after the toast has already timed out', async () => {
            vi.useFakeTimers();
            const t = new Toasts();
            let resolve!: (v: string) => void;
            const p = new Promise<string>(r => { resolve = r; });
            t.promise(p, { loading: 'Loading...', success: 'Done!', timeout: 'Timed out' }, { timeout: 5000 });
            const toastId = document.querySelector('.bt-toast-container')!.id;

            await vi.advanceTimersByTimeAsync(5000);
            expect(messageOf(toastId)).toBe('Timed out');

            resolve('late');
            await vi.advanceTimersByTimeAsync(0);
            expect(messageOf(toastId)).toBe('Timed out'); // the late resolve no longer touches the toast
        });
    });
});

describe('ToastQuickActions (#22)', () => {
    it('returns pre-translated strings independent of any Toasts instance', () => {
        expect(ToastQuickActions.yes('en')).toBe('Yes');
        expect(ToastQuickActions.no('de')).toBe('Nein');
        expect(ToastQuickActions.cancel('fr')).toBe('Annuler');
    });

    it('all() returns the full bundled set for a locale', () => {
        const all = ToastQuickActions.all('es');
        expect(all.yes).toBe('Sí');
        expect(all.delete).toBe('Eliminar');
    });

    it('falls back to en for an unrecognized locale', () => {
        expect(ToastQuickActions.yes('xx')).toBe('Yes');
    });
});
