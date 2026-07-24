/*
  Brents-Toasts ("Snackbar System v2")
  Version 1.0
  Under Apache License 2.0
  Brentspine 2026
*/

import { ToastColor } from './ToastColor';
import { ToastPosition, IMPLEMENTED_POSITIONS, POSITION_EDGE, type ToastPositionValue } from './ToastPosition';
import { ToastAnimation, IMPLEMENTED_ANIMATIONS, type ToastAnimationValue } from './ToastAnimation';
import { createActionButton, renderToastButton, createStepButton, type ToastButton, type ToastButtonStep } from './ToastButton';
import { ToastLocales, matchToastLocale, detectBrowserLocales, type ToastTranslations } from './ToastLocale';
import toastsCss from './toasts.css';
import VERSION from 'virtual:version';

export type { ToastButton, ToastButtonStep } from './ToastButton';
export type { ToastTranslations } from './ToastLocale';

const MAX_TOASTS = 5;
const TOAST_GAP = 8;
// Distance from the anchor edge (top or bottom, per POSITION_EDGE) a toast
// rests at once its entrance animation finishes.
const TOAST_EDGE_OFFSET = 22;
const TOAST_TRANSITION_MS = 300;

export interface ToastDetailItem {
    /** Optional label shown before the value, e.g. "Status". */
    label?: string;
    value: string;
    /** Extra action buttons rendered after this item's value — e.g. `toasts.detailsCopyButton(item.value)` to opt this item into a "Copy" button. Same shape and click/keyboard behavior as the top-level `buttons` option. */
    buttons?: ToastButton[];
}

export interface ToastProgressOptions {
    /** Which edge of the toast card the bar sits on. Default 'bottom'. */
    position?: 'top' | 'bottom';
    /** Anchor point the bar grows from/shrinks toward. Physical, not
     *  RTL-aware — `left`/`right` always mean the physical edge regardless
     *  of `dir`. Default 'left'. */
    origin?: 'left' | 'right' | 'center';
    /** 'fill': starts empty, grows to full over the toast's remaining
     *  lifetime. 'drain': starts full, shrinks to empty. For `origin:
     *  'center'`, fill grows outward from a zero-width center sliver;
     *  drain shrinks inward from both edges toward the center. Default 'fill'. */
    mode?: 'fill' | 'drain';
    /** Fill color. Defaults to this toast's own resolved `color`, and stays
     *  linked to it — changing the toast's `color` later (via
     *  `updateToast`) re-syncs an unset `progress.color` too. */
    color?: string;
    /** Color of the unfilled track. Default `'transparent'` (no visible track). */
    trackColor?: string;
    /** Bar thickness in px. Overlaps toast content if set too large —
     *  keeping it small is the consumer's responsibility, not enforced here. Default 3. */
    height?: number;
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
    /** See `ToastPosition`. Defaults to `ToastPosition.BOTTOM_CENTER` or the configured default. */
    position?: ToastPositionValue;
    /** See `ToastAnimation` — only SLIDE is implemented today. */
    animation?: ToastAnimationValue;
    /** Called as soon as the toast starts closing (manually or via duration timeout). */
    onClose?: () => void;
    /** If true, dismisses every other currently-visible toast before showing this one. */
    removeOtherToasts?: boolean;
    /** If true, inserts this toast at the far end of its position's stack (away from the anchor edge) instead of nearest it. No-op if passed to `updateToast` — only meaningful at creation time. */
    reverseOrder?: boolean;
    /** Action buttons rendered to the right of the message, vertically centered regardless of whether `title` is present. Styled as plain clickable text, not native-looking buttons, by default. Clicks never trigger `closable` dismissal. */
    buttons?: ToastButton[];
    /** Extra detail lines revealed by an auto-added "Details" toggle button, rendered in a visually distinct block below the message — structurally outside the clickable/dismissable part of the toast. Strings are shorthand for `{ value }`. */
    details?: (string | ToastDetailItem)[];
    /** Label for the auto-added details toggle button. Defaults to `"Details"`. */
    detailsLabel?: string;
    /** Label for the toggle button while details are expanded. Defaults to `"Hide details"`. */
    detailsHideLabel?: string;
    /** Whether hovering the toast pauses its auto-dismiss timer, resuming from where it left off on mouseleave. Has no effect on sticky toasts (`duration: 0`) — they have no timer to pause. Defaults to `true` or the configured default. */
    pauseOnHover?: boolean;
    /** Adds a thin progress bar synced to the toast's auto-dismiss countdown via
     *  the same timer state `getToastTimer`/`pauseToastTimer`/etc. use. `true` is
     *  shorthand for all defaults. Falsy/omitted renders no bar at all — opt-in,
     *  doesn't change appearance for existing consumers. No-op for sticky toasts
     *  (`duration: 0`) — same "no timer state = no-op" rule the rest of the
     *  timer system follows. */
    progress?: boolean | ToastProgressOptions;
    /** Arbitrary data to associate with this toast, readable later via `getToastData(id)` — e.g. the item an "Undo" button should restore, so one shared `onClick` can look up what a specific toast represents instead of a new closure per toast. Never rendered or read internally. */
    data?: unknown;
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
    /** Whether hovering a toast pauses its auto-dismiss timer by default. See `ToastOptions.pauseOnHover`. */
    pauseOnHover: boolean;
    /** Library-wide default for `ToastOptions.progress`. See there. */
    progress: boolean | ToastProgressOptions;
    /** Force a specific bundled locale (e.g. `"de"`). Omit to auto-detect from `navigator.language`(s), falling back to `"en"` if nothing bundled matches. See `ToastLocales` for the bundled packs. */
    locale?: string;
    /** Partial string overrides layered on top of the resolved locale pack — for unbundled languages, or tweaking individual defaults. */
    translations?: Partial<ToastTranslations>;
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
    reverseOrder: boolean;
    buttons?: ToastButton[];
    details?: (string | ToastDetailItem)[];
    detailsLabel?: string;
    detailsHideLabel?: string;
    pauseOnHover: boolean;
    progress: boolean | ToastProgressOptions;
    data?: unknown;
}

