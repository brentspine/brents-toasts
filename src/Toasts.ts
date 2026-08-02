/*
  Brents-Toasts ("Snackbar System v2")
  Version 1.0
  Under Apache License 2.0
  Brentspine 2026
*/

import { ToastColor } from './ToastColor';
import { ToastPosition, IMPLEMENTED_POSITIONS, POSITION_EDGE, type ToastPositionValue } from './ToastPosition';
import { ToastAnimation, getToastAnimation, type ToastAnimationValue, type ToastAnimationDefinition } from './ToastAnimation';
import { createStepButton, type ToastButton, type ToastButtonStep } from './ToastButton';
import { ToastLocales, matchToastLocale, detectBrowserLocales, type ToastTranslations } from './ToastLocale';
import type { ToastTheme } from './ToastTheme';
import { applyColor, applyContent, applyProgress, renderActions, type ResolvedProgress } from './ToastRender';
import { TOAST_EDGE_OFFSET, recalculatePositions, stackExistingAway, totalStackedExtent, edgeFor } from './ToastStacking';
import toastsCss from './toasts.css';
import VERSION from 'virtual:version';

export type { ToastButton, ToastButtonStep } from './ToastButton';
export type { ToastTranslations } from './ToastLocale';
export type { ToastTheme } from './ToastTheme';

const MAX_TOASTS = 5;

export interface ToastDetailItem {
    /** Optional label shown before the value, e.g. "Status". Rendered as plain text, like `title` — "\n" and literal "<br>"/"<br/>" are still honored as line breaks, same `allowLineBreaks` opt-out. */
    label?: string;
    /** Rendered as plain text, like `title` — "\n" and literal "<br>"/"<br/>" are still honored as line breaks, same `allowLineBreaks` opt-out. */
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
     *  drain shrinks inward from both edges toward the center. Default 'drain'. */
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
    /** Whether a literal "\n" or "<br>"/"<br/>" in `message`, `title`, button/step labels, and `details` label/value renders as a real line break. Defaults to `true` or the configured default; set `false` to render them as inert text instead — independent of `allowHtml`, which only governs full HTML in `message`. */
    allowLineBreaks?: boolean;
    /** Optional bold title line rendered above the message. Rendered as plain text (never affected by `allowHtml`), except "\n" and literal "<br>"/"<br/>" are still honored as line breaks — same rule as `message`, and same `allowLineBreaks` opt-out. */
    title?: string;
    /** See `ToastPosition`. Defaults to `ToastPosition.BOTTOM_CENTER` or the configured default. */
    position?: ToastPositionValue;
    /** See `ToastAnimation`/"Animations" in README.md. `slide` (default), `fade`, `none`, or a name registered via `registerToastAnimation`. */
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
    /** Extra color knobs (background, text, close icon, ...) beyond `color`. Merges key-by-key over `configure()`'s `theme` — only the fields you set here change, the rest still come from the configured default (or the built-in look, if neither sets them). See `ToastTheme`. */
    theme?: ToastTheme;
}

export interface ToastsConfig {
    color: string;
    duration: number;
    closable: boolean;
    allowHtml: boolean;
    /** Library-wide default for `ToastOptions.allowLineBreaks`. See there. */
    allowLineBreaks: boolean;
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
    /** Library-wide default for `ToastOptions.theme` — see there and `ToastTheme`. */
    theme?: ToastTheme;
}

interface ResolvedToastOptions {
    color: string;
    duration: number;
    closable: boolean;
    allowHtml: boolean;
    allowLineBreaks: boolean;
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
    theme?: ToastTheme;
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
    allowLineBreaks: true,
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

// Shared across every `Toasts` instance, not per-instance — same-position
// instances (BOTTOM_CENTER by default) render into one physical snackbar
// (see `_getSnackbar`'s literal `id="snackbar"` reuse), so ownership and
// creation order have to be comparable across instances, not just within
// one, or `removeToast`/eviction can act on a toast in ways the instance
// that actually created it never agreed to (wrong onClose/timer/animation,
// wrong "oldest" pick).
const toastOwners = new WeakMap<HTMLElement, Toasts>();
// Creation order, independent of DOM position — needed because
// `reverseOrder` toasts are prepended rather than appended, so DOM
// position 0 is no longer reliably "the oldest toast" for eviction.
const toastSeq = new WeakMap<HTMLElement, number>();
let seqCounter = 0;

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
    // The animation definition resolved for each toast at creation, so
    // `removeToast` runs the same one's `exit()`/`exitDurationMs` a toast
    // entered with, even if `configure()`'s default has changed since.
    private _toastAnimations: WeakMap<HTMLElement, ToastAnimationDefinition>;
    private _timers: WeakMap<HTMLElement, ToastTimerState>;
    private _progressConfig: WeakMap<HTMLElement, ResolvedProgress>;
    private _data: WeakMap<HTMLElement, unknown>;
    private _toastState: WeakMap<HTMLElement, ToastState>;

