import { ToastColor } from './ToastColor';
import { applyThemeVars, autoCloseIconColor, type ToastTheme } from './ToastTheme';
import { createActionButton, renderToastButton, type ToastButton } from './ToastButton';
import { renderTextWithBreaks } from './ToastText';
import type { ToastTranslations } from './ToastLocale';
import type { ToastDetailItem, ToastProgressOptions } from './Toasts';

// Fully-defaulted internal shape for a toast's progress bar config - mirrors
// ResolvedToastOptions's role but scoped to just this sub-feature. Returned
// by applyProgress() for the caller (Toasts._progressConfig) to store,
// keyed off the toast's own root element like `_data`/`_timers`.
export interface ResolvedProgress {
    position: 'top' | 'bottom';
    origin: 'left' | 'right' | 'center';
    mode: 'fill' | 'drain' | 'manual';
    /** Fill fraction (0-1) for `mode: 'manual'`. Unused for `'fill'`/`'drain'`, which derive
     *  their fill from the toast's timer instead - see `Toasts._syncProgressBar`. Mutated
     *  directly by `Toasts.setToastProgress` (not just re-set wholesale like the other fields). */
    value: number;
    color: string;
    trackColor: string;
    height: number;
    /** Accessible name for the bar's `role="progressbar"` - see `ToastProgressOptions.label`. */
    label: string;
}

// Shared by Toasts.showToast (creation) and Toasts.updateToast - sets the
// indicator bar color, the role/aria-live pair it drives, and the rest of
// the theme (card background/text/details background/action color as CSS
// vars, plus the close icon color) so all of it can never fall out of sync
// between the two call sites.
export function applyColor(toastClose: HTMLElement, toast: HTMLElement, color: string, theme?: ToastTheme): void {
    toastClose.style.setProperty('--data-background', color);
    const isAlert = color === ToastColor.ERROR || color === ToastColor.WARNING;
    toast.setAttribute('role', isAlert ? 'alert' : 'status');
    toast.setAttribute('aria-live', isAlert ? 'assertive' : 'polite');
    applyThemeVars(toast, theme);
    // Always set explicitly (never left to plain CSS) - this is the one
    // theme field whose whole point is computing something CSS can't:
    // contrast against the toast's own (possibly per-toast) `color`.
    toastClose.style.setProperty('--bt-close-icon', theme?.closeIcon ?? autoCloseIconColor(color));
}

// Shared by Toasts.showToast and Toasts.updateToast - (re)builds the
// title/message children of `toastContent` in place, handling title
// appearing/disappearing between calls, and `titleMode` switching between a
// stacked title (its own line, above the message - the default) and an
// inline one (a bold lead-in on the message's own line). 'stacked' keeps the
// exact DOM shape this had before `titleMode` existed - a `.bt-toast-title`
// sibling before `.bt-toast-message` - so it's a strict superset, not a
// behavior change, for anyone not using `titleMode`.
export function applyContent(toastContent: HTMLElement, message: string | Node, opts: { title?: string; allowHtml: boolean; allowLineBreaks: boolean; titleMode?: 'inline' | 'stacked' }): void {
    const inline = opts.titleMode === 'inline' && !!opts.title;

    let toastTitle = toastContent.querySelector<HTMLElement>('.bt-toast-title');
    if (opts.title && !inline) {
        if (!toastTitle) {
            toastTitle = document.createElement('div');
            toastTitle.className = 'bt-toast-title';
            toastContent.insertBefore(toastTitle, toastContent.firstChild);
        }
        toastTitle.replaceChildren();
        // Plain text, like message when allowHtml is false - "\n" and
        // literal "<br>"/"<br/>" still render as line breaks regardless of
        // allowHtml, since title never opts into full HTML - unless
        // allowLineBreaks opts out of that too.
        renderTextWithBreaks(toastTitle, opts.title, opts.allowLineBreaks);
    } else if (toastTitle) {
        toastTitle.remove();
    }

    let toastMessage = toastContent.querySelector<HTMLElement>('.bt-toast-message');
    if (!toastMessage) {
        toastMessage = document.createElement('div');
        toastMessage.className = 'bt-toast-message';
        toastContent.appendChild(toastMessage);
    }
    toastMessage.replaceChildren();

    if (inline) {
        // Same never-parsed-as-HTML rule as the stacked title - just
        // rendered as a bold lead-in sharing the message's line instead of
        // a block of its own.
        const inlineTitle = document.createElement('b');
        inlineTitle.className = 'bt-toast-title bt-toast-title-inline';
        renderTextWithBreaks(inlineTitle, opts.title!, opts.allowLineBreaks);
        toastMessage.appendChild(inlineTitle);
        toastMessage.appendChild(document.createTextNode(' '));
    }

    if (message instanceof Node) {
        toastMessage.appendChild(message);
    } else if (opts.allowHtml) {
        if (inline) {
            // Can't assign toastMessage.innerHTML directly here - that would
            // wipe out the inline title node just appended above. Scoping the
            // HTML to its own child keeps the title intact.
            const html = document.createElement('span');
            html.innerHTML = message ?? '';
            toastMessage.appendChild(html);
        } else {
            toastMessage.innerHTML = message ?? '';
        }
    } else {
        renderTextWithBreaks(toastMessage, message, opts.allowLineBreaks);
    }
}