/**
 * Patch object for `updateToast(id, update)` — the same shape as `ToastOptions`
 * (so an update reads exactly like a fresh `showToast(message, options)` call),
 * plus `message` since that's normally the separate first positional argument.
 * Only the keys present are applied; `position`/`animation`/`removeOtherToasts`
 * are accepted for shape-compatibility but are no-ops post-creation.
 */
export type ToastUpdateOptions = Partial<ToastOptions> & { message?: string | Node };

// The state `updateToast`/`addToastButton`/etc. read and merge into — the
// only place a toast's currently-effective options are remembered after
// `showToast` returns.
type ToastState = ResolvedToastOptions & { message: string | Node };

const DEFAULT_CONFIG: ToastsConfig = {
    color: ToastColor.INFO,
    duration: 3000,
    closable: true,
    allowHtml: false,
    position: ToastPosition.BOTTOM_CENTER,
    animation: ToastAnimation.SLIDE,
    maxToasts: MAX_TOASTS,
    evictOldest: true,
    pauseOnHover: true,
    progress: false,
};

// Per-toast auto-dismiss timer bookkeeping, keyed off the toast's own root
// element like `_onCloseCallbacks`/`_resizeObservers` below — so state is
// automatically released once the toast is removed from the DOM. Only ever
// created for toasts with `duration > 0`; a sticky toast (`duration: 0`)
// never gets an entry, which is what makes every public timer method below
// a safe no-op for it — pause/resume-on-hover included.
interface ToastTimerState {
    /** The "full" duration `resetToastTimer()` reverts to when called without `newDuration`. */
    duration: number;
    /** Time left, in ms. Authoritative while paused; while running, `startedAt` + this is when it fires. */
    remaining: number;
    /** `Date.now()` when the current countdown segment started, or `null` while paused. */
    startedAt: number | null;
    timeoutId: ReturnType<typeof setTimeout> | null;
}

// Fully-defaulted internal shape for a toast's progress bar config — not
// exported, mirrors ResolvedToastOptions's role but scoped to just this
// sub-feature. Stored in `_progressConfig`, keyed off the toast's own root
// element like `_data`/`_timers`.
interface ResolvedProgress {
    position: 'top' | 'bottom';
    origin: 'left' | 'right' | 'center';
    mode: 'fill' | 'drain';
    color: string;
    trackColor: string;
    height: number;
}

/** Snapshot returned by `getToastTimer()` — computed fresh on every call, not live-updating. */
export interface ToastTimerInfo {
    /** The full duration `resetToastTimer(id)` (called without `newDuration`) reverts to. */
    duration: number;
    /** Time left until auto-dismiss, in ms, as of this call. */
    remaining: number;
    /** Whether the countdown is currently paused (e.g. via `pauseToastTimer`/hover). */
    paused: boolean;
}

/** Per-position `maxToasts`/`evictOldest` override — see `Toasts.configurePosition()`. */
export type PositionConfig = Partial<Pick<ToastsConfig, 'maxToasts' | 'evictOldest'>>;

export class Toasts {
    public config: ToastsConfig;
    public snackbars: Map<ToastPositionValue, HTMLElement>;
    /** Per-position `maxToasts`/`evictOldest` overrides set via `configurePosition()`. A position absent here (or a key left `undefined` within its entry) falls back to `config`. */
    public positionConfig: Map<ToastPositionValue, PositionConfig>;
    private _initialized: boolean;
    private _root: HTMLElement | null;
    private _warned: Set<string>;
    private _onCloseCallbacks: WeakMap<HTMLElement, () => void>;
    private _resizeObservers: WeakMap<HTMLElement, ResizeObserver>;
    private _timers: WeakMap<HTMLElement, ToastTimerState>;
    private _progressConfig: WeakMap<HTMLElement, ResolvedProgress>;
    private _data: WeakMap<HTMLElement, unknown>;
    private _toastState: WeakMap<HTMLElement, ToastState>;
    // Creation order, independent of DOM position — needed because
    // `reverseOrder` toasts are prepended rather than appended, so DOM
    // position 0 is no longer reliably "the oldest toast" for eviction.
    private _toastSeq: WeakMap<HTMLElement, number>;
    private _seqCounter: number;

    constructor() {
        this._initialized = false;
        this._root = null;
        this.snackbars = new Map();
        this.positionConfig = new Map();
        this.config = { ...DEFAULT_CONFIG };
        this._warned = new Set();
        this._onCloseCallbacks = new WeakMap();
        this._resizeObservers = new WeakMap();
        this._timers = new WeakMap();
        this._progressConfig = new WeakMap();
        this._data = new WeakMap();
        this._toastState = new WeakMap();
        this._toastSeq = new WeakMap();
        this._seqCounter = 0;
    }