    constructor() {
        this._initialized = false;
        this._root = null;
        this.snackbars = new Map();
        this.positionConfig = new Map();
        this.config = { ...DEFAULT_CONFIG };
        this._warned = new Set();
        this._onCloseCallbacks = new WeakMap();
        this._resizeObservers = new WeakMap();
        this._toastAnimations = new WeakMap();
        this._timers = new WeakMap();
        this._progressConfig = new WeakMap();
        this._data = new WeakMap();
        this._toastState = new WeakMap();
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
     * @param message The text to display. HTML only if `allowHtml` is true;
     *   otherwise rendered as plain text, except "\n" and literal
     *   "<br>"/"<br/>" are still honored as line breaks unless
     *   `allowLineBreaks` is false (everything else in the string stays
     *   inert text — no other markup is parsed).
     *   Pass a `Node` (e.g. an `HTMLElement`/`DocumentFragment`) instead for
     *   fully custom, interactive content — it's appended directly, so
     *   `allowHtml`/XSS sanitization concerns don't apply to it.
     * @param options Per-toast overrides. See `ToastOptions`.
     * @returns The toast's unique ID (can be used with `removeToast`).
     */
    showToast(message: string | Node, options?: ToastOptions): string;
    /**
     * Legacy positional signature — equivalent to showToast(message, { color, duration, closable, allowHtml }).
     * @param message  The text to display. HTML only if `allowHtml` is true;
     *   otherwise "\n" and literal "<br>"/"<br/>" still render as line breaks.
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
        const animationName = this._resolveAnimation(opts.animation);
        const animationDef = getToastAnimation(animationName)!;
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
                const seq = toastSeq.get(el as HTMLElement) ?? -1;
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
        // `containerTransition` is deliberately NOT assigned here yet — see
        // the `enterFrom`/reflow/transition-assignment sequence below for why.
        toastContainer.id = id;
        this._toastAnimations.set(toastContainer, animationDef);
        toastOwners.set(toastContainer, this);
        toastSeq.set(toastContainer, seqCounter++);
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
        applyColor(toastClose, toast, opts.color, opts.theme);

        const toastContent = document.createElement('div');
        toastContent.className = 'bt-toast-content';
        applyContent(toastContent, message, opts);

        toastRow.appendChild(toastClose);
        toastRow.appendChild(toastContent);
        toast.appendChild(toastRow);
        renderActions(toastRow, toast, opts, id, t, (toastId) => this.resetToastTimer(toastId));
        this._setProgressConfig(toastContainer, applyProgress(toast, opts.progress, opts.color));
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
            targetOffset = TOAST_EDGE_OFFSET + totalStackedExtent(snackbar, toastContainer);
        } else {
            snackbar.appendChild(toastContainer);
            stackExistingAway(snackbar, toastContainer, animationDef.containerTransition);
            targetOffset = TOAST_EDGE_OFFSET;
        }

        // Any later height change (details toggled open/closed, or a
        // consumer mutating the toast's own content in place) reflows the
        // whole stack, so an expanded toast never overlaps the ones above it.
        const resizeObserver = new ResizeObserver(() => recalculatePositions(snackbar));
        resizeObserver.observe(toast);
        this._resizeObservers.set(toastContainer, resizeObserver);

        const animCtx = { container: toastContainer, edge };
        // No transition is active yet (still the browser default of "none"),
        // so `enterFrom` snaps the container to its hidden state instantly
        // instead of animating from whatever stale default (e.g. opacity's
        // initial value of 1) `stackExistingAway`'s layout reads above
        // already forced the engine to commit. Forcing a reflow makes that
        // snap its own committed checkpoint — matching the same
        // freeze-then-reflow-then-transition fix used for the progress bar
        // in `_syncProgressBar` — so that turning the transition on
        // afterwards and changing to `enterTo` on the next frame animates
        // cleanly from this state instead of from the stale one.
        animationDef.enterFrom(animCtx, targetOffset);
        void toastContainer.offsetHeight;
        toastContainer.style.transition = animationDef.containerTransition;
        // Minimal delay so the CSS transition set above actually registers
        // the `enterFrom` frame before `enterTo` changes it.
        requestAnimationFrame(() => {
            animationDef.enterTo(animCtx, targetOffset);
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
        // A same-position instance (BOTTOM_CENTER by default) can share a
        // physical snackbar with other Toasts instances, so `id` may belong
        // to a toast this instance never created — delegate to whichever
        // instance actually owns it so its own onClose/timer/animation state
        // (not this instance's, which would simply miss) is what runs.
        const owner = this._ownerOf(toastContainer);
        if (owner !== this) {
            owner.removeToast(id);
            return;
        }
        const parent = toastContainer.parentElement;

        const onClose = this._onCloseCallbacks.get(toastContainer);
        this._onCloseCallbacks.delete(toastContainer);
        if (onClose) onClose();

        const timer = this._timers.get(toastContainer);
        if (timer?.timeoutId) clearTimeout(timer.timeoutId);
        this._timers.delete(toastContainer);
        this._syncProgressBar(toastContainer);
        this._toastState.delete(toastContainer);

        const animationDef = this._toastAnimations.get(toastContainer) ?? getToastAnimation(ToastAnimation.SLIDE)!;
        const edge = parent ? edgeFor(parent) : 'bottom';

        toastContainer.classList.add('bt-hiding');
        animationDef.exit({ container: toastContainer, edge });
        // Reposition the remaining toasts now, in parallel with the exit
        // animation, instead of waiting for this one to finish disappearing.
        // The exiting toast is what's causing this reflow, so its own
        // transition (not each sibling's) governs how they move out of the
        // way — see applyOffset in ToastStacking.ts.
        if (parent) recalculatePositions(parent, animationDef.containerTransition);

        setTimeout(() => {
            toastContainer.remove();
            this._resizeObservers.get(toastContainer)?.disconnect();
            this._resizeObservers.delete(toastContainer);
            this._toastAnimations.delete(toastContainer);
            if (parent) recalculatePositions(parent, animationDef.containerTransition);
        }, animationDef.exitDurationMs);
    }

    /**
     * Updates an already-shown toast in place — same option shape as `showToast`'s
     * `options` (plus `message`, since that's normally the separate first argument),
     * applied as a patch: only the keys present in `update` change, everything else
     * about the toast is left exactly as it was. No-op if `id` doesn't exist.
     *
     * `buttons`/`details`/`theme` are whole-object replacements (unlike the
     * `theme` key-by-key merge `showToast`'s initial resolve does against
     * `configure()`'s default) — see `addToastButton`/`removeToastButton`/
     * `addToastDetail`/`removeToastDetail` for appending or index-based
     * insertion/removal without reconstructing the array yourself.
     * `position`/`animation`/`removeOtherToasts`/`reverseOrder` are accepted for
     * shape-compatibility with `ToastOptions` but don't describe a meaningful
     * post-creation change, so they're no-ops here.
     */
    updateToast(id: string, update: ToastUpdateOptions): void {
        const toastContainer = document.getElementById(id);
        if (!toastContainer) return;
        const owner = this._ownerOf(toastContainer);
        if (owner !== this) {
            owner.updateToast(id, update);
            return;
        }
        const prev = this._toastState.get(toastContainer);
        if (!prev) return;

        const toast = toastContainer.querySelector<HTMLElement>('.bt-toast');
        const toastRow = toastContainer.querySelector<HTMLElement>('.bt-toast-row');
        const toastClose = toastContainer.querySelector<HTMLElement>('.bt-toast-close');
        const toastContent = toastContainer.querySelector<HTMLElement>('.bt-toast-content');
        if (!toast || !toastRow || !toastClose || !toastContent) return;

        const state: ToastState = { ...prev, ...update };
        this._toastState.set(toastContainer, state);

        if ('message' in update || 'title' in update || 'allowHtml' in update || 'allowLineBreaks' in update) {
            applyContent(toastContent, state.message, state);
        }
        if ('color' in update || 'theme' in update) applyColor(toastClose, toast, state.color, state.theme);
        if ('progress' in update || 'color' in update) {
            // Reacts to `color` too, not just `progress` — progress.color
            // defaults to "reuse the toast's own color", so changing `color`
            // alone must re-sync a bar that's using that default.
            this._setProgressConfig(toastContainer, applyProgress(toast, state.progress, state.color));
            this._syncProgressBar(toastContainer);
        }
        if ('buttons' in update || 'details' in update || 'detailsLabel' in update || 'detailsHideLabel' in update || 'allowLineBreaks' in update) {
            renderActions(toastRow, toast, state, id, this._getTranslations(), (toastId) => this.resetToastTimer(toastId));
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
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.pauseToastTimer(id);
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
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.resumeToastTimer(id);
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
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.resetToastTimer(id, newDuration);
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
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.extendToastTimer(id, ms);
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
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.removeToastTimer(id);
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
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.getToastTimer(id);
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
        const owner = this._ownerOf(el);
        return owner !== this ? owner.getToastData<T>(id) : (this._data.get(el) as T | undefined);
    }

    /**
     * Attaches (or replaces) arbitrary data on an already-shown toast — the same slot `data` at
     * `showToast()` time fills, for setting or updating it after creation (e.g. once an async step
     * resolves the real payload a button's shared handler should act on).
     */
    setToastData<T>(id: string, data: T): void {
        const el = document.getElementById(id);
        if (!el) return;
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.setToastData(id, data);
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
     * Queries the DOM directly rather than iterating `this.snackbars`, since a
     * same-position instance (BOTTOM_CENTER by default) may share a physical
     * snackbar this instance never itself created/discovered — `removeToast`
     * still delegates each toast to its real owning instance either way.
     */
    removeAllToasts(): void {
        document.querySelectorAll<HTMLElement>('.bt-snackbar').forEach(snackbar => {
            Array.from(snackbar.children).forEach(child => this.removeToast(child.id));
        });
    }

    private _getState(id: string): ToastState | undefined {
        const el = document.getElementById(id);
        if (!el) return undefined;
        const owner = this._ownerOf(el);
        return owner !== this ? owner._getState(id) : this._toastState.get(el);
    }

    // A same-position instance (BOTTOM_CENTER by default) can share a physical
    // snackbar with other Toasts instances, so any `id` handed to a public
    // method may belong to a toast this instance never created — its state
    // (timers, data, `_toastState`, ...) lives in the owning instance's own
    // WeakMaps, not this one's. Every method that reads/writes per-toast
    // state must resolve the true owner via this and delegate if it isn't
    // `this`, the same way `removeToast` does. Falls back to `this` only for
    // a toast somehow untracked (shouldn't happen — every toast is recorded
    // in `toastOwners` at creation in `showToast`).
    private _ownerOf(el: HTMLElement): Toasts {
        return toastOwners.get(el) ?? this;
    }

    // Stores (or clears) `toastContainer`'s resolved progress config —
    // shared by showToast/updateToast right after calling applyProgress(),
    // which returns `undefined` when `progress` is falsy.
    private _setProgressConfig(toastContainer: HTMLElement, cfg: ResolvedProgress | undefined): void {
        if (cfg) this._progressConfig.set(toastContainer, cfg);
        else this._progressConfig.delete(toastContainer);
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
            allowLineBreaks: this.config.allowLineBreaks,
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
            theme: this.config.theme,
        };

        if (colorOrOptions !== null && typeof colorOrOptions === 'object') {
            const resolved: ResolvedToastOptions = { ...base, ...colorOrOptions };
            // Merged key-by-key (unlike every other object-shaped option,
            // e.g. `progress`, which is a whole-value replacement) so a
            // per-toast theme only needs to give the fields it wants to
            // change on top of the configured default.
            if (base.theme || colorOrOptions.theme) {
                resolved.theme = { ...base.theme, ...colorOrOptions.theme };
            }
            return resolved;
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
        if (getToastAnimation(animation)) return animation;
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
