/*
  Brents-Toasts ("Snackbar System v2")
  Version 1.0
  Under Apache License 2.0
  Brentspine 2026
*/

import { ToastColor } from './ToastColor';
import { ToastPosition, IMPLEMENTED_POSITIONS, type ToastPositionValue } from './ToastPosition';
import { ToastAnimation, IMPLEMENTED_ANIMATIONS, type ToastAnimationValue } from './ToastAnimation';
import toastsCss from './toasts.css';
import VERSION from 'virtual:version';

const MAX_TOASTS = 5;
const TOAST_GAP = 8;
const TOAST_BOTTOM_OFFSET = 22;
const TOAST_TRANSITION_MS = 300;

export interface ToastButton {
    /** Always rendered as plain text, like `title`. */
    label: string;
    /** Receives the click/keyboard-activation event and this toast's id (e.g. to call `removeToast(id)` yourself, or `document.getElementById(id)` to update the toast's own content in place). */
    onClick?: (event: MouseEvent, id: string) => void;
    /** Extra class name(s) appended alongside the built-in `bt-toast-action` class, for consumer styling hooks. */
    className?: string;
}

export interface ToastDetailItem {
    /** Optional label shown before the value, e.g. "Status". */
    label?: string;
    value: string;
    /** Show a "Copy" button for this item. Defaults to `detailsCopyable` (which itself defaults to true, when the Clipboard API is available). */
    copyable?: boolean;
    /** Extra action buttons rendered after this item's Copy button. Same shape and click/keyboard behavior as the top-level `buttons` option. */
    buttons?: ToastButton[];
}

export interface ToastOptions {
    /** Background color of the indicator bar. Defaults to `ToastColor.INFO` or the configured default. */
    color?: string;
    /** Auto-dismiss after ms. Use `0` to disable. Defaults to `3000` or the configured default. */
    duration?: number;
    /** Whether clicking the toast dismisses it. Defaults to `true` or the configured default. */
    closable?: boolean;
    /** If true, `message` is rendered as HTML. XSS: sanitize input yourself if it may contain user-controlled content. */
    allowHtml?: boolean;
    /** Optional bold title line rendered above the message. Always rendered as plain text. */
    title?: string;
    /** See `ToastPosition` — only BOTTOM_CENTER is implemented today. */
    position?: ToastPositionValue;
    /** See `ToastAnimation` — only SLIDE is implemented today. */
    animation?: ToastAnimationValue;
    /** Called as soon as the toast starts closing (manually or via duration timeout). */
    onClose?: () => void;
    /** If true, dismisses every other currently-visible toast before showing this one. */
    removeOtherToasts?: boolean;
    /** Action buttons rendered to the right of the message, vertically centered regardless of whether `title` is present. Styled as plain clickable text, not native-looking buttons, by default. Clicks never trigger `closable` dismissal. */
    buttons?: ToastButton[];
    /** Extra detail lines revealed by an auto-added "Details" toggle button, rendered in a visually distinct block below the message — structurally outside the clickable/dismissable part of the toast. Strings are shorthand for `{ value }`. */
    details?: (string | ToastDetailItem)[];
    /** Label for the auto-added details toggle button. Defaults to `"Details"`. */
    detailsLabel?: string;
    /** Label for the toggle button while details are expanded. Defaults to `"Hide details"`. */
    detailsHideLabel?: string;
    /** Default `copyable` for every details item that doesn't set its own. Defaults to `true`. Set `false` to hide every item's "Copy" button without repeating `copyable: false` on each one. */
    detailsCopyable?: boolean;
    /** Default `copyable` for a details item's "Copy" button when `details` has exactly one entry — takes precedence over `detailsCopyable` in that case (an item's own `copyable` still wins over both). Defaults to `false`: a lone detail item is assumed visible/short enough that copying it adds little, so its "Copy" button is hidden unless opted back in. */
    detailsCopyableSingle?: boolean;
}

export interface ToastsConfig {
    color: string;
    duration: number;
    closable: boolean;
    allowHtml: boolean;
    position: ToastPositionValue;
    animation: ToastAnimationValue;
    maxToasts: number;
    evictOldest: boolean;
}