// Shared by applyProgress and Toasts._syncProgressBar - the only place that
// writes aria-valuenow, so the accessible value can never drift from
// whatever fraction (0-1) the bar's fill is actually being set to.
export function setProgressAriaValue(wrap: HTMLElement, fraction: number): void {
    wrap.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(1, fraction)) * 100)));
}

// Shared by Toasts.showToast and Toasts.updateToast - fully rebuilds
// `.bt-toast-progress` from scratch (same full-rebuild-not-diff approach as
// renderActions). Purely structural - never touches transform/transition;
// Toasts._syncProgressBar (called immediately after, at every call site)
// owns what value/animation is currently showing. Returns the resolved
// config for the caller to store (or `undefined` if `progress` is falsy,
// in which case the caller should drop any previously-stored config too).
export function applyProgress(
    toast: HTMLElement,
    progress: boolean | ToastProgressOptions | undefined,
    toastColor: string,
    t: ToastTranslations
): ResolvedProgress | undefined {
    toast.querySelector('.bt-toast-progress')?.remove();
    if (!progress) return undefined;

    const p = progress === true ? {} : progress;
    const cfg: ResolvedProgress = {
        position: p.position ?? 'bottom',
        origin: p.origin ?? 'left',
        mode: p.mode ?? 'drain',
        value: Math.max(0, Math.min(1, p.value ?? 0)),
        color: p.color ?? toastColor,
        trackColor: p.trackColor ?? 'transparent',
        height: p.height ?? 3,
        label: p.label ?? t.progress,
    };

    const wrap = document.createElement('div');
    wrap.className = 'bt-toast-progress';
    wrap.dataset.position = cfg.position;
    wrap.style.height = `${cfg.height}px`;
    wrap.style.background = cfg.trackColor;
    wrap.style.display = 'none'; // defensive default; _syncProgressBar (called right after) sets the real value
    wrap.setAttribute('role', 'progressbar');
    wrap.setAttribute('aria-valuemin', '0');
    wrap.setAttribute('aria-valuemax', '100');
    wrap.setAttribute('aria-label', cfg.label);

    const fill = document.createElement('div');
    fill.className = 'bt-toast-progress-fill';
    fill.dataset.origin = cfg.origin;
    fill.style.background = cfg.color;
    fill.style.transition = 'none';
    const initialFraction = cfg.mode === 'manual' ? cfg.value : cfg.mode === 'fill' ? 0 : 1;
    fill.style.transform = `scaleX(${initialFraction})`;
    setProgressAriaValue(wrap, initialFraction);

    wrap.appendChild(fill);
    toast.appendChild(wrap);
    return cfg;
}

