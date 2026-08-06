import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from '../src/Toasts';
import { ToastBuilder } from '../src/ToastBuilder';
import { ToastColor } from '../src/ToastColor';
import { ToastPosition } from '../src/ToastPosition';
import { ToastAnimation } from '../src/ToastAnimation';
import { ToastTransition } from '../src/ToastTransition';

function cleanup(): void {
    document.body.innerHTML = '';
}

describe('ToastBuilder', () => {
    afterEach(cleanup);

    it('defaults message to "" when omitted', () => {
        const t = new Toasts();
        const id = new ToastBuilder(undefined, t).withTitle('T').show();
        const el = document.getElementById(id)!;
        expect(el.querySelector('.bt-toast-message')?.textContent).toBe('');
        expect(el.querySelector('.bt-toast-title')?.textContent).toBe('T');
    });

    it('uses the default singleton Toasts instance when none is passed', () => {
        const id = new ToastBuilder('hi').show();
        expect(document.getElementById(id)).not.toBeNull();
    });

    it('withTitle sets titleMode only when a mode is passed', () => {
        const t = new Toasts();
        const id1 = new ToastBuilder('m', t).withTitle('T').show();
        expect(document.getElementById(id1)!.querySelector('.bt-toast-title')?.textContent).toBe('T');

        const id2 = new ToastBuilder('m', t).withTitle('T2', 'inline').show();
        const el2 = document.getElementById(id2)!;
        expect(el2.querySelector('.bt-toast-title')?.textContent).toBe('T2');
    });

    it('withTitleMode is independent of withTitle and is a no-op without a title', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withTitleMode('inline').show();
        expect(document.getElementById(id)!.querySelector('.bt-toast-title')).toBeNull();
    });

    it('withColor and the as* shorthands set the resolved color', () => {
        const t = new Toasts();
        const custom = new ToastBuilder('m', t).withColor(ToastColor.ERROR).withDuration(0).show();
        const info = new ToastBuilder('m', t).asInfo().withDuration(0).show();
        const success = new ToastBuilder('m', t).asSuccess().withDuration(0).show();
        const warning = new ToastBuilder('m', t).asWarning().withDuration(0).show();
        const error = new ToastBuilder('m', t).asError().withDuration(0).show();

        const closeStyle = (id: string): string => document.getElementById(id)!.querySelector('.bt-toast-close')!.getAttribute('style') ?? '';
        expect(closeStyle(custom)).toContain(ToastColor.ERROR);
        expect(closeStyle(info)).toContain(ToastColor.INFO);
        expect(closeStyle(success)).toContain(ToastColor.SUCCESS);
        expect(closeStyle(warning)).toContain(ToastColor.WARNING);
        expect(closeStyle(error)).toContain(ToastColor.ERROR);
    });

    it('withDuration(0) produces a sticky toast (no auto-dismiss timer)', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withDuration(0).show();
        vi.advanceTimersByTime(100000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
        vi.useRealTimers();
    });

    it('withClosable defaults to true and can be called with no argument', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withClosable().withDuration(0).show();
        expect(document.getElementById(id)!.querySelector('.bt-toast-close')).not.toBeNull();
    });

    it('withClosable(false) prevents click-to-dismiss', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withClosable(false).withDuration(0).show();
        document.getElementById(id)!.querySelector('.bt-toast-row')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
    });

    it('withAllowHtml defaults to true and enables HTML rendering', () => {
        const t = new Toasts();
        const id = new ToastBuilder('<b>bold</b>', t).withAllowHtml().withDuration(0).show();
        expect(document.getElementById(id)!.querySelector('.bt-toast-message b')).not.toBeNull();
    });

    it('withAllowLineBreaks defaults to true and renders <br>/\\n as real breaks', () => {
        const t = new Toasts();
        const id = new ToastBuilder('a\nb', t).withAllowLineBreaks().withDuration(0).show();
        expect(document.getElementById(id)!.querySelectorAll('.bt-toast-message br').length).toBe(1);
    });

    it('withAllowLineBreaks(false) renders "\\n" as inert text', () => {
        const t = new Toasts();
        const id = new ToastBuilder('a\nb', t).withAllowLineBreaks(false).withDuration(0).show();
        const msg = document.getElementById(id)!.querySelector('.bt-toast-message')!;
        expect(msg.querySelectorAll('br').length).toBe(0);
        expect(msg.textContent).toBe('a\nb');
    });

    it('withPosition sets the snackbar data-position', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withPosition(ToastPosition.TOP_LEFT).withDuration(0).show();
        const snackbar = document.getElementById(id)!.closest('[data-position]');
        expect(snackbar?.getAttribute('data-position')).toBe(ToastPosition.TOP_LEFT);
    });

    it('withAnimation is accepted and produces a rendered toast', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withAnimation(ToastAnimation.FADE).withDuration(0).show();
        expect(document.getElementById(id)).not.toBeNull();
    });

    it('withOnClose is invoked when the toast is removed', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const onClose = vi.fn();
        const id = new ToastBuilder('m', t).withOnClose(onClose).withDuration(0).show();
        t.removeToast(id);
        vi.advanceTimersByTime(1000);
        expect(onClose).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('withPauseOnHover defaults to true and pauses the timer on mouseenter', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withPauseOnHover().withDuration(1000).show();
        const container = document.getElementById(id)!;
        container.dispatchEvent(new Event('mouseenter'));
        vi.advanceTimersByTime(5000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
        vi.useRealTimers();
    });

    it('withPauseOnHover also pauses the timer on focusin, not just mouseenter', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withPauseOnHover().withDuration(1000).show();
        const container = document.getElementById(id)!;
        container.dispatchEvent(new FocusEvent('focusin'));
        vi.advanceTimersByTime(5000);
        expect(document.getElementById(id)?.classList.contains('bt-hiding')).toBe(false);
        vi.useRealTimers();
    });

    it('withProgress defaults to true and renders a progress bar', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withProgress().withDuration(1000).show();
        expect(document.getElementById(id)!.querySelector('.bt-toast-progress')).not.toBeNull();
    });

    it('withData stores data retrievable via getToastData', () => {
        const t = new Toasts();
        const payload = { foo: 'bar' };
        const id = new ToastBuilder('m', t).withData(payload).withDuration(0).show();
        expect(t.getToastData(id)).toBe(payload);
    });

    it('withTheme merges theme overrides into the rendered style', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withTheme({ background: 'rgb(1, 2, 3)' }).withDuration(0).show();
        const toast = document.getElementById(id)!.querySelector('.bt-toast') as HTMLElement;
        expect(toast.style.getPropertyValue('--bt-background')).toBe('rgb(1, 2, 3)');
    });

    it('withTransition is accepted for shape-compatibility and does not error', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withTransition(ToastTransition.FADE).withDuration(0).show();
        expect(document.getElementById(id)).not.toBeNull();
    });

    it('andRemoveOtherToasts removes previously shown toasts', () => {
        const t = new Toasts();
        const first = new ToastBuilder('first', t).withDuration(0).show();
        new ToastBuilder('second', t).andRemoveOtherToasts().withDuration(0).show();
        expect(document.getElementById(first)?.classList.contains('bt-hiding')).toBe(true);
    });

    it('andReverseOrder inserts the toast at the far end of the stack', () => {
        const t = new Toasts();
        new ToastBuilder('first', t).withDuration(0).show();
        new ToastBuilder('second', t).andReverseOrder().withDuration(0).show();
        const rows = Array.from(document.querySelectorAll('.bt-toast-message')).map(el => el.textContent);
        expect(rows[0]).toBe('second');
    });

    it('withButton is repeatable and wires label/onClick/className', () => {
        const t = new Toasts();
        const onClick = vi.fn();
        const id = new ToastBuilder('m', t)
            .withButton('One', onClick, 'my-class')
            .withButton('Two')
            .withDuration(0)
            .show();
        const buttons = document.getElementById(id)!.querySelectorAll('.bt-toast-action');
        expect(buttons.length).toBe(2);
        expect(buttons[0].textContent).toBe('One');
        expect(buttons[0].classList.contains('my-class')).toBe(true);
        (buttons[0] as HTMLButtonElement).click();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(buttons[1].textContent).toBe('Two');
    });

    it('withDetails falls back to default labels when none are given', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withDetails(['line1']).withDuration(0).show();
        const toggle = document.getElementById(id)!.querySelector('.bt-toast-action') as HTMLButtonElement;
        expect(toggle.textContent).not.toBe('');
    });

    it('withDetails adds a details block with custom labels', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t)
            .withDetails(['line1', { label: 'L', value: 'line2' }], 'Show more', 'Hide more')
            .withDuration(0)
            .show();
        const el = document.getElementById(id)!;
        const toggle = el.querySelector('.bt-toast-action') as HTMLButtonElement;
        expect(toggle.textContent).toBe('Show more');
        toggle.click();
        const details = el.querySelector('.bt-toast-details')!;
        expect(details.querySelectorAll('.bt-toast-detail-item').length).toBe(2);
        expect(toggle.textContent).toBe('Hide more');
    });

    it('withCloseButton adds a working close button using Toasts.closeButton, appending to existing buttons', () => {
        vi.useFakeTimers();
        const t = new Toasts();
        const id = new ToastBuilder('m', t).withButton('First').withCloseButton('Dismiss').withDuration(0).show();
        const el = document.getElementById(id)!;
        const buttons = el.querySelectorAll('.bt-toast-action');
        expect(buttons.length).toBe(2);
        expect(buttons[1].textContent).toBe('Dismiss');
        (buttons[1] as HTMLButtonElement).click();
        expect(el.classList.contains('bt-hiding')).toBe(true);
        vi.useRealTimers();
    });

    it('withConfirmButton wires a confirm flow via Toasts.confirmButton, appending to existing buttons', () => {
        const t = new Toasts();
        const onConfirm = vi.fn();
        const id = new ToastBuilder('m', t)
            .withButton('First')
            .withConfirmButton('Delete', onConfirm, { yesLabel: 'Y', noLabel: 'N' })
            .withDuration(0)
            .show();
        const el = document.getElementById(id)!;
        const buttons = el.querySelectorAll('.bt-toast-action');
        expect(buttons.length).toBe(2);
        const deleteBtn = buttons[1] as HTMLButtonElement;
        expect(deleteBtn.textContent).toBe('Delete');
        deleteBtn.click();
        const actions = el.querySelectorAll('.bt-toast-action');
        expect(Array.from(actions).map(b => b.textContent)).toEqual(['Y', 'N']);
    });

    it('withStepButton wires a multi-step button via Toasts.stepButton, appending to existing buttons', () => {
        const t = new Toasts();
        const id = new ToastBuilder('m', t)
            .withButton('First')
            .withStepButton([
                { label: 'Step1', onClick: () => {} },
                { label: 'Step2' },
            ], 'step-class')
            .withDuration(0)
            .show();
        const el = document.getElementById(id)!;
        const buttons = el.querySelectorAll('.bt-toast-action');
        expect(buttons.length).toBe(2);
        const btn = buttons[1] as HTMLButtonElement;
        expect(btn.textContent).toBe('Step1');
        expect(btn.classList.contains('step-class')).toBe(true);
        btn.click();
        expect(btn.textContent).toBe('Step2');
    });

    it('withCloseButton/withConfirmButton/withStepButton each initialize buttons when none exist yet', () => {
        const t = new Toasts();
        const closeId = new ToastBuilder('m', t).withCloseButton('Dismiss').withDuration(0).show();
        expect(document.getElementById(closeId)!.querySelectorAll('.bt-toast-action').length).toBe(1);

        const confirmId = new ToastBuilder('m', t).withConfirmButton('Delete', () => {}).withDuration(0).show();
        expect(document.getElementById(confirmId)!.querySelectorAll('.bt-toast-action').length).toBe(1);

        const stepId = new ToastBuilder('m', t).withStepButton([{ label: 'Step1' }]).withDuration(0).show();
        expect(document.getElementById(stepId)!.querySelectorAll('.bt-toast-action').length).toBe(1);
    });

    it('show() returns the same id shape as showToast and chains across all setters', () => {
        const t = new Toasts();
        const id = new ToastBuilder('chained', t)
            .withTitle('Chain', 'stacked')
            .withColor(ToastColor.WARNING)
            .withDuration(0)
            .withClosable(true)
            .withAllowHtml(false)
            .withAllowLineBreaks(true)
            .withPosition(ToastPosition.BOTTOM_RIGHT)
            .withAnimation(ToastAnimation.SLIDE)
            .withPauseOnHover(false)
            .withProgress(false)
            .withData({ n: 1 })
            .withTheme({ actionColor: 'red' })
            .withButton('OK')
            .withCloseButton()
            .show();
        expect(document.getElementById(id)).not.toBeNull();
        expect(t.getToastData<{ n: number }>(id)?.n).toBe(1);
    });
});