interface ResolvedToastOptions {
    color: string;
    duration: number;
    closable: boolean;
    allowHtml: boolean;
    position: ToastPositionValue;
    animation: ToastAnimationValue;
    title?: string;
    onClose?: () => void;
    removeOtherToasts: boolean;
    buttons?: ToastButton[];
    details?: (string | ToastDetailItem)[];
    detailsLabel?: string;
    detailsHideLabel?: string;
    detailsCopyable?: boolean;
    detailsCopyableSingle?: boolean;
}

const DEFAULT_CONFIG: ToastsConfig = {
    color: ToastColor.INFO,
    duration: 3000,
    closable: true,
    allowHtml: false,
    position: ToastPosition.BOTTOM_CENTER,
    animation: ToastAnimation.SLIDE,
    maxToasts: MAX_TOASTS,
    evictOldest: true,
};

export class Toasts {
    public config: ToastsConfig;
    public snackbars: Map<ToastPositionValue, HTMLElement>;
    private _initialized: boolean;
    private _warned: Set<string>;
    private _onCloseCallbacks: WeakMap<HTMLElement, () => void>;
    private _resizeObservers: WeakMap<HTMLElement, ResizeObserver>;

    constructor() {
        this._initialized = false;
        this.snackbars = new Map();
        this.config = { ...DEFAULT_CONFIG };
        this._warned = new Set();
        this._onCloseCallbacks = new WeakMap();
        this._resizeObservers = new WeakMap();
    }

    /**
     * Merge library-wide defaults (position, maxToasts, animation, color, ...).
     * Per-call options passed to showToast still take precedence.
     */
    configure(config: Partial<ToastsConfig> = {}): void {
        this.config = { ...this.config, ...config };
    }

    // Lazy init — sicher für SSR / Node-Umgebungen
    private _init(): void {
        if (this._initialized) return;
        this._initialized = true;
        this._appendStyle();
    }

