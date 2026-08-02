import { renderTextWithBreaks } from './ToastText';

export interface ToastButton {
    /** Rendered as plain text, like `title`, except "\n" and literal "<br>"/"<br/>" are still honored as line breaks — same rule as `message`/`title`, and same `allowLineBreaks` opt-out. */
    label: string;
    /** Receives the click/keyboard-activation event and this toast's id (e.g. to call `removeToast(id)` yourself, or `document.getElementById(id)` to update the toast's own content in place). */
    onClick?: (event: MouseEvent, id: string) => void;
    /** Extra class name(s) appended alongside the built-in `bt-toast-action` class, for consumer styling hooks. */
    className?: string;
}

export interface ToastButtonStep {
    /** Text shown while this step is active. */
    label: string;
    /**
     * Runs on click while this step is active. Return (or resolve to) `false` to
     * stay on this step instead of advancing — e.g. a guard that isn't met, or an
     * action that failed. Anything else (including `void`) advances to the next
     * step. A `Promise` return disables the button until it settles, so a slow or
     * real action can't be double-fired by a second click.
     */
    onClick?: (event: MouseEvent, id: string) => void | false | Promise<void | false>;
    /** Extra class(es) applied only while this step is active — added/removed via `classList` alongside the button's own base classes, never replacing them. */
    className?: string;
    /**
     * Auto-advance to `revertToStep` this many ms after this step becomes active
     * (cancelled if the button is clicked again first). No effect on `steps[0]` —
     * the first step is applied at render time, not via a click, so no timer ever
     * starts for it.
     */
    revertAfterMs?: number;
    /** Step index `revertAfterMs` advances to. Defaults to `0`. */
    revertToStep?: number;
}

function combineClassNames(...parts: (string | undefined)[]): string | undefined {
    const joined = parts.filter(Boolean).join(' ');
    return joined || undefined;
}

// Remembers whether a rendered action button honors line breaks, keyed off
// the button element itself. Set once at creation (createActionButton) and
// read again by applyStep on every step transition, since step buttons
// re-render their own label from inside their onClick handler rather than
// going through createActionButton a second time.
const buttonAllowLineBreaks = new WeakMap<HTMLButtonElement, boolean>();

// Builds a `<button class="bt-toast-action">` wired so mouse and keyboard
// activation both stop the event from ever reaching the row's own
// Enter/Space/click-to-dismiss listeners — no preventDefault, so the button's
// native click activation still fires normally.
export function createActionButton(label: string, onClick: (e: MouseEvent) => void, allowLineBreaks: boolean = true, className?: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className ? `bt-toast-action ${className}` : 'bt-toast-action';
    // Plain text, like the toast's own title/message when allowHtml is
    // false — "\n" and literal "<br>"/"<br/>" still render as line breaks,
    // unless allowLineBreaks is false.
    renderTextWithBreaks(el, label, allowLineBreaks);
    buttonAllowLineBreaks.set(el, allowLineBreaks);
    el.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        onClick(e);
    });
    el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.stopPropagation();
    });
    return el;
}

/** Renders a `ToastButton` — the shared body behind both the top-level `buttons` option and a details item's own `buttons`. `extraClassName` is `bt-toast-detail-action` for the latter. */
export function renderToastButton(btn: ToastButton, id: string, allowLineBreaks: boolean = true, extraClassName?: string): HTMLButtonElement {
    return createActionButton(btn.label, (e) => btn.onClick?.(e, id), allowLineBreaks, combineClassNames(extraClassName, btn.className));
}

interface StepButtonState {
    index: number;
    timer?: ReturnType<typeof setTimeout>;
}

// Keyed off the rendered <button> element itself, not the `steps` array/closure
// — so the same `createStepButton(...)` result can be reused across multiple
// simultaneously-rendered toasts without their state machines colliding, and so
// state is automatically released once a toast's button is removed. Mirrors
// `Toasts`'s own `_onCloseCallbacks`/`_resizeObservers: WeakMap<HTMLElement, ...>`.
const stepState = new WeakMap<HTMLButtonElement, StepButtonState>();

function applyStep(el: HTMLButtonElement, steps: ToastButtonStep[], fromIndex: number | undefined, toIndex: number): void {
    if (fromIndex !== undefined) {
        const prevClassName = steps[fromIndex]?.className;
        if (prevClassName) el.classList.remove(...prevClassName.split(' ').filter(Boolean));
    }
    const step = steps[toIndex]!;
    if (step.className) el.classList.add(...step.className.split(' ').filter(Boolean));
    el.replaceChildren();
    renderTextWithBreaks(el, step.label, buttonAllowLineBreaks.get(el) ?? true);

    const state: StepButtonState = { index: toIndex };
    if (step.revertAfterMs !== undefined) {
        state.timer = setTimeout(() => applyStep(el, steps, toIndex, step.revertToStep ?? 0), step.revertAfterMs);
    }
    stepState.set(el, state);
}

/**
 * Builds a plain `ToastButton` whose `onClick` walks through `steps` in order —
 * the primitive behind `Toasts.detailsCopyButton()`, also usable directly (via
 * `Toasts.stepButton()`/`ToastBuilder.withStepButton()`) for custom multi-step
 * flows (temporary feedback, a guarded action, ...). `Toasts.confirmButton()`
 * doesn't use this — it swaps the whole toast's content instead of just this
 * button's label, see there. Safe to reuse the same returned `ToastButton`
 * across multiple simultaneously-rendered toasts — state lives per rendered
 * `<button>` element, not in this call's closure.
 */
export function createStepButton(steps: ToastButtonStep[], className?: string): ToastButton {
    const first = steps[0];
    if (!first) {
        console.warn('[brents-toasts] stepButton()/confirmButton() called with no steps.');
        return { label: '', className };
    }

    return {
        label: first.label,
        className: combineClassNames(className, first.className),
        onClick: (event, id) => {
            const el = event.currentTarget as HTMLButtonElement;
            const current = stepState.get(el);
            if (current?.timer) clearTimeout(current.timer);
            const index = current?.index ?? 0;
            const step = steps[index]!;

            const advance = (result: void | false) => {
                if (result === false) {
                    stepState.set(el, { index });
                    return;
                }
                applyStep(el, steps, index, Math.min(index + 1, steps.length - 1));
            };

            if (!step.onClick) {
                advance(undefined);
                return;
            }

            let result: void | false | Promise<void | false>;
            try {
                result = step.onClick(event, id);
            } catch (err) {
                console.warn('[brents-toasts] a step button\'s onClick threw:', err);
                stepState.set(el, { index });
                return;
            }

            if (result instanceof Promise) {
                el.disabled = true;
                result
                    .then((r) => {
                        el.disabled = false;
                        advance(r);
                    })
                    .catch((err) => {
                        el.disabled = false;
                        stepState.set(el, { index });
                        console.warn('[brents-toasts] a step button\'s onClick rejected:', err);
                    });
                return;
            }

            advance(result);
        },
    };
}