    /**
     * Merge library-wide defaults (position, maxToasts, animation, color, ...).
     * Per-call options passed to showToast still take precedence.
     */
    configure(config: Partial<ToastsConfig> = {}): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Overrides `maxToasts`/`evictOldest` for one position only, layered on top of the
     * library-wide defaults from `configure()` — e.g. a small `TOP_RIGHT` notification
     * stack alongside a larger default `BOTTOM_CENTER` one. Merges into any existing
     * override for `position` (same merge behavior as `configure()`); pass a key as
     * `undefined` to drop that key back to the global `config` value.
     */
    configurePosition(position: ToastPositionValue, config: PositionConfig): void {
        this.positionConfig.set(position, { ...this.positionConfig.get(position), ...config });
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
        const t = this._getTranslations();

        if (opts.removeOtherToasts) {
            this.removeAllToasts();
        }

        const position = this._resolvePosition(opts.position);
        this._resolveAnimation(opts.animation);
        const snackbar = this._getSnackbar(position, t);
        const edge = POSITION_EDGE[position];

        const positionOverride = this.positionConfig.get(position);
        const maxToasts = positionOverride?.maxToasts ?? this.config.maxToasts;
        const evictOldest = positionOverride?.evictOldest ?? this.config.evictOldest;

        const activeToasts = Array.from(snackbar.children).filter(
            t => !t.classList.contains('bt-hiding')
        );
        if (activeToasts.length >= maxToasts && evictOldest) {
            // Oldest by creation order, not DOM position 0 — a `reverseOrder`
            // toast can be prepended, so DOM position alone no longer
            // reliably identifies the oldest toast.
            let oldest: Element | undefined;
            let oldestSeq = Infinity;
            for (const el of activeToasts) {
                const seq = this._toastSeq.get(el as HTMLElement) ?? -1;
                if (seq < oldestSeq) {
                    oldestSeq = seq;
                    oldest = el;
                }
            }
            if (oldest) this.removeToast(oldest.id);
        }

        const id = `toast-${Math.random().toString(36).slice(2, 11)}`;

        const toastContainer = document.createElement('div');
        toastContainer.className = 'bt-toast-container';
        toastContainer.style[edge] = '0px';
        toastContainer.style.opacity = '0';
        toastContainer.id = id;
        this._toastSeq.set(toastContainer, this._seqCounter++);
        if (opts.onClose) this._onCloseCallbacks.set(toastContainer, opts.onClose);
        if (opts.data !== undefined) this._data.set(toastContainer, opts.data);
        this._toastState.set(toastContainer, { ...opts, message });

        const toast = document.createElement('div');
        toast.className = 'bt-toast';

        // Everything that dismisses the toast on click/Enter/Space lives on
        // this row, not on `toast` itself — so the details block below (a
        // sibling of this row, not a descendant) is structurally outside the
        // dismiss listener's reach and can never trigger it.
        const toastRow = document.createElement('div');
        toastRow.className = `bt-toast-row${opts.closable ? ' bt-closable' : ''}`;

        const toastClose = document.createElement('div');
        toastClose.className = 'bt-toast-close';
        const closeSpan = document.createElement('span');
        closeSpan.innerHTML = '&times;';
        toastClose.appendChild(closeSpan);
        this._applyColor(toastClose, toast, opts.color);

        const toastContent = document.createElement('div');
        toastContent.className = 'bt-toast-content';
        this._applyContent(toastContent, message, opts);

        toastRow.appendChild(toastClose);
        toastRow.appendChild(toastContent);
        toast.appendChild(toastRow);
        this._renderActions(toastRow, toast, opts, id, t);
        this._applyProgress(toast, toastContainer, opts.progress, opts.color);
        this._syncProgressBar(toastContainer); // no _timers entry yet → starts hidden
        toastContainer.appendChild(toast);

        // `reverseOrder` toasts are prepended instead of appended — DOM order
        // is what `_recalculatePositions`/`_stackExistingAway` stack away from
        // the anchor edge, so this alone is what makes a reversed toast land
        // at the far end of the stack instead of nearest the edge.
        let targetOffset: number;
        if (opts.reverseOrder) {
            snackbar.insertBefore(toastContainer, snackbar.firstChild);
            // Existing toasts don't need to move — this one is landing
            // beyond all of them, not displacing them from the edge.
            targetOffset = TOAST_EDGE_OFFSET + this._totalStackedExtent(snackbar, toastContainer);
        } else {
            snackbar.appendChild(toastContainer);
            this._stackExistingAway(snackbar, toastContainer);
            targetOffset = TOAST_EDGE_OFFSET;
        }

        // Any later height change (details toggled open/closed, or a
        // consumer mutating the toast's own content in place) reflows the
        // whole stack, so an expanded toast never overlaps the ones above it.
        const resizeObserver = new ResizeObserver(() => this._recalculatePositions(snackbar));
        resizeObserver.observe(toast);
        this._resizeObservers.set(toastContainer, resizeObserver);

        // Minimaler Delay damit CSS-Transition greift
        requestAnimationFrame(() => {
            toastContainer.style[edge] = `${targetOffset}px`;
            toastContainer.style.opacity = '1';
        });

        // Listeners are always attached (not just `if (opts.closable)`/`if
        // (opts.pauseOnHover)`) and read the live flag from `_toastState` at
        // event time — not a value captured here at creation — so `updateToast`
        // can flip `closable`/`pauseOnHover` on an already-rendered toast.
        if (opts.closable) toastRow.setAttribute('tabindex', '0');
        toastRow.addEventListener('click', () => {
            if (this._toastState.get(toastContainer)?.closable) this.removeToast(id);
        });
        toastRow.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
            if (!this._toastState.get(toastContainer)?.closable) return;
            e.preventDefault();
            this.removeToast(id);
        });
        if (opts.duration > 0) {
            this._startToastTimer(toastContainer, opts.duration);
        }
        // No-ops for a sticky toast (`duration: 0`) — there's no timer state
        // for pause/resume to touch, so hovering and un-hovering it can never
        // start one. See `ToastTimerState` above.
        toastContainer.addEventListener('mouseenter', () => {
            if (this._toastState.get(toastContainer)?.pauseOnHover) this.pauseToastTimer(id);
        });
        toastContainer.addEventListener('mouseleave', () => {
            if (this._toastState.get(toastContainer)?.pauseOnHover) this.resumeToastTimer(id);
        });

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

        const timer = this._timers.get(toastContainer);
        if (timer?.timeoutId) clearTimeout(timer.timeoutId);
        this._timers.delete(toastContainer);
        this._syncProgressBar(toastContainer);
        this._toastState.delete(toastContainer);

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
     * Updates an already-shown toast in place — same option shape as `showToast`'s
     * `options` (plus `message`, since that's normally the separate first argument),
     * applied as a patch: only the keys present in `update` change, everything else
     * about the toast is left exactly as it was. No-op if `id` doesn't exist.
     *
     * `buttons`/`details` are whole-array replacements — see `addToastButton`/
     * `removeToastButton`/`addToastDetail`/`removeToastDetail` for appending or
     * index-based insertion/removal without reconstructing the array yourself.
     * `position`/`animation`/`removeOtherToasts`/`reverseOrder` are accepted for
     * shape-compatibility with `ToastOptions` but don't describe a meaningful
     * post-creation change, so they're no-ops here.
     */
    updateToast(id: string, update: ToastUpdateOptions): void {
        const toastContainer = document.getElementById(id);
        if (!toastContainer) return;
        const prev = this._toastState.get(toastContainer);
        if (!prev) return;

        const toast = toastContainer.querySelector<HTMLElement>('.bt-toast');
        const toastRow = toastContainer.querySelector<HTMLElement>('.bt-toast-row');
        const toastClose = toastContainer.querySelector<HTMLElement>('.bt-toast-close');
        const toastContent = toastContainer.querySelector<HTMLElement>('.bt-toast-content');
        if (!toast || !toastRow || !toastClose || !toastContent) return;

        const state: ToastState = { ...prev, ...update };
        this._toastState.set(toastContainer, state);

        if ('message' in update || 'title' in update || 'allowHtml' in update) {
            this._applyContent(toastContent, state.message, state);
        }
        if ('color' in update) this._applyColor(toastClose, toast, state.color);
        if ('progress' in update || 'color' in update) {
            // Reacts to `color` too, not just `progress` — progress.color
            // defaults to "reuse the toast's own color", so changing `color`
            // alone must re-sync a bar that's using that default.
            this._applyProgress(toast, toastContainer, state.progress, state.color);
            this._syncProgressBar(toastContainer);
        }
        if ('buttons' in update || 'details' in update || 'detailsLabel' in update || 'detailsHideLabel' in update) {
            this._renderActions(toastRow, toast, state, id, this._getTranslations());
        }
        if ('data' in update) this.setToastData(id, update.data);
        if ('onClose' in update) {
            if (update.onClose) this._onCloseCallbacks.set(toastContainer, update.onClose);
            else this._onCloseCallbacks.delete(toastContainer);
        }
        if ('closable' in update) {
            toastRow.classList.toggle('bt-closable', !!state.closable);
            if (state.closable) toastRow.setAttribute('tabindex', '0');
            else toastRow.removeAttribute('tabindex');
        }
        if ('duration' in update) {
            if (state.duration <= 0) {
                this.removeToastTimer(id);
            } else if (this._timers.get(toastContainer)) {
                this.resetToastTimer(id, state.duration);
            } else {
                this._startToastTimer(toastContainer, state.duration);
            }
        }
        // `pauseOnHover` needs no DOM change — the hover listeners set up in
        // `showToast` already read it live from `_toastState` on every
        // mouseenter/mouseleave, so updating the stored state above is enough.
    }

    /** Appends (or, with `index`, inserts) one button into `id`'s `buttons` — same as passing a
     *  full new array to `updateToast(id, { buttons })`, but without needing the current array. */
    addToastButton(id: string, button: ToastButton, index?: number): void {
        const state = this._getState(id);
        if (!state) return;
        const buttons = state.buttons ? [...state.buttons] : [];
        buttons.splice(index === undefined ? buttons.length : Math.max(0, Math.min(index, buttons.length)), 0, button);
        this.updateToast(id, { buttons });
    }

    /** Removes the button at `index` from `id`'s `buttons`. No-op if `id`/`index` don't exist. */
    removeToastButton(id: string, index: number): void {
        const state = this._getState(id);
        if (!state?.buttons) return;
        const buttons = [...state.buttons];
        buttons.splice(index, 1);
        this.updateToast(id, { buttons });
    }

    /** Appends (or, with `index`, inserts) one detail line into `id`'s `details` — same as passing
     *  a full new array to `updateToast(id, { details })`, but without needing the current array. */
    addToastDetail(id: string, detail: string | ToastDetailItem, index?: number): void {
        const state = this._getState(id);
        if (!state) return;
        const details = state.details ? [...state.details] : [];
        details.splice(index === undefined ? details.length : Math.max(0, Math.min(index, details.length)), 0, detail);
        this.updateToast(id, { details });
    }

    /** Removes the detail line at `index` from `id`'s `details`. No-op if `id`/`index` don't exist. */
    removeToastDetail(id: string, index: number): void {
        const state = this._getState(id);
        if (!state?.details) return;
        const details = [...state.details];
        details.splice(index, 1);
        this.updateToast(id, { details });
    }

    /**
     * Pauses `id`'s auto-dismiss countdown, remembering the time left so a later
     * `resumeToastTimer` continues from where it left off instead of restarting. Built-in
     * hover-to-pause (see `pauseOnHover`) is implemented on top of this — call it yourself
     * for other pause triggers (e.g. while a related modal/dropdown is open). No-op for a
     * sticky toast (`duration: 0`) — it has no timer to pause — and for an already-paused one.
     */
    pauseToastTimer(id: string): void {
        const el = document.getElementById(id);
        if (!el) return;
        const state = this._timers.get(el);
        if (!state || state.startedAt === null) return;
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.remaining = Math.max(0, state.remaining - (Date.now() - state.startedAt));
        state.startedAt = null;
        state.timeoutId = null;
        this._syncProgressBar(el);
    }

    /**
     * Resumes `id`'s auto-dismiss countdown from wherever `pauseToastTimer` left it. No-op
     * for a sticky toast and for one that isn't currently paused — in particular, hovering and
     * un-hovering a sticky toast never starts a timer on it, since it never had timer state
     * to begin with (see `ToastTimerState`).
     */
    resumeToastTimer(id: string): void {
        const el = document.getElementById(id);
        if (!el) return;
        const state = this._timers.get(el);
        if (!state || state.startedAt !== null) return;
        state.startedAt = Date.now();
        state.timeoutId = setTimeout(() => this.removeToast(id), state.remaining);
        this._syncProgressBar(el);
    }

    /**
     * Resets `id`'s auto-dismiss countdown back to its full duration — or `newDuration`, if
     * given, which also becomes the new "full" duration for any future `resetToastTimer(id)`
     * call. Restarts the countdown immediately if it's currently running, or just refills the
     * remaining time if it's paused (stays paused until `resumeToastTimer`). No-op for a
     * sticky toast — there's no timer to reset, and this deliberately won't turn a sticky
     * toast into a timed one; pass `duration` at `showToast()` time for that instead.
     */
    resetToastTimer(id: string, newDuration?: number): void {
        const el = document.getElementById(id);
        if (!el) return;
        const state = this._timers.get(el);
        if (!state) return;
        if (newDuration !== undefined) state.duration = newDuration;
        state.remaining = state.duration;
        if (state.startedAt !== null) {
            if (state.timeoutId) clearTimeout(state.timeoutId);
            state.startedAt = Date.now();
            state.timeoutId = setTimeout(() => this.removeToast(id), state.remaining);
        }
        this._syncProgressBar(el);
    }

    /**
     * Adds `ms` (negative to shrink instead) to `id`'s remaining auto-dismiss time.
     * Rescheduled immediately if the timer's running, or just applied to the stored
     * remaining time if it's paused. No-op for a sticky toast.
     */
    extendToastTimer(id: string, ms: number): void {
        const el = document.getElementById(id);
        if (!el) return;
        const state = this._timers.get(el);
        if (!state) return;
        state.remaining = Math.max(0, state.remaining + ms);
        if (state.startedAt !== null) {
            if (state.timeoutId) clearTimeout(state.timeoutId);
            state.startedAt = Date.now();
            state.timeoutId = setTimeout(() => this.removeToast(id), state.remaining);
        }
        this._syncProgressBar(el);
    }

    /**
     * Cancels `id`'s auto-dismiss timer entirely and makes it sticky from now on — same as if
     * it had been shown with `duration: 0`. Every other timer method becomes a no-op for it
     * afterwards, same as for any sticky toast.
     */
    removeToastTimer(id: string): void {
        const el = document.getElementById(id);
        if (!el) return;
        const state = this._timers.get(el);
        if (!state) return;
        if (state.timeoutId) clearTimeout(state.timeoutId);
        this._timers.delete(el);
        this._syncProgressBar(el);
    }

    /**
     * Reads `id`'s current auto-dismiss countdown as a snapshot — `{ duration, remaining, paused }` —
     * computed fresh from this call, not a live-updating value. Returns `null` if `id` doesn't exist
     * or is sticky (`duration: 0`); there's no countdown to report for either. Useful for surfacing
     * "closes in Ns" to the user, or deciding whether an action still has time to run before the toast
     * disappears on its own.
     */
    getToastTimer(id: string): ToastTimerInfo | null {
        const el = document.getElementById(id);
        if (!el) return null;
        const state = this._timers.get(el);
        if (!state) return null;
        const { startedAt } = state;
        const remaining = startedAt === null ? state.remaining : Math.max(0, state.remaining - (Date.now() - startedAt));
        return { duration: state.duration, remaining, paused: startedAt === null };
    }

    /**
     * Reads back arbitrary data attached to `id` — via `data` at `showToast()`/`ToastBuilder.withData()`
     * time, or a later `setToastData` call. Meant for a single shared `onClick` (e.g. on every "Undo"
     * button, reused across toasts instead of a bespoke closure per toast) to look up what the specific
     * toast it was called on actually represents, using nothing but the `id` that `onClick` already
     * receives. Returns `undefined` if `id` doesn't exist or has no data attached. Purely a bookkeeping
     * convenience for the consumer — never rendered or read internally.
     */
    getToastData<T = unknown>(id: string): T | undefined {
        const el = document.getElementById(id);
        if (!el) return undefined;
        return this._data.get(el) as T | undefined;
    }

    /**
     * Attaches (or replaces) arbitrary data on an already-shown toast — the same slot `data` at
     * `showToast()` time fills, for setting or updating it after creation (e.g. once an async step
     * resolves the real payload a button's shared handler should act on).
     */
    setToastData<T>(id: string, data: T): void {
        const el = document.getElementById(id);
        if (!el) return;
        this._data.set(el, data);
    }

    /**
     * A ready-made "Close" action button (for the `buttons` option / `ToastBuilder.withCloseButton()`)
     * that dismisses the toast it's on, wired to this `Toasts` instance's `removeToast`.
     * `label` is a plain parameter rather than a hardcoded string — like `detailsLabel` — so it can be
     * overridden by the caller; defaults to the resolved locale's translation (see `configure()`'s
     * `locale`/`translations`).
     */
    closeButton(label?: string, className?: string): ToastButton {
        return {
            label: label ?? this._getTranslations().close,
            className,
            onClick: (_event, id) => this.removeToast(id),
        };
    }

    /**
     * A ready-made "Copy" action button for a `ToastDetailItem.buttons` entry — copies `text` to the
     * clipboard and flashes the button's own label to `copiedLabel` for 2s. Nothing copyable is added
     * automatically; push this into a specific item's `buttons` (or every item's, via `.map()`) to opt
     * that item in, same opt-in pattern as `closeButton()`. No-ops if the Clipboard API is unavailable
     * (e.g. insecure context). `label`/`copiedLabel` are plain parameters, not hardcoded — same
     * locale-defaulting as `closeButton()`'s `label`. Also calls `resetToastTimer(id)` on click, same
     * reasoning as `confirmButton()` — the "Copied!" flash shouldn't get cut short by the toast
     * auto-dismissing underneath it. Built on `stepButton()` — see that for the underlying multi-step
     * mechanics.
     */
    detailsCopyButton(text: string, label?: string, copiedLabel?: string, className?: string): ToastButton {
        const t = this._getTranslations();
        return this.stepButton([
            {
                label: label ?? t.copy,
                onClick: (_event, id) => {
                    this.resetToastTimer(id);
                    return !navigator.clipboard ? false : navigator.clipboard.writeText(text);
                },
            },
            { label: copiedLabel ?? t.copied, revertAfterMs: 2000 },
        ], className);
    }

    /**
     * A ready-made confirm-before-action button: shows `label`, then on click advances to `confirmLabel`
     * ("Are you sure?" by default) without running anything yet. A second click runs `onConfirm` (the
     * button is disabled while an async `onConfirm` is pending, so it can't be double-fired), then shows
     * `doneLabel` for `doneTimeoutMs` before reverting back to `label`. If the confirm step is left
     * untouched for `confirmTimeoutMs`, it reverts to `label` on its own without ever running `onConfirm`.
     * Every click also calls `resetToastTimer(id)` — see that method — so the toast's own auto-dismiss
     * timer can't fire out from under the user while they're mid-confirmation; a no-op if the toast is
     * sticky or `pauseOnHover`/duration weren't in play to begin with. Built on `stepButton()` — use
     * that directly for flows with more/different steps.
     */
    confirmButton(
        label: string,
        onConfirm: (event: MouseEvent, id: string) => void | Promise<void>,
        options?: {
            confirmLabel?: string;
            doneLabel?: string;
            className?: string;
            confirmTimeoutMs?: number;
            doneTimeoutMs?: number;
        }
    ): ToastButton {
        const t = this._getTranslations();
        const {
            confirmLabel = t.areYouSure,
            doneLabel = t.done,
            className,
            confirmTimeoutMs = 4000,
            doneTimeoutMs = 2000,
        } = options ?? {};

        return this.stepButton([
            {
                label,
                // step[0]'s onClick isn't for guarding advancement (it always
                // advances) — it exists purely to re-arm the toast's timer the
                // moment the user starts a confirmation, same as the confirm
                // step below.
                onClick: (_event, id) => { this.resetToastTimer(id); },
            },
            {
                label: confirmLabel,
                onClick: (event, id) => {
                    this.resetToastTimer(id);
                    return onConfirm(event, id);
                },
                revertAfterMs: confirmTimeoutMs,
                revertToStep: 0,
            },
            { label: doneLabel, revertAfterMs: doneTimeoutMs, revertToStep: 0 },
        ], className);
    }

    /**
     * The general-purpose primitive behind `confirmButton()`/`detailsCopyButton()` — builds a button
     * whose `onClick` walks through `steps` in order (each with its own label, optional `onClick`, and
     * optional auto-revert), for custom multi-step flows (temporary feedback, confirm-before-action,
     * or anything else with more than one click-driven state). See `ToastButtonStep` for the per-step
     * options. Lives on `Toasts` (not a free function) for discoverability/symmetry with `closeButton()`,
     * even though — unlike `closeButton()` — it doesn't need this instance.
     */
    stepButton(steps: ToastButtonStep[], className?: string): ToastButton {
        return createStepButton(steps, className);
    }

    /**
     * Dismisses every currently visible toast, across all positions/snackbars —
     * each one animates out via `removeToast` rather than vanishing instantly.
     */
    removeAllToasts(): void {
        this.snackbars.forEach(snackbar => {
            Array.from(snackbar.children).forEach(child => this.removeToast(child.id));
        });
    }

    private _getState(id: string): ToastState | undefined {
        const el = document.getElementById(id);
        return el ? this._toastState.get(el) : undefined;
    }

    // Shared by showToast (creation) and updateToast — sets the indicator bar
    // color and the role/aria-live pair it drives, so both paths can never
    // fall out of sync with each other.
    private _applyColor(toastClose: HTMLElement, toast: HTMLElement, color: string): void {
        toastClose.style.setProperty('--data-background', color);
        const isAlert = color === ToastColor.ERROR || color === ToastColor.WARNING;
        toast.setAttribute('role', isAlert ? 'alert' : 'status');
        toast.setAttribute('aria-live', isAlert ? 'assertive' : 'polite');
    }

    // Shared by showToast and updateToast — (re)builds the title/message
    // children of `toastContent` in place, handling title appearing/
    // disappearing between calls.
    private _applyContent(toastContent: HTMLElement, message: string | Node, opts: { title?: string; allowHtml: boolean }): void {
        let toastTitle = toastContent.querySelector<HTMLElement>('.bt-toast-title');
        if (opts.title) {
            if (!toastTitle) {
                toastTitle = document.createElement('div');
                toastTitle.className = 'bt-toast-title';
                toastContent.insertBefore(toastTitle, toastContent.firstChild);
            }
            toastTitle.textContent = opts.title;
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
        if (message instanceof Node) {
            toastMessage.appendChild(message);
        } else if (opts.allowHtml) {
            toastMessage.innerHTML = message;
        } else {
            toastMessage.textContent = message;
        }
    }

    // Shared by showToast and updateToast — fully rebuilds `.bt-toast-progress`
    // from scratch (same full-rebuild-not-diff approach as _renderActions),
    // storing its resolved config in `_progressConfig`. Purely structural —
    // never touches transform/transition; _syncProgressBar (called immediately
    // after, at every call site) owns what value/animation is currently showing.
    private _applyProgress(
        toast: HTMLElement,
        toastContainer: HTMLElement,
        progress: boolean | ToastProgressOptions | undefined,
        toastColor: string
    ): void {
        toast.querySelector('.bt-toast-progress')?.remove();
        this._progressConfig.delete(toastContainer);
        if (!progress) return;

        const p = progress === true ? {} : progress;
        const cfg: ResolvedProgress = {
            position: p.position ?? 'bottom',
            origin: p.origin ?? 'left',
            mode: p.mode ?? 'fill',
            color: p.color ?? toastColor,
            trackColor: p.trackColor ?? 'transparent',
            height: p.height ?? 3,
        };
        this._progressConfig.set(toastContainer, cfg);

        const wrap = document.createElement('div');
        wrap.className = 'bt-toast-progress';
        wrap.dataset.position = cfg.position;
        wrap.style.height = `${cfg.height}px`;
        wrap.style.background = cfg.trackColor;
        wrap.style.display = 'none'; // defensive default; _syncProgressBar (called right after) sets the real value

        const fill = document.createElement('div');
        fill.className = 'bt-toast-progress-fill';
        fill.dataset.origin = cfg.origin;
        fill.style.background = cfg.color;
        fill.style.transition = 'none';
        fill.style.transform = `scaleX(${cfg.mode === 'fill' ? 0 : 1})`;

        wrap.appendChild(fill);
        toast.appendChild(wrap);
    }

    // Shared by showToast and updateToast — fully rebuilds the `.bt-toast-actions`
    // (buttons + details-toggle) and `.bt-toast-details` subtrees from `opts`,
    // rather than diffing against whatever's currently rendered. Toasts are
    // small, so a full rebuild is cheap and keeps this the single place that
    // knows how buttons/details/the toggle button relate to each other.
    private _renderActions(toastRow: HTMLElement, toast: HTMLElement, opts: ResolvedToastOptions, id: string, t: ToastTranslations): void {
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
                ensureActions().appendChild(renderToastButton(btn, id));
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
                    label.textContent = item.label;
                    text.appendChild(label);
                }
                const value = document.createElement('span');
                value.className = 'bt-toast-detail-value';
                value.textContent = item.value;
                text.appendChild(value);
                row.appendChild(text);

                if (item.buttons && item.buttons.length) {
                    item.buttons.forEach((btn) => {
                        row.appendChild(renderToastButton(btn, id, 'bt-toast-detail-action'));
                    });
                }

                detailsEl!.appendChild(row);
            });

            const detailsLabel = opts.detailsLabel ?? t.details;
            const detailsHideLabel = opts.detailsHideLabel ?? t.hideDetails;
            let toggleBtn: HTMLButtonElement;
            toggleBtn = createActionButton(detailsLabel, () => {
                const isOpen = detailsEl!.classList.toggle('bt-open');
                toggleBtn.textContent = isOpen ? detailsHideLabel : detailsLabel;
                toggleBtn.setAttribute('aria-expanded', String(isOpen));
                // Opening details re-arms the toast's timer, same reasoning as
                // confirmButton()/detailsCopyButton() below — a user who just
                // asked to read more shouldn't have it disappear mid-read.
                if (isOpen) this.resetToastTimer(id);
            });
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.setAttribute('aria-controls', detailsEl.id);
            ensureActions().appendChild(toggleBtn);
        }

        if (toastActions) toastRow.appendChild(toastActions);
        if (detailsEl) toast.appendChild(detailsEl);
    }

    // The single place that reconciles the progress bar's visual state with
    // `_timers`'s current duration/remaining/startedAt. Called after every
    // mutation of that state (start/pause/resume/reset/extend/remove) and
    // right after _applyProgress rebuilds the bar. No-op if the toast never
    // opted into `progress`; hides the bar (without discarding its config)
    // whenever there's no live timer — same "no timer = safe no-op" rule
    // sticky toasts already rely on elsewhere, so it also transparently covers
    // updateToast turning a sticky toast into a timed one later.
    private _syncProgressBar(toastContainer: HTMLElement): void {
        const cfg = this._progressConfig.get(toastContainer);
        if (!cfg) return; // opt-in feature — zero cost for toasts without it

        const wrap = toastContainer.querySelector<HTMLElement>('.bt-toast-progress');
        const fill = wrap?.querySelector<HTMLElement>('.bt-toast-progress-fill');
        if (!wrap || !fill) return;

        const timer = this._timers.get(toastContainer);
        if (!timer) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = '';

        const { duration, remaining, startedAt } = timer;
        // duration<=0 guard: resetToastTimer(id, 0) can leave a transient
        // _timers entry with duration 0 (about to fire via setTimeout(...,0)) —
        // treat as "fully elapsed" instead of dividing by zero.
        const elapsedFraction = duration > 0 ? 1 - Math.max(0, Math.min(1, remaining / duration)) : 1;
        const currentScale = cfg.mode === 'fill' ? elapsedFraction : 1 - elapsedFraction;

        fill.style.transition = 'none';
        fill.style.transform = `scaleX(${currentScale})`;

        if (startedAt === null) return; // paused — stays frozen at currentScale

        void fill.offsetWidth; // force a reflow so the frozen frame above actually paints before re-enabling the transition
        const target = cfg.mode === 'fill' ? 1 : 0;
        fill.style.transition = `transform ${Math.max(0, remaining)}ms linear`;
        fill.style.transform = `scaleX(${target})`;
    }

    // Only called for `duration > 0` — a sticky toast never gets a `_timers`
    // entry at all, which is what every public pause/resume/reset/extend
    // method above relies on to no-op for it.
    private _startToastTimer(el: HTMLElement, duration: number): void {
        const state: ToastTimerState = { duration, remaining: duration, startedAt: Date.now(), timeoutId: null };
        state.timeoutId = setTimeout(() => this.removeToast(el.id), duration);
        this._timers.set(el, state);
        this._syncProgressBar(el);
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
            reverseOrder: false,
            buttons: undefined,
            details: undefined,
            detailsLabel: undefined,
            detailsHideLabel: undefined,
            pauseOnHover: this.config.pauseOnHover,
            progress: this.config.progress,
            data: undefined,
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

    private _resolveLocaleKey(): string {
        if (this.config.locale) {
            const match = matchToastLocale(this.config.locale);
            if (match) return match;
            this._warnUnimplemented('locale', this.config.locale, 'en');
            return 'en';
        }
        for (const candidate of detectBrowserLocales()) {
            const match = matchToastLocale(candidate);
            if (match) return match;
        }
        return 'en';
    }

    private _getTranslations(): ToastTranslations {
        const base = ToastLocales[this._resolveLocaleKey()]!;
        return this.config.translations ? { ...base, ...this.config.translations } : base;
    }

    private _warnUnimplemented(kind: string, value: string, fallback: string): void {
        const key = `${kind}:${value}`;
        if (this._warned.has(key)) return;
        this._warned.add(key);
        console.warn(`[brents-toasts] ${kind} "${value}" is not implemented yet, falling back to "${fallback}".`);
    }

    // The snackbar element's own `data-position` (set by _getSnackbar) is the
    // single source of truth for which CSS property ('top' or 'bottom') its
    // toasts stack away from — read it back here instead of threading an
    // `edge` parameter through every stacking call site.
    private _edgeFor(snackbar: HTMLElement): 'top' | 'bottom' {
        return POSITION_EDGE[snackbar.dataset.position as ToastPositionValue] ?? 'bottom';
    }

    // Repositions all remaining toasts nearest-DOM-position-last-first
    // (matching the insertion order established when each toast was added —
    // see the `reverseOrder` branch in `showToast`), using each toast's
    // actual rendered height so variable-height toasts (e.g. with a title)
    // don't overlap their neighbors. Stacks away from the snackbar's anchor
    // edge (top or bottom) — see _edgeFor.
    private _recalculatePositions(snackbar: HTMLElement): void {
        const edge = this._edgeFor(snackbar);
        let offset = TOAST_EDGE_OFFSET;
        Array.from(snackbar.children)
            .filter(el => !el.classList.contains('bt-hiding'))
            .reverse()
            .forEach((el) => {
                const toastEl = el as HTMLElement;
                toastEl.style[edge] = `${offset}px`;
                offset += toastEl.getBoundingClientRect().height + TOAST_GAP;
            });
    }

    // Pushes every toast other than `newToast` away from the snackbar's
    // anchor edge to make room for it, walking DOM order back-to-front by
    // each toast's actual rendered height.
    private _stackExistingAway(snackbar: HTMLElement, newToast: HTMLElement): void {
        const edge = this._edgeFor(snackbar);
        let offset = TOAST_EDGE_OFFSET + newToast.getBoundingClientRect().height + TOAST_GAP;
        Array.from(snackbar.children)
            .filter(el => el !== newToast)
            .reverse()
            .forEach((el) => {
                const toastEl = el as HTMLElement;
                toastEl.style[edge] = `${offset}px`;
                offset += toastEl.getBoundingClientRect().height + TOAST_GAP;
            });
    }

    // Total distance from the anchor edge occupied by every toast other than
    // `excludeEl` — used to land a `reverseOrder` toast beyond all of them,
    // instead of nearest the edge. Mirrors `_stackExistingAway`'s loop (same
    // `.bt-hiding` treatment — a fading-out toast still reserves its space)
    // but sums instead of assigning a per-element offset, since none of the
    // other toasts need to move for this case.
    private _totalStackedExtent(snackbar: HTMLElement, excludeEl: HTMLElement): number {
        let offset = TOAST_EDGE_OFFSET;
        Array.from(snackbar.children)
            .filter(el => el !== excludeEl)
            .forEach((el) => {
                offset += (el as HTMLElement).getBoundingClientRect().height + TOAST_GAP;
            });
        return offset;
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
     * All freshly-created `.bt-snackbar` containers live inside this single
     * `.bt-toasts-root` on `document.body`, instead of each position adding
     * its own top-level sibling to `<body>`.
     */
    private _getRoot(): HTMLElement {
        if (this._root) return this._root;
        const root = document.createElement('div');
        root.className = 'bt-toasts-root';
        document.body.appendChild(root);
        document.body.insertBefore(document.createComment(`brents-toasts v${VERSION} root container`), root);
        this._root = root;
        return root;
    }

    /**
     * Reusing the literal `id="snackbar"` element for BOTTOM_CENTER only is a
     * back-compat hook for pages that already had a `<div id="snackbar">`
     * before position support existed — not a statement about which
     * positions are implemented (see `IMPLEMENTED_POSITIONS` for that). Every
     * other position always gets its own freshly created container, keyed by
     * position in `this.snackbars`.
     */
    private _getSnackbar(position: ToastPositionValue, t: ToastTranslations): HTMLElement {
        const cached = this.snackbars.get(position);
        if (cached) {
            // Refreshed on every call (not just at creation) so a later
            // configure({ locale }) updates an already-rendered snackbar's
            // accessible name, not just newly-created ones.
            cached.setAttribute('aria-label', t.notificationsRegion);
            return cached;
        }

        const existing = position === ToastPosition.BOTTOM_CENTER
            ? document.getElementById('snackbar')
            : null;
        if (existing) {
            existing.setAttribute('aria-label', t.notificationsRegion);
            this.snackbars.set(position, existing);
            return existing;
        }

        const snackbar = document.createElement('div');
        snackbar.className = 'bt-snackbar';
        snackbar.dataset.position = position;
        if (position === ToastPosition.BOTTOM_CENTER) snackbar.id = 'snackbar';
        snackbar.setAttribute('role', 'region');
        snackbar.setAttribute('aria-label', t.notificationsRegion);
        const root = this._getRoot();
        root.appendChild(snackbar);
        root.insertBefore(document.createComment(`brents-toasts v${VERSION} snackbar container`), snackbar);
        this.snackbars.set(position, snackbar);
        return snackbar;
    }
}

export const toasts = new Toasts();