    /**
     * @param message The text to display. HTML only if `allowHtml` is true.
     *   Pass a `Node` (e.g. an `HTMLElement`/`DocumentFragment`) instead for
     *   fully custom, interactive content — it's appended directly, so
     *   `allowHtml`/XSS sanitization concerns don't apply to it.
     * @param options Per-toast overrides. See `ToastOptions`.
     * @returns The toast's unique ID (can be used with `removeToast`).
     */
    showToast(message: string | Node, options?: ToastOptions): string;
    /**
     * Legacy positional signature — equivalent to showToast(message, { color, duration, closable, allowHtml }).
     * @param message  The text to display. HTML only if `allowHtml` is true.
     *   Pass a `Node` for fully custom content — `allowHtml` is ignored in that case.
     * @param color    Background color of the indicator bar. Defaults to `ToastColor.INFO`.
     * @param duration Auto-dismiss after ms. Use `0` to disable. Defaults to `3000`.
     * @param closable Whether clicking the toast dismisses it. Defaults to `true`.
     * @param allowHtml If true, `message` is rendered as HTML. XSS: sanitize input yourself...
     * @returns The toast's unique ID (can be used with `removeToast`).
     */
    showToast(message: string | Node, color?: string, duration?: number, closable?: boolean, allowHtml?: boolean): string;
    showToast(
        message: string | Node,
        colorOrOptions?: string | ToastOptions,
        duration?: number,
        closable?: boolean,
        allowHtml?: boolean
    ): string {
        this._init();
        const opts = this._resolveOptions(colorOrOptions, duration, closable, allowHtml);

        if (opts.removeOtherToasts) {
            this._removeAllToasts();
        }

        const position = this._resolvePosition(opts.position);
        this._resolveAnimation(opts.animation);
        const snackbar = this._getSnackbar(position);

        const activeToasts = Array.from(snackbar.children).filter(
            t => !t.classList.contains('bt-hiding')
        );
        if (activeToasts.length >= this.config.maxToasts && this.config.evictOldest) {
            const oldest = activeToasts[0];
            if (oldest) this.removeToast(oldest.id);
        }

        const id = `toast-${Math.random().toString(36).slice(2, 11)}`;

        const toastContainer = document.createElement('div');
        toastContainer.className = 'bt-toast-container';
        toastContainer.style.bottom = '0px';
        toastContainer.style.opacity = '0';
        toastContainer.id = id;
        if (opts.onClose) this._onCloseCallbacks.set(toastContainer, opts.onClose);

        const isAlert = opts.color === ToastColor.ERROR || opts.color === ToastColor.WARNING;
        const toast = document.createElement('div');
        toast.className = 'bt-toast';
        toast.setAttribute('role', isAlert ? 'alert' : 'status');
        toast.setAttribute('aria-live', isAlert ? 'assertive' : 'polite');

        // Everything that dismisses the toast on click/Enter/Space lives on
        // this row, not on `toast` itself — so the details block below (a
        // sibling of this row, not a descendant) is structurally outside the
        // dismiss listener's reach and can never trigger it.
        const toastRow = document.createElement('div');
        toastRow.className = `bt-toast-row${opts.closable ? ' bt-closable' : ''}`;

        const toastClose = document.createElement('div');
        toastClose.className = 'bt-toast-close';
        toastClose.style.setProperty('--data-background', opts.color);
        const closeSpan = document.createElement('span');
        closeSpan.innerHTML = '&times;';
        toastClose.appendChild(closeSpan);

        const toastContent = document.createElement('div');
        toastContent.className = 'bt-toast-content';
        if (opts.title) {
            const toastTitle = document.createElement('div');
            toastTitle.className = 'bt-toast-title';
            toastTitle.textContent = opts.title;
            toastContent.appendChild(toastTitle);
        }
        const toastMessage = document.createElement('div');
        toastMessage.className = 'bt-toast-message';
        if (message instanceof Node) {
            toastMessage.appendChild(message);
        } else if (opts.allowHtml) {
            toastMessage.innerHTML = message;
        } else {
            toastMessage.textContent = message;
        }
        toastContent.appendChild(toastMessage);

        // Builds a `<button class="bt-toast-action">` wired so mouse and
        // keyboard activation both stop the event from ever reaching the
        // row's own Enter/Space/click-to-dismiss listeners (see below) — no
        // preventDefault, so the button's native click activation still
        // fires normally.
        const makeActionButton = (label: string, onClick: (e: MouseEvent) => void, className?: string): HTMLButtonElement => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = className ? `bt-toast-action ${className}` : 'bt-toast-action';
            el.textContent = label;
            el.addEventListener('click', (e: MouseEvent) => {
                e.stopPropagation();
                onClick(e);
            });
            el.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
                e.stopPropagation();
            });
            return el;
        };

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
                ensureActions().appendChild(makeActionButton(btn.label, (e) => btn.onClick?.(e, id), btn.className));
            });
        }

        let detailsEl: HTMLDivElement | undefined;
        if (opts.details && opts.details.length) {
            detailsEl = document.createElement('div');
            detailsEl.className = 'bt-toast-details';
            detailsEl.id = `${id}-details`;
            const isSingleDetail = opts.details.length === 1;

            opts.details.forEach((raw) => {
                const item: ToastDetailItem = typeof raw === 'string' ? { value: raw } : raw;
                const row = document.createElement('div');
                row.className = 'bt-toast-detail-item';

                const text = document.createElement('span');
                text.className = 'bt-toast-detail-text';
                if (item.label) {
                    const label = document.createElement('span');
                    label.className = 'bt-toast-detail-label';
                    label.textContent = item.label;
                    text.appendChild(label);
                }
                const value = document.createElement('span');
                value.className = 'bt-toast-detail-value';
                value.textContent = item.value;
                text.appendChild(value);
                row.appendChild(text);

                const copyableDefault = isSingleDetail
                    ? (opts.detailsCopyableSingle ?? false)
                    : (opts.detailsCopyable ?? true);
                const copyable = item.copyable ?? copyableDefault;
                if (copyable && navigator.clipboard) {
                    const copyText = item.label ? `${item.label}: ${item.value}` : item.value;
                    let copyBtn: HTMLButtonElement;
                    copyBtn = makeActionButton('Copy', () => {
                        navigator.clipboard.writeText(copyText).then(() => {
                            const original = copyBtn.textContent;
                            copyBtn.textContent = 'Copied!';
                            setTimeout(() => { copyBtn.textContent = original; }, 2000);
                        });
                    }, 'bt-toast-detail-copy');
                    row.appendChild(copyBtn);
                }

                if (item.buttons && item.buttons.length) {
                    item.buttons.forEach((btn) => {
                        const className = btn.className ? `bt-toast-detail-action ${btn.className}` : 'bt-toast-detail-action';
                        row.appendChild(makeActionButton(btn.label, (e) => btn.onClick?.(e, id), className));
                    });
                }

                detailsEl!.appendChild(row);
            });

            const detailsLabel = opts.detailsLabel ?? 'Details';
            const detailsHideLabel = opts.detailsHideLabel ?? 'Hide details';
            let toggleBtn: HTMLButtonElement;
            toggleBtn = makeActionButton(detailsLabel, () => {
                const isOpen = detailsEl!.classList.toggle('bt-open');
                toggleBtn.textContent = isOpen ? detailsHideLabel : detailsLabel;
                toggleBtn.setAttribute('aria-expanded', String(isOpen));
            });
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.setAttribute('aria-controls', detailsEl.id);
            ensureActions().appendChild(toggleBtn);
        }

        toastRow.appendChild(toastClose);
        toastRow.appendChild(toastContent);
        if (toastActions) toastRow.appendChild(toastActions);
        toast.appendChild(toastRow);
        if (detailsEl) toast.appendChild(detailsEl);
        toastContainer.appendChild(toast);
        snackbar.appendChild(toastContainer);

        this._stackExistingAbove(snackbar, toastContainer);

        // Any later height change (details toggled open/closed, or a
        // consumer mutating the toast's own content in place) reflows the
        // whole stack, so an expanded toast never overlaps the ones above it.
        const resizeObserver = new ResizeObserver(() => this._recalculatePositions(snackbar));
        resizeObserver.observe(toast);
        this._resizeObservers.set(toastContainer, resizeObserver);

        // Minimaler Delay damit CSS-Transition greift
        requestAnimationFrame(() => {
            toastContainer.style.bottom = `${TOAST_BOTTOM_OFFSET}px`;
            toastContainer.style.opacity = '1';
        });

        if (opts.closable) {
            toastRow.setAttribute('tabindex', '0');
            toastRow.addEventListener('click', () => this.removeToast(id));
            toastRow.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
                e.preventDefault();
                this.removeToast(id);
            });
        }
        if (opts.duration > 0) {
            setTimeout(() => this.removeToast(id), opts.duration);
        }

        return id;
    }

    removeToast(id: string): void {
        const toastContainer = document.getElementById(id);
        if (!toastContainer) return;
        if (toastContainer.classList.contains('bt-hiding')) return;
        const parent = toastContainer.parentElement;

        const onClose = this._onCloseCallbacks.get(toastContainer);
        this._onCloseCallbacks.delete(toastContainer);
        if (onClose) onClose();

        toastContainer.classList.add('bt-hiding');
        toastContainer.style.opacity = '0';
        // Reposition the remaining toasts now, in parallel with the fade-out,
        // instead of waiting for this one to finish disappearing.
        if (parent) this._recalculatePositions(parent);

        setTimeout(() => {
            toastContainer.remove();
            this._resizeObservers.get(toastContainer)?.disconnect();
            this._resizeObservers.delete(toastContainer);
            if (parent) this._recalculatePositions(parent);
        }, TOAST_TRANSITION_MS);
    }

    /**
     * A ready-made "Close" action button (for the `buttons` option / `ToastBuilder.withCloseButton()`)
     * that dismisses the toast it's on, wired to this `Toasts` instance's `removeToast`.
     * `label` is a plain parameter rather than a hardcoded string — like `detailsLabel` — so it can be
     * translated by the caller (e.g. once localization is added) instead of being baked in.
     */
    closeButton(label: string = 'Close', className?: string): ToastButton {
        return {
            label,
            className,
            onClick: (_event, id) => this.removeToast(id),
        };
    }

    private _removeAllToasts(): void {
        this.snackbars.forEach(snackbar => {
            Array.from(snackbar.children).forEach(child => this.removeToast(child.id));
        });
    }

    private _resolveOptions(
        colorOrOptions?: string | ToastOptions,
        duration?: number,
        closable?: boolean,
        allowHtml?: boolean
    ): ResolvedToastOptions {
        const base: ResolvedToastOptions = {
            color: this.config.color,
            duration: this.config.duration,
            closable: this.config.closable,
            allowHtml: this.config.allowHtml,
            position: this.config.position,
            animation: this.config.animation,
            title: undefined,
            onClose: undefined,
            removeOtherToasts: false,
            buttons: undefined,
            details: undefined,
            detailsLabel: undefined,
            detailsHideLabel: undefined,
            detailsCopyable: undefined,
            detailsCopyableSingle: undefined,
        };

        if (colorOrOptions !== null && typeof colorOrOptions === 'object') {
            return { ...base, ...colorOrOptions };
        }

        if (colorOrOptions !== undefined) base.color = colorOrOptions;
        if (duration !== undefined) base.duration = duration;
        if (closable !== undefined) base.closable = closable;
        if (allowHtml !== undefined) base.allowHtml = allowHtml;
        return base;
    }

    private _resolvePosition(position: ToastPositionValue): ToastPositionValue {
        if (IMPLEMENTED_POSITIONS.has(position)) return position;
        this._warnUnimplemented('position', position, ToastPosition.BOTTOM_CENTER);
        return ToastPosition.BOTTOM_CENTER;
    }

    private _resolveAnimation(animation: ToastAnimationValue): ToastAnimationValue {
        if (IMPLEMENTED_ANIMATIONS.has(animation)) return animation;
        this._warnUnimplemented('animation', animation, ToastAnimation.SLIDE);
        return ToastAnimation.SLIDE;
    }

    private _warnUnimplemented(kind: string, value: string, fallback: string): void {
        const key = `${kind}:${value}`;
        if (this._warned.has(key)) return;
        this._warned.add(key);
        console.warn(`[brents-toasts] ${kind} "${value}" is not implemented yet, falling back to "${fallback}".`);
    }

    // Repositions all remaining toasts, newest-first (matching the stacking
    // order established when a toast is added), using each toast's actual
    // rendered height so variable-height toasts (e.g. with a title) don't
    // overlap their neighbors.
    private _recalculatePositions(snackbar: HTMLElement): void {
        let offset = TOAST_BOTTOM_OFFSET;
        Array.from(snackbar.children)
            .filter(el => !el.classList.contains('bt-hiding'))
            .reverse()
            .forEach((el) => {
                const toastEl = el as HTMLElement;
                toastEl.style.bottom = `${offset}px`;
                offset += toastEl.getBoundingClientRect().height + TOAST_GAP;
            });
    }

    // Pushes every toast other than `newToast` up to make room for it,
    // stacking newest-to-oldest by each toast's actual rendered height.
    private _stackExistingAbove(snackbar: HTMLElement, newToast: HTMLElement): void {
        let offset = TOAST_BOTTOM_OFFSET + newToast.getBoundingClientRect().height + TOAST_GAP;
        Array.from(snackbar.children)
            .filter(el => el !== newToast)
            .reverse()
            .forEach((el) => {
                const toastEl = el as HTMLElement;
                toastEl.style.bottom = `${offset}px`;
                offset += toastEl.getBoundingClientRect().height + TOAST_GAP;
            });
    }

    private _appendStyle(): void {
        if (document.getElementById('toasts-styles')) return;
        const style = document.createElement('style');
        style.id = 'toasts-styles';
        style.innerHTML = toastsCss;
        document.head.appendChild(style);
        document.head.insertBefore(document.createComment(`brents-toasts v${VERSION} styles`), style);
    }

    /**
     * Only BOTTOM_CENTER has real placement CSS today (see ToastPosition.ts),
     * so every position currently renders through the same #snackbar element.
     * Other positions get their own container/id once they're implemented.
     */
    private _getSnackbar(position: ToastPositionValue): HTMLElement {
        const cached = this.snackbars.get(position);
        if (cached) return cached;

        const existing = position === ToastPosition.BOTTOM_CENTER
            ? document.getElementById('snackbar')
            : null;
        if (existing) {
            this.snackbars.set(position, existing);
            return existing;
        }

        const snackbar = document.createElement('div');
        snackbar.className = 'bt-snackbar';
        snackbar.dataset.position = position;
        if (position === ToastPosition.BOTTOM_CENTER) snackbar.id = 'snackbar';
        snackbar.setAttribute('role', 'region');
        snackbar.setAttribute('aria-label', 'Notifications');
        document.body.appendChild(snackbar);
        document.body.insertBefore(document.createComment(`brents-toasts v${VERSION} snackbar container`), snackbar);
        this.snackbars.set(position, snackbar);
        return snackbar;
    }
}

export const toasts = new Toasts();
