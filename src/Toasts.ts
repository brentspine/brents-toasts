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

const MAX_TOASTS = 5;
const TOAST_GAP = 8;
const TOAST_BOTTOM_OFFSET = 22;
const TOAST_TRANSITION_MS = 300;

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

    constructor() {
        this._initialized = false;
        this.snackbars = new Map();
        this.config = { ...DEFAULT_CONFIG };
        this._warned = new Set();
        this._onCloseCallbacks = new WeakMap();
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
        toast.className = `bt-toast${opts.closable ? ' bt-closable' : ''}`;
        toast.setAttribute('role', isAlert ? 'alert' : 'status');
        toast.setAttribute('aria-live', isAlert ? 'assertive' : 'polite');

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

        toast.appendChild(toastClose);
        toast.appendChild(toastContent);
        toastContainer.appendChild(toast);
        snackbar.appendChild(toastContainer);

        this._stackExistingAbove(snackbar, toastContainer);

        // Minimaler Delay damit CSS-Transition greift
        requestAnimationFrame(() => {
            toastContainer.style.bottom = `${TOAST_BOTTOM_OFFSET}px`;
            toastContainer.style.opacity = '1';
        });

        if (opts.closable) {
            toast.setAttribute('tabindex', '0');
            toast.addEventListener('click', () => this.removeToast(id));
            toast.addEventListener('keydown', (e: KeyboardEvent) => {
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
            if (parent) this._recalculatePositions(parent);
        }, TOAST_TRANSITION_MS);
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
        this.snackbars.set(position, snackbar);
        return snackbar;
    }
}

export const toasts = new Toasts();