interface RenderActionsOptions {
    buttons?: ToastButton[];
    details?: (string | ToastDetailItem)[];
    detailsLabel?: string;
    detailsHideLabel?: string;
    allowLineBreaks: boolean;
}

// Shared by Toasts.showToast and Toasts.updateToast - fully rebuilds the
// `.bt-toast-actions` (buttons + details-toggle) and `.bt-toast-details`
// subtrees from `opts`, rather than diffing against whatever's currently
// rendered. Toasts are small, so a full rebuild is cheap and keeps this the
// single place that knows how buttons/details/the toggle button relate to
// each other. `onDetailsOpen` is called with `id` when details are expanded
// - Toasts wires this to `resetToastTimer` so a user who just asked to read
// more doesn't have the toast disappear mid-read.
export function renderActions(
    toastRow: HTMLElement,
    toast: HTMLElement,
    opts: RenderActionsOptions,
    id: string,
    t: ToastTranslations,
    onDetailsOpen: (id: string) => void
): void {
    toastRow.querySelector('.bt-toast-actions')?.remove();
    toast.querySelector('.bt-toast-details')?.remove();

    let toastActions: HTMLDivElement | undefined;
    const ensureActions = (): HTMLDivElement => {
        if (!toastActions) {
            toastActions = document.createElement('div');
            toastActions.className = 'bt-toast-actions';
        }
        return toastActions;
    };

    if (opts.buttons && opts.buttons.length) {
        opts.buttons.forEach((btn) => {
            ensureActions().appendChild(renderToastButton(btn, id, opts.allowLineBreaks));
        });
    }

    let detailsEl: HTMLDivElement | undefined;
    if (opts.details && opts.details.length) {
        detailsEl = document.createElement('div');
        detailsEl.className = 'bt-toast-details';
        detailsEl.id = `${id}-details`;

        opts.details.forEach((raw) => {
            const item: ToastDetailItem = typeof raw === 'string' ? { value: raw } : raw;
            const row = document.createElement('div');
            row.className = 'bt-toast-detail-item';

            const text = document.createElement('span');
            text.className = 'bt-toast-detail-text';
            if (item.label) {
                const label = document.createElement('span');
                label.className = 'bt-toast-detail-label';
                renderTextWithBreaks(label, item.label, opts.allowLineBreaks);
                text.appendChild(label);
            }
            const value = document.createElement('span');
            value.className = 'bt-toast-detail-value';
            renderTextWithBreaks(value, item.value, opts.allowLineBreaks);
            text.appendChild(value);
            row.appendChild(text);

            if (item.buttons && item.buttons.length) {
                item.buttons.forEach((btn) => {
                    row.appendChild(renderToastButton(btn, id, opts.allowLineBreaks, 'bt-toast-detail-action'));
                });
            }

            detailsEl!.appendChild(row);
        });

        const detailsLabel = opts.detailsLabel ?? t.details;
        const detailsHideLabel = opts.detailsHideLabel ?? t.hideDetails;
        let toggleBtn: HTMLButtonElement;
        toggleBtn = createActionButton(detailsLabel, () => {
            const isOpen = detailsEl!.classList.toggle('bt-open');
            toggleBtn.replaceChildren();
            renderTextWithBreaks(toggleBtn, isOpen ? detailsHideLabel : detailsLabel, opts.allowLineBreaks);
            toggleBtn.setAttribute('aria-expanded', String(isOpen));
            if (isOpen) onDetailsOpen(id);
        }, opts.allowLineBreaks);
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-controls', detailsEl.id);
        ensureActions().appendChild(toggleBtn);
    }

    if (toastActions) toastRow.appendChild(toastActions);
    if (detailsEl) toast.appendChild(detailsEl);
}
