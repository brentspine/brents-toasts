import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from '../src/Toasts';
import { ToastBuilder } from '../src/ToastBuilder';
import { ToastColor } from '../src/ToastColor';
import { ToastPosition } from '../src/ToastPosition';

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
