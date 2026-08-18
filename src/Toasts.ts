/*
  Brents-Toasts ("Snackbar System v2")
  Version 1.0
  Under Apache License 2.0
  Brentspine 2026
*/

import { ToastColor, ToastSeverity, type ToastColorPalette, type ToastSeverityValue } from './ToastColor';
import { ToastPosition, IMPLEMENTED_POSITIONS, POSITION_EDGE, collapsedPosition, DEFAULT_RESPONSIVE_BREAKPOINT, type ToastPositionValue } from './ToastPosition';
import { ToastAnimation, getToastAnimation, type ToastAnimationValue, type ToastAnimationDefinition } from './ToastAnimation';
import { ToastLayout, isKnownLayout, type ToastLayoutValue } from './ToastLayout';
import { ToastTransition, getToastTransition, type ToastTransitionValue } from './ToastTransition';
import { createStepButton, type ToastButton, type ToastButtonStep } from './ToastButton';
import { ToastLocales, matchToastLocale, detectBrowserLocales, type ToastTranslations } from './ToastLocale';
import type { ToastTheme } from './ToastTheme';
import { applyColor, applyContent, applyProgress, renderActions, setProgressAriaValue, type ResolvedProgress } from './ToastRender';
import { TOAST_EDGE_OFFSET, recalculatePositions, stackExistingAway, totalStackedExtent, edgeFor } from './ToastStacking';
import toastsCss from './toasts.css';
import VERSION from 'virtual:version';

export type { ToastButton, ToastButtonStep } from './ToastButton';
export type { ToastTranslations } from './ToastLocale';
export type { ToastTheme } from './ToastTheme';

const MAX_TOASTS = 5;

export interface ToastDetailItem {
    /** Optional label shown before the value, e.g. "Status". Rendered as plain text, like `title` - "\n" and literal "<br>"/"<br/>" are still honored as line breaks, same `allowLineBreaks` opt-out. */
    label?: string;
    /** Rendered as plain text, like `title` - "\n" and literal "<br>"/"<br/>" are still honored as line breaks, same `allowLineBreaks` opt-out. */
    value: string;
    /** Extra action buttons rendered after this item's value - e.g. `toasts.detailsCopyButton(item.value)` to opt this item into a "Copy" button. Same shape and click/keyboard behavior as the top-level `buttons` option. */
    buttons?: ToastButton[];
}

export interface ToastProgressOptions {
    /** Which edge of the toast card the bar sits on. Default 'bottom'. */
    position?: 'top' | 'bottom';
    /** Anchor point the bar grows from/shrinks toward. Physical, not
     *  RTL-aware - `left`/`right` always mean the physical edge regardless
     *  of `dir`. Default 'left'. */
    origin?: 'left' | 'right' | 'center';
    /** 'fill': starts empty, grows to full over the toast's remaining
     *  lifetime. 'drain': starts full, shrinks to empty. For `origin:
     *  'center'`, fill grows outward from a zero-width center sliver;
     *  drain shrinks inward from both edges toward the center. 'manual':
     *  the bar doesn't move on its own at all - call `setToastProgress(id,
     *  value)` yourself as real work progresses (e.g. an upload's `progress`
     *  event), instead of a duration guess. Ignores the toast's auto-dismiss
     *  timer entirely, so unlike `'fill'`/`'drain'` it doesn't hide on a
     *  sticky (`duration: 0`) toast. Default 'drain'. */
    mode?: 'fill' | 'drain' | 'manual';
    /** Initial fill fraction (0-1) when `mode: 'manual'`. Ignored for
     *  `'fill'`/`'drain'`. Update it later via `setToastProgress(id,
     *  value)`, not by re-passing `progress` through `updateToast`. Default 0. */
    value?: number;
    /** Fill color. Defaults to this toast's own resolved `color`, and stays
     *  linked to it - changing the toast's `color` later (via
     *  `updateToast`) re-syncs an unset `progress.color` too. */
    color?: string;
    /** Color of the unfilled track. Default `'transparent'` (no visible track). */
    trackColor?: string;
    /** Bar thickness in px. Overlaps toast content if set too large -
     *  keeping it small is the consumer's responsibility, not enforced here. Default 3. */
    height?: number;
    /** Accessible name for the bar (rendered with `role="progressbar"`, plus
     *  `aria-valuemin`/`aria-valuemax`/`aria-valuenow` kept in sync as the
     *  fill changes) - e.g. `"Uploading file"`. Defaults to the resolved
     *  locale's generic "Progress" string; set this when the bar represents
     *  something more specific so screen reader users hear what's actually
     *  progressing, not just a bare percentage. */
    label?: string;
}

export interface ToastOptions {
    /** Semantic severity - the sole driver of accessibility semantics: `'WARNING'`/`'ERROR'` render
     *  `role="alert"`/`aria-live="assertive"`; `'INFO'`/`'SUCCESS'` render `role="status"`/`aria-live="polite"`.
     *  Also picks this toast's default `color` (via `configure()`'s `colors` palette - see `ToastsConfig.colors`)
     *  when `color` itself isn't set, so `severity: ToastSeverity.WARNING` alone gets you both the right look
     *  and the right role for free. Defaults to `ToastSeverity.INFO` or the configured default. */
    severity?: ToastSeverityValue;
    /** Background color of the indicator bar. Purely presentational - has no effect on `role`/`aria-live`,
     *  which come from `severity` alone (see above). Defaults to `configure()`'s `colors[severity]` (see
     *  `ToastsConfig.colors`) unless set here. Passing a custom `color` never changes this toast's
     *  accessibility semantics; set `severity` for that, independently of whatever `color` looks like. */
    color?: string;
    /** Auto-dismiss after ms. Use `0` to disable. Defaults to `3000` or the configured default. A negative or `NaN` value is invalid - warns once and falls back to the configured default. */
    duration?: number;
    /** Whether clicking the toast dismisses it. Also governs keyboard dismissal - a closable
     *  toast's row is focusable (`tabindex="0"`) with `role="button"` and an accessible name,
     *  and can be dismissed with Enter/Space while the row itself is focused, or Escape while
     *  focus is anywhere inside the toast. Defaults to `true` or the configured default. */
    closable?: boolean;
    /** If true, `message` is rendered as HTML. XSS: sanitize input yourself if it may contain user-controlled content. */
    allowHtml?: boolean;
    /** Whether a literal "\n" or "<br>"/"<br/>" in `message`, `title`, button/step labels, and `details` label/value renders as a real line break. Defaults to `true` or the configured default; set `false` to render them as inert text instead - independent of `allowHtml`, which only governs full HTML in `message`. */
    allowLineBreaks?: boolean;
    /** Optional bold title line rendered above the message. Rendered as plain text (never affected by `allowHtml`), except "\n" and literal "<br>"/"<br/>" are still honored as line breaks - same rule as `message`, and same `allowLineBreaks` opt-out. */
    title?: string;
    /** Whether `title` renders on its own line above `message` (`'stacked'`, conceptually `<b>Title</b><br>message`) or as a bold lead-in sharing the message's own line (`'inline'`, `<b>Title</b> message`). No effect when `title` is unset. Defaults to `'stacked'` or the configured default. */
    titleMode?: 'inline' | 'stacked';
    /** See `ToastPosition`. Defaults to `ToastPosition.BOTTOM_CENTER` or the configured default. */
    position?: ToastPositionValue;
    /** See `ToastAnimation`/`docs/guide/animations.md`. `slide` (default), `fade`, `none`, or a name registered via `registerToastAnimation`. */
    animation?: ToastAnimationValue;
    /** Structural "look" - close button position/visibility and other non-color layout differences. See `ToastLayout`/`docs/guide/layouts.md`. `'default'` (today's hover-revealed left accent bar) or `'persistent-close-right'` (always-visible close button pinned to the right), or a name registered via `registerToastLayout`. Independent of `theme` (color) and `titleMode` (title DOM shape) - any combination works. Defaults to `'default'` or the configured default. */
    layout?: ToastLayoutValue;
    /** Called as soon as the toast starts closing (manually or via duration timeout), with `reason` (see `ToastCloseReason`) saying why. A throwing `onClose` is caught and warned about, not propagated - the rest of `removeToast`'s cleanup (timer/animation/DOM removal) always still runs. */
    onClose?: (reason: ToastCloseReason) => void;
    /** If true, dismisses every other currently-visible toast before showing this one. */
    removeOtherToasts?: boolean;
    /** If true, inserts this toast at the far end of its position's stack (away from the anchor edge) instead of nearest it. No-op if passed to `updateToast` - only meaningful at creation time. */
    reverseOrder?: boolean;
    /** Action buttons rendered to the right of the message, vertically centered regardless of whether `title` is present. Styled as plain clickable text, not native-looking buttons, by default. Clicks never trigger `closable` dismissal. */
    buttons?: ToastButton[];
    /** Extra detail lines revealed by an auto-added "Details" toggle button, rendered in a visually distinct block below the message - structurally outside the clickable/dismissable part of the toast. Strings are shorthand for `{ value }`. */
    details?: (string | ToastDetailItem)[];
    /** Label for the auto-added details toggle button. Defaults to `"Details"`. */
    detailsLabel?: string;
    /** Label for the toggle button while details are expanded. Defaults to `"Hide details"`. */
    detailsHideLabel?: string;
    /** Whether hovering the toast, or focusing it or anything inside it (tabbing to its close button, an action button, ...), pauses its auto-dismiss timer, resuming once the mouse leaves and focus has also moved outside the toast entirely. The focus half covers keyboard/screen-reader users, who can't "leave" a toast by moving a mouse. Has no effect on sticky toasts (`duration: 0`) - they have no timer to pause. Defaults to `true` or the configured default. */
    pauseOnHover?: boolean;
    /** Whether the page becoming hidden (tab switched away, window minimized/backgrounded - detected via the
     *  Page Visibility API) pauses this toast's auto-dismiss timer, resuming once the page is visible again.
     *  Independent of `pauseOnHover` - either one pausing is enough to stop the countdown, and (like the
     *  hover/focus pair) both must release before it actually resumes if both are active at once. Has no
     *  effect on sticky toasts (`duration: 0`) - they have no timer to pause. Defaults to `true` or the
     *  configured default. */
    pauseOnPageHidden?: boolean;
    /** Adds a thin progress bar synced to the toast's auto-dismiss countdown via
     *  the same timer state `getToastTimer`/`pauseToastTimer`/etc. use. `true` is
     *  shorthand for all defaults. Falsy/omitted renders no bar at all - opt-in,
     *  doesn't change appearance for existing consumers. No-op for sticky toasts
     *  (`duration: 0`) - same "no timer state = no-op" rule the rest of the
     *  timer system follows. */
    progress?: boolean | ToastProgressOptions;
    /** Arbitrary data to associate with this toast, readable later via `getToastData(id)` - e.g. the item an "Undo" button should restore, so one shared `onClick` can look up what a specific toast represents instead of a new closure per toast. Never rendered or read internally. */
    data?: unknown;
    /** Extra color knobs (background, text, close icon, ...) beyond `color`. Merges key-by-key over `configure()`'s `theme` - only the fields you set here change, the rest still come from the configured default (or the built-in look, if neither sets them). See `ToastTheme`. */
    theme?: ToastTheme;
    /** Only meaningful passed to `updateToast` (directly, or via `promise()`'s `messages`/shared `options`) - animates the whole toast card's transition to the patched content instead of an instant swap, e.g. for a `promise()` loading→success/error transition. `ToastTransition.FADE` (crossfade), `ToastTransition.SHAKE_LR` (shake left-right to draw attention, then apply), or a name registered via `registerToastTransition()`. `ToastTransition.NONE`/omitted applies instantly. No-op passed to `showToast`/`ToastBuilder` - there's nothing to transition from on a toast's first render. */
    transition?: ToastTransitionValue;
}

/**
 * `ToastOptions` plus `promise()`-only knobs - only meaningful passed to `promise()`'s own
 * `options` parameter, not `showToast`/`updateToast`/`ToastBuilder`.
 */
export interface ToastPromiseOptions extends ToastOptions {
    /** Milliseconds to wait for the promise to settle before treating the loading toast as
     *  timed out (see `promise()`). Falls back to `configure()`'s `promiseTimeout`. `0`
     *  disables the timeout - the loading toast waits indefinitely. Default `0`. */
    timeout?: number;
}

export interface ToastsConfig {
    /** Library-wide default `ToastOptions.severity`. Default `ToastSeverity.INFO`. */
    severity: ToastSeverityValue;
    duration: number;
    closable: boolean;
    allowHtml: boolean;
    /** Library-wide default for `ToastOptions.allowLineBreaks`. See there. */
    allowLineBreaks: boolean;
    /** Library-wide default for `ToastOptions.titleMode`. See there. */
    titleMode: 'inline' | 'stacked';
    position: ToastPositionValue;
    /** Viewport width (px) at/below which `*-left`/`*-right` positions collapse into their edge's `*-center` equivalent, so they share one container/stack instead of visually overlapping on narrow (mobile) screens. Re-evaluated live on window resize/orientation-change, moving already-shown toasts into the right container. `0` disables collapsing entirely. Defaults to `800`. See `collapsedPosition`. */
    responsiveBreakpoint: number;
    animation: ToastAnimationValue;
    /** Library-wide default for `ToastOptions.layout`. See there. */
    layout: ToastLayoutValue;
    /** Caps visible toasts per position (see "Capacity and eviction" in `docs/guide/config.md`). A value below `1` is invalid - warns once and falls back to the previous default. */
    maxToasts: number;
    evictOldest: boolean;
    /** Whether hovering/focusing a toast pauses its auto-dismiss timer by default. See `ToastOptions.pauseOnHover`. */
    pauseOnHover: boolean;
    /** Whether the page becoming hidden pauses a toast's auto-dismiss timer by default. See `ToastOptions.pauseOnPageHidden`. */
    pauseOnPageHidden: boolean;
    /** Library-wide default for `ToastOptions.progress`. See there. */
    progress: boolean | ToastProgressOptions;
    /** Force a specific bundled locale (e.g. `"de"`). Omit to auto-detect from `navigator.language`(s), falling back to `"en"` if nothing bundled matches. See `ToastLocales` for the bundled packs. */
    locale?: string;
    /** Partial string overrides layered on top of the resolved locale pack - for unbundled languages, or tweaking individual defaults. */
    translations?: Partial<ToastTranslations>;
    /** Library-wide default for `ToastOptions.theme` - see there and `ToastTheme`. */
    theme?: ToastTheme;
    /** Library-wide default for `promise()`'s `timeout` - see there. `0` disables the timeout. Default `0`. */
    promiseTimeout: number;
    /** The severity → default-`color` lookup: what an unset `ToastOptions.color` resolves to for a given
     *  `severity` (see `ToastOptions.severity`), and what `promise()` defaults `color` to for its
     *  `timeout`/`success`/`error` outcomes. Defaults to the bundled `ToastColor` (`{ INFO, SUCCESS, WARNING,
     *  ERROR }`). Reskinning your palette is just `configure({ colors: { WARNING: '#ffc107', ERROR: '#dc3545' } })`
     *  - accessibility semantics are never affected, since those come from `severity` alone, not from matching
     *  a `color` value against this table. Merges key-by-key over the current value (like `theme` does
     *  per-toast), so a partial override doesn't drop the other severities' colors. */
    colors: ToastColorPalette;
}

/**
 * Why a toast was dismissed - passed to `ToastOptions.onClose` and the `'close'`/`'remove'`
 * lifecycle events (see `ToastEventMap`). `'user'` covers every direct human interaction (row
 * click, Enter/Space on a focused row, Escape while focus is anywhere inside the toast, the
 * built-in close button, a built-in button's own close-on-done step, e.g.
 * `confirmButton({ doneAction: 'close' })`); `'timeout'` is the
 * toast's own `duration` timer expiring; `'evicted'` is `maxToasts`+`evictOldest` removing the
 * oldest toast to make room for a new one; `'promise'` is `promise()` auto-closing its loading
 * toast (including its own `timeout` option elapsing) because no message was configured for
 * that outcome; `'programmatic'` is every other direct `removeToast`/`removeAllToasts` call -
 * the default `removeToast` uses when a reason isn't given explicitly.
 */
export type ToastCloseReason = 'user' | 'timeout' | 'evicted' | 'promise' | 'programmatic';

/**
 * Payload shapes for every `Toasts.on()`/`off()` lifecycle event - see `docs/guide/lifecycle.md`'s
 * "Lifecycle events" section. Every event carries at least `id`, so a shared handler across
 * several toasts (or several event types) can always tell which toast fired it.
 */
export interface ToastEventMap {
    /** A toast was just requested via `showToast()` - fired synchronously before anything is
     *  rendered, regardless of which of the three call shapes (options object, legacy positional,
     *  `ToastBuilder`) was used, and regardless of any other option passed alongside `severity`/
     *  `message`. `message` is always a plain string, even for a `Node` message (reduced to its
     *  `textContent`, `''` if that's `null`) - a stable, easily-asserted-on shape rather than a
     *  live DOM reference. This is the event to use for testing "did my code show a toast", since
     *  its two fields stay the same no matter how `showToast`'s own call shape/internals change
     *  later - point a `vi.fn()`/`jest.fn()` at it instead of spying on `showToast` itself. */
    show: { id: string; severity: ToastSeverityValue; message: string };
    /** The toast's DOM element has just been mounted into its snackbar - after `show`, before the
     *  entrance animation has necessarily finished (see `visible` for that). */
    open: { id: string };
    /** The toast's entrance animation has finished (or, for an animation with no
     *  `enterDurationMs`, fires on the next tick after mounting) - this is "the toast is now
     *  actually on screen", as distinct from `open`'s "the toast now exists in the DOM". */
    visible: { id: string };
    /** `updateToast(id, update)` was just applied - `update` is the exact patch object passed to
     *  it, unmodified. Fired once per `updateToast` call, regardless of which keys `update`
     *  actually set. Not fired for the initial `showToast()` render itself (that's `show`/`open`/
     *  `visible`) - only for a later patch, including the internal `updateToast` calls `promise()`
     *  makes for its success/error/timeout outcomes. */
    update: { id: string; update: ToastUpdateOptions };
    /** The toast started closing - fired at the same moment as `onClose` (before the exit
     *  animation runs, so the element is still in the DOM), with the same `reason` (see
     *  `ToastCloseReason`). This is `onClose` as a subscribable event: use it instead when more
     *  than one independent listener needs to know a toast is dismissing, or when the listener
     *  isn't set up until after the toast that's about to close was already created. */
    close: { id: string; reason: ToastCloseReason };
    /** The toast's DOM element has actually been detached - after `close`'s exit animation
     *  finishes (`exitDurationMs` later), as distinct from `close`'s "started closing". `reason`
     *  is the same one `close` fired with for this toast. Use this over `close` when what matters
     *  is the toast being fully gone (e.g. freeing up something keyed to its slot on screen)
     *  rather than the moment dismissal began. */
    remove: { id: string; reason: ToastCloseReason };
    /** The toast's auto-dismiss timer just paused - manually via `pauseToastTimer(id)`, or via
     *  `pauseOnHover`/`pauseOnPageHidden`. Only fires on a real pause→running transition, never for
     *  an already-paused toast or a sticky one (`duration: 0`, which never has timer state at all -
     *  same "no timer = no-op" rule every other timer method follows). */
    pause: { id: string };
    /** The toast's auto-dismiss timer just resumed - the `resume` counterpart to `pause` above,
     *  with the same "only on a real transition" and "no-op for sticky toasts" rules. */
    resume: { id: string };
}

/** Every event name `Toasts.on()`/`off()` accept - see `ToastEventMap`. */
export type ToastEventName = keyof ToastEventMap;

/** Handler shape for `Toasts.on(event, handler)`/`off(event, handler)` - see `ToastEventMap`. */
export type ToastEventHandler<E extends ToastEventName> = (payload: ToastEventMap[E]) => void;

interface ResolvedToastOptions {
    severity: ToastSeverityValue;
    color: string;
    duration: number;
    closable: boolean;
    allowHtml: boolean;
    allowLineBreaks: boolean;
    position: ToastPositionValue;
    animation: ToastAnimationValue;
    layout: ToastLayoutValue;
    title?: string;
    titleMode: 'inline' | 'stacked';
    onClose?: (reason: ToastCloseReason) => void;
    removeOtherToasts: boolean;
    reverseOrder: boolean;
    buttons?: ToastButton[];
    details?: (string | ToastDetailItem)[];
    detailsLabel?: string;
    detailsHideLabel?: string;
    pauseOnHover: boolean;
    pauseOnPageHidden: boolean;
    progress: boolean | ToastProgressOptions;
    data?: unknown;
    theme?: ToastTheme;
}

/**
 * Patch object for `updateToast(id, update)` - the same shape as `ToastOptions`
 * (so an update reads exactly like a fresh `showToast(message, options)` call),
 * plus `message` since that's normally the separate first positional argument.
 * Only the keys present are applied; `position`/`animation`/`removeOtherToasts`
 * are accepted for shape-compatibility but are no-ops post-creation.
 */
export type ToastUpdateOptions = Partial<ToastOptions> & { message?: string | Node };

// The state `updateToast`/`addToastButton`/etc. read and merge into - the
// only place a toast's currently-effective options are remembered after
// `showToast` returns.
type ToastState = ResolvedToastOptions & { message: string | Node };

/**
 * The library's built-in `ToastsConfig` defaults - what a fresh `Toasts` instance starts with,
 * and what `resetConfig()` reverts `configure()`'s changes back to. Exported (read-only in
 * practice - mutate it and every instance that hasn't overridden the field you touched would
 * see the change) so a consumer can diff against it or read a specific default without
 * constructing a throwaway `Toasts` instance just to inspect `.config`.
 */
export const DEFAULT_CONFIG: ToastsConfig = {
    severity: ToastSeverity.INFO,
    duration: 3000,
    closable: true,
    allowHtml: false,
    allowLineBreaks: true,
    titleMode: 'stacked',
    position: ToastPosition.BOTTOM_CENTER,
    responsiveBreakpoint: DEFAULT_RESPONSIVE_BREAKPOINT,
    animation: ToastAnimation.SLIDE,
    layout: ToastLayout.DEFAULT,
    maxToasts: MAX_TOASTS,
    evictOldest: true,
    pauseOnHover: true,
    pauseOnPageHidden: true,
    progress: false,
    promiseTimeout: 0,
    colors: { ...ToastColor },
};

// Per-toast auto-dismiss timer bookkeeping, keyed off the toast's own root
// element like `_onCloseCallbacks`/`_resizeObservers` below - so state is
// automatically released once the toast is removed from the DOM. Only ever
// created for toasts with `duration > 0`; a sticky toast (`duration: 0`)
// never gets an entry, which is what makes every public timer method below
// a safe no-op for it - pause/resume-on-hover/focus included.
interface ToastTimerState {
    /** The "full" duration `resetToastTimer()` reverts to when called without `newDuration`. */
    duration: number;
    /** Time left, in ms. Authoritative while paused; while running, `startedAt` + this is when it fires. */
    remaining: number;
    /** `Date.now()` when the current countdown segment started, or `null` while paused. */
    startedAt: number | null;
    timeoutId: ReturnType<typeof setTimeout> | null;
}

/** Snapshot returned by `getToastTimer()` - computed fresh on every call, not live-updating. */
export interface ToastTimerInfo {
    /** The full duration `resetToastTimer(id)` (called without `newDuration`) reverts to. */
    duration: number;
    /** Time left until auto-dismiss, in ms, as of this call. */
    remaining: number;
    /** Whether the countdown is currently paused (e.g. via `pauseToastTimer`/hover). */
    paused: boolean;
}

/** Per-position `maxToasts`/`evictOldest` override - see `Toasts.configurePosition()`. */
export type PositionConfig = Partial<Pick<ToastsConfig, 'maxToasts' | 'evictOldest'>>;

// Shared across every `Toasts` instance, not per-instance - same-position
// instances (BOTTOM_CENTER by default) render into one physical snackbar
// (see `_getSnackbar`'s literal `id="snackbar"` reuse), so ownership and
// creation order have to be comparable across instances, not just within
// one, or `removeToast`/eviction can act on a toast in ways the instance
// that actually created it never agreed to (wrong onClose/timer/animation,
// wrong "oldest" pick).
const toastOwners = new WeakMap<HTMLElement, Toasts>();
// Creation order, independent of DOM position - needed because
// `reverseOrder` toasts are prepended rather than appended, so DOM
// position 0 is no longer reliably "the oldest toast" for eviction.
const toastSeq = new WeakMap<HTMLElement, number>();
let seqCounter = 0;

export class Toasts {
    // A single page-wide resize listener (bound once from `_init`, regardless
    // of how many `Toasts` instances exist - hence `static`) re-evaluates
    // every currently-shown toast's container against the current viewport
    // width, so `*-left`/`*-right` toasts already on screen migrate into (or
    // back out of) their edge's `*-center` container as
    // `config.responsiveBreakpoint` is crossed - not just newly-spawned
    // toasts. rAF-coalesced so a drag-resize firing dozens of `resize` events
    // only re-evaluates once per frame. Kept as private statics (rather than
    // module-level) so `_scheduleReconcile` can reach each toast's owning
    // instance's private `_reconcilePosition` - TS `private` is only
    // accessible from code lexically inside the class, which a module-level
    // function isn't.
    private static _resizeListenerBound = false;
    private static _resizeRaf: number | null = null;

    private static _scheduleReconcile(): void {
        if (Toasts._resizeRaf !== null) return;
        Toasts._resizeRaf = requestAnimationFrame(() => {
            Toasts._resizeRaf = null;
            document.querySelectorAll<HTMLElement>('.bt-toast-container').forEach((el) => {
                if (el.classList.contains('bt-hiding')) return;
                toastOwners.get(el)?._reconcilePosition(el);
            });
        });
    }

    // A single page-wide `visibilitychange` listener (bound once from
    // `_init`, regardless of how many `Toasts` instances exist - hence
    // `static`, same reasoning as the resize listener above) tracks whether
    // the page is currently hidden (tab switched away, window
    // minimized/backgrounded) and re-syncs every currently-shown toast's
    // pause state against it - see `pauseOnPageHidden`/`_syncPauseState`.
    private static _visibilityListenerBound = false;
    private static _pageHidden = false;

    private static _handleVisibilityChange(): void {
        Toasts._pageHidden = document.hidden;
        document.querySelectorAll<HTMLElement>('.bt-toast-container').forEach((el) => {
            if (el.classList.contains('bt-hiding')) return;
            toastOwners.get(el)?._syncPauseState(el, el.id);
        });
    }

    public config: ToastsConfig;
    public snackbars: Map<ToastPositionValue, HTMLElement>;
    /** Per-position `maxToasts`/`evictOldest` overrides set via `configurePosition()`. A position absent here (or a key left `undefined` within its entry) falls back to `config`. */
    public positionConfig: Map<ToastPositionValue, PositionConfig>;
    private _initialized: boolean;
    private _root: HTMLElement | null;
    private _warned: Set<string>;
    private _onCloseCallbacks: WeakMap<HTMLElement, (reason: ToastCloseReason) => void>;
    private _resizeObservers: WeakMap<HTMLElement, ResizeObserver>;
    // The animation definition resolved for each toast at creation, so
    // `removeToast` runs the same one's `exit()`/`exitDurationMs` a toast
    // entered with, even if `configure()`'s default has changed since.
    private _toastAnimations: WeakMap<HTMLElement, ToastAnimationDefinition>;
    private _timers: WeakMap<HTMLElement, ToastTimerState>;
    private _progressConfig: WeakMap<HTMLElement, ResolvedProgress>;
    private _data: WeakMap<HTMLElement, unknown>;
    private _toastState: WeakMap<HTMLElement, ToastState>;
    // Raw hover/focus presence, independent of `pauseOnHover` itself -
    // tracked separately from the timer's own paused/running state so
    // `_syncPauseState` can tell whether the *other* trigger is still
    // holding the toast open before actually resuming (e.g. clicking a
    // button focuses it, then the mouse leaves - the timer must stay paused
    // until the button itself loses focus too).
    private _pointerFocusState: WeakMap<HTMLElement, { hovering: boolean; focused: boolean }>;
    // Per-instance, per-event-name listener sets registered via `on()`/`off()` - see
    // `ToastEventMap`. Deliberately instance state (not shared like `toastOwners`/`toastSeq`),
    // same scoping as `config` itself: a page-scoped `new Toasts()`'s listeners only ever see
    // events for toasts it (or a delegating same-position instance, see `_ownerOf`) actually owns.
    // Untyped internally (TS can't relate a generic `E` to this mapped type at the assignment
    // site below) - `on`/`off`/`_emit` are what keep the *public* surface fully typed per event.
    private _listeners: Partial<Record<ToastEventName, Set<ToastEventHandler<ToastEventName>>>>;

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
        this._pointerFocusState = new WeakMap();
        this._listeners = {};
    }

    /**
     * Subscribes `handler` to every `event` fired on this `Toasts` instance (see `ToastEventMap`
     * for the full list and each one's payload/timing) - `'show'`, `'open'`, `'visible'`,
     * `'update'`, `'close'`, `'remove'`, `'pause'`, `'resume'`. Multiple handlers on the same event all run, in
     * registration order, independent of each other (unlike a single `configure()`-style
     * callback, which one `configure()` call would silently replace) - e.g. your app's own
     * analytics and a test's spy can both listen to `'show'` at once without stepping on each
     * other. Returns an unsubscribe function equivalent to calling `off(event, handler)` yourself,
     * for a one-liner `const stop = toasts.on(...)` / `stop()` pattern.
     *
     * Scoped to this instance only, same as `configure()`: a page-scoped `new Toasts()`'s
     * listeners only fire for toasts shown via that instance (or later acted on through it -
     * `updateToast`/`pauseToastTimer`/etc. delegate to whichever instance actually owns a given
     * toast `id`, so the *owning* instance's listeners are the ones that run, same as its
     * `onClose`/timer state would).
     */
    on<E extends ToastEventName>(event: E, handler: ToastEventHandler<E>): () => void {
        let handlers = this._listeners[event];
        if (!handlers) {
            handlers = new Set();
            this._listeners[event] = handlers;
        }
        handlers.add(handler as ToastEventHandler<ToastEventName>);
        return () => this.off(event, handler);
    }

    /** Removes a handler previously registered via `on(event, handler)`. No-op if it isn't (or is no longer) registered. */
    off<E extends ToastEventName>(event: E, handler: ToastEventHandler<E>): void {
        this._listeners[event]?.delete(handler as ToastEventHandler<ToastEventName>);
    }

    // Runs every `on(event, ...)` handler with `payload`, in registration order. A throwing
    // handler is caught and warned about - same "never let a consumer callback break the toast
    // it's reporting on" rule `onClose`/button `onClick`/`promise()` resolvers already follow -
    // and doesn't stop the remaining handlers from still running.
    private _emit<E extends ToastEventName>(event: E, payload: ToastEventMap[E]): void {
        const handlers = this._listeners[event];
        if (!handlers || handlers.size === 0) return;
        for (const handler of handlers) {
            try {
                (handler as ToastEventHandler<E>)(payload);
            } catch (err) {
                console.warn(`[brents-toasts] a "${event}" listener threw:`, err);
            }
        }
    }

    /**
     * Merge library-wide defaults (position, maxToasts, animation, color, ...).
     * Per-call options passed to showToast still take precedence.
     */
    configure(config: Partial<ToastsConfig> = {}): void {
        // `colors` merges key-by-key against the *current* palette (like `theme` does
        // per-toast) rather than a whole-value replace, so `configure({ colors: { WARNING:
        // '#ffc107' } })` only changes WARNING - INFO/SUCCESS/ERROR keep whatever they
        // already resolved to instead of going undefined.
        const colors = config.colors ? { ...this.config.colors, ...config.colors } : undefined;
        this.config = { ...this.config, ...config };
        if (colors) this.config.colors = colors;
        if (!Number.isFinite(this.config.maxToasts) || this.config.maxToasts < 1) {
            this._warnInvalid('maxToasts', this.config.maxToasts, `${MAX_TOASTS}`);
            this.config.maxToasts = MAX_TOASTS;
        }
    }

    /**
     * Overrides `maxToasts`/`evictOldest` for one position only, layered on top of the
     * library-wide defaults from `configure()` - e.g. a small `TOP_RIGHT` notification
     * stack alongside a larger default `BOTTOM_CENTER` one. Merges into any existing
     * override for `position` (same merge behavior as `configure()`); pass a key as
     * `undefined` to drop that key back to the global `config` value.
     */
    configurePosition(position: ToastPositionValue, config: PositionConfig): void {
        if (config.maxToasts !== undefined && (!Number.isFinite(config.maxToasts) || config.maxToasts < 1)) {
            this._warnInvalid('maxToasts', config.maxToasts, 'the global default');
            config = { ...config, maxToasts: undefined };
        }
        this.positionConfig.set(position, { ...this.positionConfig.get(position), ...config });
    }

    /**
     * Reverts every `configure()` change back to the library's built-in defaults (see
     * `DEFAULT_CONFIG`) - the inverse of `configure()`, for e.g. restoring defaults between
     * tests. Only affects `config`; per-position overrides set via `configurePosition()` are
     * untouched (call that again with the fields you want reset, same as `configure()` itself
     * never touches `positionConfig`).
     */
    resetConfig(): void {
        this.config = { ...DEFAULT_CONFIG };
    }

    // Lazy init - sicher für SSR / Node-Umgebungen
    private _init(): void {
        if (this._initialized) return;
        this._initialized = true;
        this._appendStyle();
        if (!Toasts._resizeListenerBound) {
            Toasts._resizeListenerBound = true;
            window.addEventListener('resize', () => Toasts._scheduleReconcile());
        }
        if (!Toasts._visibilityListenerBound) {
            Toasts._visibilityListenerBound = true;
            Toasts._pageHidden = document.hidden;
            document.addEventListener('visibilitychange', () => Toasts._handleVisibilityChange());
        }
    }

    /**
     * @param message The text to display. HTML only if `allowHtml` is true;
     *   otherwise rendered as plain text, except "\n" and literal
     *   "<br>"/"<br/>" are still honored as line breaks unless
     *   `allowLineBreaks` is false (everything else in the string stays
     *   inert text - no other markup is parsed).
     *   Pass a `Node` (e.g. an `HTMLElement`/`DocumentFragment`) instead for
     *   fully custom, interactive content - it's appended directly, so
     *   `allowHtml`/XSS sanitization concerns don't apply to it.
     * @param options Per-toast overrides. See `ToastOptions`.
     * @returns The toast's unique ID (can be used with `removeToast`).
     *
     * Fires `'show'` synchronously (before anything renders), then `'open'` once mounted into the
     * DOM, then `'visible'` once the entrance animation finishes - see `on()`/`ToastEventMap`.
     */
    showToast(message: string | Node, options?: ToastOptions): string;
    /**
     * Legacy positional signature - equivalent to showToast(message, { color, duration, closable, allowHtml }).
     * @param message  The text to display. HTML only if `allowHtml` is true;
     *   otherwise "\n" and literal "<br>"/"<br/>" still render as line breaks.
     *   Pass a `Node` for fully custom content - `allowHtml` is ignored in that case.
     * @param color    Background color of the indicator bar. Defaults to `ToastColor.INFO`. Purely
     *   presentational - this legacy shape has no `severity` parameter, so role/aria-live always
     *   stay at the default (`status`/`polite`) regardless of `color`; use the options-object form
     *   and `ToastOptions.severity` if you need `role="alert"`.
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
        // Generated up front (rather than down where the DOM element is built) purely so `show`
        // can be emitted with a real `id` before anything is rendered - see `ToastEventMap.show`.
        // The `seq` component (shared, monotonically increasing across every `Toasts` instance -
        // see `toastSeq` above) makes a collision impossible outright, rather than merely
        // unlikely - two toasts can never be assigned the same `seq`, regardless of how
        // improbable a random-suffix collision would already be on its own.
        const seq = seqCounter++;
        const id = `toast-${seq}-${Math.random().toString(36).slice(2, 11)}`;
        this._emit('show', { id, severity: opts.severity, message: typeof message === 'string' ? message : (message?.textContent ?? '') });

        if (opts.removeOtherToasts) {
            this.removeAllToasts();
        }

        const position = this._resolvePosition(opts.position);
        const containerPosition = this._effectivePosition(position);
        const animationName = this._resolveAnimation(opts.animation);
        const animationDef = getToastAnimation(animationName)!;
        const snackbar = this._getSnackbar(containerPosition, t);
        const edge = POSITION_EDGE[containerPosition];

        const positionOverride = this.positionConfig.get(containerPosition);
        const maxToasts = positionOverride?.maxToasts ?? this.config.maxToasts;
        const evictOldest = positionOverride?.evictOldest ?? this.config.evictOldest;

        const activeToasts = Array.from(snackbar.children).filter(
            t => !t.classList.contains('bt-hiding')
        );
        if (activeToasts.length >= maxToasts && evictOldest) {
            // Oldest by creation order, not DOM position 0 - a `reverseOrder`
            // toast can be prepended, so DOM position alone no longer
            // reliably identifies the oldest toast.
            let oldest: Element | undefined;
            let oldestSeq = Infinity;
            for (const el of activeToasts) {
                const elSeq = toastSeq.get(el as HTMLElement) ?? -1;
                if (elSeq < oldestSeq) {
                    oldestSeq = elSeq;
                    oldest = el;
                }
            }
            if (oldest) this.removeToast(oldest.id, 'evicted');
        }

        const toastContainer = document.createElement('div');
        toastContainer.className = 'bt-toast-container';
        // `containerTransition` is deliberately NOT assigned here yet - see
        // the `enterFrom`/reflow/transition-assignment sequence below for why.
        toastContainer.id = id;
        this._toastAnimations.set(toastContainer, animationDef);
        toastOwners.set(toastContainer, this);
        toastSeq.set(toastContainer, seq);
        if (opts.onClose) this._onCloseCallbacks.set(toastContainer, opts.onClose);
        if (opts.data !== undefined) this._data.set(toastContainer, opts.data);
        this._toastState.set(toastContainer, { ...opts, message });

        const toast = document.createElement('div');
        toast.className = 'bt-toast';
        toast.dataset.btLayout = this._resolveLayout(opts.layout);

        // Everything that dismisses the toast on click/Enter/Space lives on
        // this row, not on `toast` itself - so the details block below (a
        // sibling of this row, not a descendant) is structurally outside the
        // dismiss listener's reach and can never trigger it.
        const toastRow = document.createElement('div');
        toastRow.className = 'bt-toast-row';
        this._applyClosableAttrs(toastRow, opts.closable, t);

        const toastClose = document.createElement('div');
        toastClose.className = 'bt-toast-close';
        const closeSpan = document.createElement('span');
        closeSpan.innerHTML = '&times;';
        // Purely a visual glyph - the row itself already carries the accessible
        // name/role for the dismiss action (see `_applyClosableAttrs`), so this
        // would otherwise just be redundant, unlabeled noise to a screen reader.
        closeSpan.setAttribute('aria-hidden', 'true');
        toastClose.appendChild(closeSpan);
        applyColor(toastClose, toast, opts.color, opts.severity, opts.theme);

        const toastContent = document.createElement('div');
        toastContent.className = 'bt-toast-content';
        applyContent(toastContent, message, opts);

        toastRow.appendChild(toastClose);
        toastRow.appendChild(toastContent);
        toast.appendChild(toastRow);
        renderActions(toastRow, toast, opts, id, t, (toastId) => this.resetToastTimer(toastId));
        this._setProgressConfig(toastContainer, applyProgress(toast, opts.progress, opts.color, t));
        toastContainer.appendChild(toast);
        // Must run after the append above - `_syncProgressBar` looks up `.bt-toast-progress`
        // via `toastContainer.querySelector`, which can't find it while it's still only a
        // child of the (not yet attached) `toast`. For 'fill'/'drain' this call is still a
        // no-op either way (no `_timers` entry yet → starts hidden, same as the comment used
        // to say), but `mode: 'manual'` doesn't depend on a timer and needs the DOM in place
        // to show immediately.
        this._syncProgressBar(toastContainer);

        // `reverseOrder` toasts are prepended instead of appended - DOM order
        // is what `_recalculatePositions`/`_stackExistingAway` stack away from
        // the anchor edge, so this alone is what makes a reversed toast land
        // at the far end of the stack instead of nearest the edge.
        let targetOffset: number;
        if (opts.reverseOrder) {
            snackbar.insertBefore(toastContainer, snackbar.firstChild);
            // Existing toasts don't need to move - this one is landing
            // beyond all of them, not displacing them from the edge.
            targetOffset = TOAST_EDGE_OFFSET + totalStackedExtent(snackbar, toastContainer);
        } else {
            snackbar.appendChild(toastContainer);
            stackExistingAway(snackbar, toastContainer, animationDef.containerTransition);
            targetOffset = TOAST_EDGE_OFFSET;
        }
        // Mounted into the DOM now, as distinct from `show` (which fired before any rendering) -
        // see `ToastEventMap.open`.
        this._emit('open', { id });

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
        // snap its own committed checkpoint - matching the same
        // freeze-then-reflow-then-transition fix used for the progress bar
        // in `_syncProgressBar` - so that turning the transition on
        // afterwards and changing to `enterTo` on the next frame animates
        // cleanly from this state instead of from the stale one.
        animationDef.enterFrom(animCtx, targetOffset);
        void toastContainer.offsetHeight;
        toastContainer.style.transition = animationDef.containerTransition;
        // Minimal delay so the CSS transition set above actually registers
        // the `enterFrom` frame before `enterTo` changes it.
        requestAnimationFrame(() => {
            animationDef.enterTo(animCtx, targetOffset);
            // `visible` fires once the entrance visual is done, per `enterDurationMs` (0, i.e. next
            // tick, for an animation - built-in `none`, or a custom one - that doesn't set it). The
            // `document.getElementById` guard covers a toast dismissed (click, `removeToast`, a very
            // short `duration`) before its own entrance even finished - no point reporting "visible"
            // for a toast that's already on its way out, or gone.
            const enterDurationMs = animationDef.enterDurationMs ?? 0;
            const fireVisible = () => { if (document.getElementById(id)) this._emit('visible', { id }); };
            if (enterDurationMs > 0) setTimeout(fireVisible, enterDurationMs);
            else fireVisible();
        });

        // Listeners are always attached (not just `if (opts.closable)`/`if
        // (opts.pauseOnHover)`) and read the live flag from `_toastState` at
        // event time - not a value captured here at creation - so `updateToast`
        // can flip `closable`/`pauseOnHover` on an already-rendered toast.
        // `tabindex`/`role`/`aria-label` themselves are set by `_applyClosableAttrs`
        // above (and again on any `updateToast({ closable })`), not here.
        toastRow.addEventListener('click', () => {
            if (this._toastState.get(toastContainer)?.closable) this.removeToast(id, 'user');
        });
        toastRow.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
            if (!this._toastState.get(toastContainer)?.closable) return;
            e.preventDefault();
            this.removeToast(id, 'user');
        });
        // Escape dismisses from anywhere inside the toast (the row itself, an
        // action button, the details toggle, ...) - attached on the container
        // rather than `toastRow` so it fires regardless of which descendant
        // currently has focus, via the same live `closable` read as click/Enter/Space.
        toastContainer.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (!this._toastState.get(toastContainer)?.closable) return;
            e.preventDefault();
            this.removeToast(id, 'user');
        });
        if (opts.duration > 0) {
            this._startToastTimer(toastContainer, opts.duration);
        }
        // No-ops for a sticky toast (`duration: 0`) - there's no timer state
        // for pause/resume to touch, so hovering and un-hovering it can never
        // start one. See `ToastTimerState` above.
        this._pointerFocusState.set(toastContainer, { hovering: false, focused: false });
        toastContainer.addEventListener('mouseenter', () => {
            this._pointerFocusState.get(toastContainer)!.hovering = true;
            this._syncPauseState(toastContainer, id);
        });
        toastContainer.addEventListener('mouseleave', () => {
            this._pointerFocusState.get(toastContainer)!.hovering = false;
            this._syncPauseState(toastContainer, id);
        });
        // `focusin`/`focusout` bubble, so one pair of listeners on the
        // container covers the row and every focusable thing inside it
        // (close button, action buttons, the details toggle). `focusout`
        // only counts as "unfocused" once focus actually leaves the
        // container - checking `relatedTarget` - so tabbing between two
        // buttons in the same toast doesn't briefly resume the timer.
        toastContainer.addEventListener('focusin', () => {
            this._pointerFocusState.get(toastContainer)!.focused = true;
            this._syncPauseState(toastContainer, id);
        });
        toastContainer.addEventListener('focusout', (e: FocusEvent) => {
            if (e.relatedTarget instanceof Node && toastContainer.contains(e.relatedTarget)) return;
            this._pointerFocusState.get(toastContainer)!.focused = false;
            this._syncPauseState(toastContainer, id);
        });
        // Picks up the page's *current* visibility immediately, rather than
        // waiting for the next `visibilitychange` - e.g. a toast spawned by
        // a background task while the tab is already hidden starts paused
        // instead of silently counting down unseen.
        this._syncPauseState(toastContainer, id);

        return id;
    }

    /**
     * Dismisses a toast. `reason` (see `ToastCloseReason`) is passed to `onClose` and the
     * `'close'`/`'remove'` [lifecycle events](docs/guide/lifecycle.md#lifecycle-events) - every
     * internal call site (click, timeout, eviction, `promise()`) passes its own real reason;
     * `'programmatic'` is only the default for a direct call that doesn't specify one.
     */
    removeToast(id: string, reason: ToastCloseReason = 'programmatic'): void {
        const toastContainer = document.getElementById(id);
        if (!toastContainer) return;
        if (toastContainer.classList.contains('bt-hiding')) return;
        // A same-position instance (BOTTOM_CENTER by default) can share a
        // physical snackbar with other Toasts instances, so `id` may belong
        // to a toast this instance never created - delegate to whichever
        // instance actually owns it so its own onClose/timer/animation state
        // (not this instance's, which would simply miss) is what runs.
        const owner = this._ownerOf(toastContainer);
        if (owner !== this) {
            owner.removeToast(id, reason);
            return;
        }
        const parent = toastContainer.parentElement;

        const onClose = this._onCloseCallbacks.get(toastContainer);
        this._onCloseCallbacks.delete(toastContainer);
        if (onClose) {
            try {
                onClose(reason);
            } catch (err) {
                console.warn('[brents-toasts] a toast\'s onClose threw:', err);
            }
        }
        this._emit('close', { id, reason });

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
        // way - see applyOffset in ToastStacking.ts.
        if (parent) recalculatePositions(parent, animationDef.containerTransition);

        setTimeout(() => {
            toastContainer.remove();
            this._resizeObservers.get(toastContainer)?.disconnect();
            this._resizeObservers.delete(toastContainer);
            this._toastAnimations.delete(toastContainer);
            if (parent) recalculatePositions(parent, animationDef.containerTransition);
            this._emit('remove', { id, reason });
        }, animationDef.exitDurationMs);
    }

    /**
     * Updates an already-shown toast in place - same option shape as `showToast`'s
     * `options` (plus `message`, since that's normally the separate first argument),
     * applied as a patch: only the keys present in `update` change, everything else
     * about the toast is left exactly as it was. No-op if `id` doesn't exist.
     *
     * `buttons`/`details`/`theme` are whole-object replacements (unlike the
     * `theme` key-by-key merge `showToast`'s initial resolve does against
     * `configure()`'s default) - see `addToastButton`/`removeToastButton`/
     * `addToastDetail`/`removeToastDetail` for appending or index-based
     * insertion/removal without reconstructing the array yourself.
     * `position`/`animation`/`removeOtherToasts`/`reverseOrder` are accepted for
     * shape-compatibility with `ToastOptions` but don't describe a meaningful
     * post-creation change, so they're no-ops here.
     *
     * Fires the `'update'` event (see `on()`/`ToastEventMap`) once, with `update` unmodified -
     * including for the internal `updateToast` calls `promise()` makes for its success/error/
     * timeout outcomes. Not fired if `id` doesn't exist (nothing was actually updated).
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

        const hasVisualChange =
            'message' in update || 'title' in update || 'titleMode' in update || 'allowHtml' in update || 'allowLineBreaks' in update ||
            'color' in update || 'severity' in update || 'theme' in update || 'progress' in update ||
            'buttons' in update || 'details' in update || 'detailsLabel' in update || 'detailsHideLabel' in update;

        const applyVisuals = () => {
            if ('message' in update || 'title' in update || 'titleMode' in update || 'allowHtml' in update || 'allowLineBreaks' in update) {
                applyContent(toastContent, state.message, state);
            }
            // `severity` alone (no `color` in this patch) still re-derives role/aria-live - the two
            // are independent axes (see `ToastOptions.severity`), so a severity-only update changes
            // meaning without touching the toast's current look, same as a color-only update changes
            // the look without touching meaning.
            if ('color' in update || 'severity' in update || 'theme' in update) applyColor(toastClose, toast, state.color, state.severity, state.theme);
            if ('progress' in update) {
                // An explicit new `progress` config is a real config swap (mode,
                // position, height, ...), so a full rebuild (same as creation)
                // is correct here - including resetting `value` to whatever the
                // new config says.
                this._setProgressConfig(toastContainer, applyProgress(toast, state.progress, state.color, this._getTranslations()));
                this._syncProgressBar(toastContainer);
            } else if ('color' in update) {
                // progress.color defaults to "reuse the toast's own color", so a
                // color-only update still needs to re-sync a bar using that
                // default - but by patching the existing fill's background in
                // place, not by rebuilding the bar's DOM via applyProgress.
                // A rebuild replaces the fill element itself, which would snap
                // any in-flight setToastProgress animation straight to its
                // target instead of animating there (the fresh element starts
                // already at the target value, so the transition _syncProgressBar
                // applies right after has nothing to animate from).
                const cfg = this._progressConfig.get(toastContainer);
                const p = state.progress === true || !state.progress ? undefined : state.progress;
                if (cfg && p?.color === undefined) {
                    cfg.color = state.color;
                    const fill = toastContainer.querySelector<HTMLElement>('.bt-toast-progress-fill');
                    if (fill) fill.style.background = cfg.color;
                }
            }
            if ('buttons' in update || 'details' in update || 'detailsLabel' in update || 'detailsHideLabel' in update || 'allowLineBreaks' in update) {
                renderActions(toastRow, toast, state, id, this._getTranslations(), (toastId) => this.resetToastTimer(toastId));
            }
        };

        if (update.transition && hasVisualChange) {
            const transitionDef = getToastTransition(this._resolveTransition(update.transition))!;
            transitionDef.run(toast, applyVisuals);
        } else {
            applyVisuals();
        }

        if ('data' in update) this.setToastData(id, update.data);
        if ('onClose' in update) {
            if (update.onClose) this._onCloseCallbacks.set(toastContainer, update.onClose);
            else this._onCloseCallbacks.delete(toastContainer);
        }
        if ('closable' in update) {
            this._applyClosableAttrs(toastRow, !!state.closable, this._getTranslations());
        }
        if ('layout' in update) toast.dataset.btLayout = this._resolveLayout(state.layout);
        if ('duration' in update) {
            if (state.duration <= 0) {
                this.removeToastTimer(id);
            } else if (this._timers.get(toastContainer)) {
                this.resetToastTimer(id, state.duration);
            } else {
                this._startToastTimer(toastContainer, state.duration);
            }
        }
        // `pauseOnHover`/`pauseOnPageHidden` need no DOM change - the hover/
        // focus/visibilitychange listeners set up in `showToast`/`_init`
        // already read them live from `_toastState` on every
        // mouseenter/mouseleave/focusin/focusout/visibilitychange, so
        // updating the stored state above is enough.

        this._emit('update', { id, update });
    }

    /**
     * Plays a transition animation on `id`'s toast card in place, without changing any
     * content - e.g. to draw attention back to a toast that's still waiting on the user
     * (a `SHAKE_LR`) independent of any `updateToast` patch. Same named transitions as
     * `ToastOptions.transition`/`updateToast` (`ToastTransition.FADE`, `SHAKE_LR`, or a
     * name registered via `registerToastTransition`) - `NONE` is a no-op, same as
     * `updateToast`. No-op if `id` doesn't exist.
     */
    playToastTransition(id: string, transition: ToastTransitionValue): void {
        const toastContainer = document.getElementById(id);
        if (!toastContainer) return;
        const owner = this._ownerOf(toastContainer);
        if (owner !== this) return owner.playToastTransition(id, transition);
        const toast = toastContainer.querySelector<HTMLElement>('.bt-toast');
        if (!toast) return;
        const transitionDef = getToastTransition(this._resolveTransition(transition))!;
        transitionDef.run(toast, () => {});
    }

    /** Appends (or, with `index`, inserts) one button into `id`'s `buttons` - same as passing a
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

    /** Appends (or, with `index`, inserts) one detail line into `id`'s `details` - same as passing
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
     * hover/focus-to-pause (see `pauseOnHover`) and page-hidden-to-pause (see
     * `pauseOnPageHidden`) are both implemented on top of this - call it yourself for other
     * pause triggers (e.g. while a related modal/dropdown is open).
     * No-op for a sticky toast (`duration: 0`) - it has no timer to pause - and for an
     * already-paused one. Fires the `'pause'` event (see `on()`) on a real pause, but not for
     * either no-op case.
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
        this._emit('pause', { id });
    }

    /**
     * Resumes `id`'s auto-dismiss countdown from wherever `pauseToastTimer` left it. No-op
     * for a sticky toast and for one that isn't currently paused - in particular, hovering and
     * un-hovering a sticky toast never starts a timer on it, since it never had timer state
     * to begin with (see `ToastTimerState`). Fires the `'resume'` event (see `on()`) on a real
     * resume, but not for either no-op case.
     */
    resumeToastTimer(id: string): void {
        const el = document.getElementById(id);
        if (!el) return;
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.resumeToastTimer(id);
        const state = this._timers.get(el);
        if (!state || state.startedAt !== null) return;
        state.startedAt = Date.now();
        state.timeoutId = setTimeout(() => this.removeToast(id, 'timeout'), state.remaining);
        this._syncProgressBar(el);
        this._emit('resume', { id });
    }

    /**
     * Resets `id`'s auto-dismiss countdown back to its full duration - or `newDuration`, if
     * given, which also becomes the new "full" duration for any future `resetToastTimer(id)`
     * call. Restarts the countdown immediately if it's currently running, or just refills the
     * remaining time if it's paused (stays paused until `resumeToastTimer`). No-op for a
     * sticky toast - there's no timer to reset, and this deliberately won't turn a sticky
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
            state.timeoutId = setTimeout(() => this.removeToast(id, 'timeout'), state.remaining);
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
            state.timeoutId = setTimeout(() => this.removeToast(id, 'timeout'), state.remaining);
        }
        this._syncProgressBar(el);
    }

    /**
     * Cancels `id`'s auto-dismiss timer entirely and makes it sticky from now on - same as if
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
     * Reads `id`'s current auto-dismiss countdown as a snapshot - `{ duration, remaining, paused }` -
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
     * Reads back arbitrary data attached to `id` - via `data` at `showToast()`/`ToastBuilder.withData()`
     * time, or a later `setToastData` call. Meant for a single shared `onClick` (e.g. on every "Undo"
     * button, reused across toasts instead of a bespoke closure per toast) to look up what the specific
     * toast it was called on actually represents, using nothing but the `id` that `onClick` already
     * receives. Returns `undefined` if `id` doesn't exist or has no data attached. Purely a bookkeeping
     * convenience for the consumer - never rendered or read internally.
     */
    getToastData<T = unknown>(id: string): T | undefined {
        const el = document.getElementById(id);
        if (!el) return undefined;
        const owner = this._ownerOf(el);
        return owner !== this ? owner.getToastData<T>(id) : (this._data.get(el) as T | undefined);
    }

    /**
     * Attaches (or replaces) arbitrary data on an already-shown toast - the same slot `data` at
     * `showToast()` time fills, for setting or updating it after creation (e.g. once an async step
     * resolves the real payload a button's shared handler should act on).
     *
     * Not a good general-purpose state store: reaching into a specific toast by `id` to mutate its
     * data couples your logic to that one toast surviving on screen, and doesn't compose (nothing
     * stops two callers from clobbering the same toast's data). Prefer owning the data yourself
     * (e.g. in a closure or your app's own state) and only using this for the narrow case this was
     * built for - a payload a shared button handler looks up by the `id` it already receives, like
     * the "Undo" example in `getToastData`.
     */
    setToastData<T>(id: string, data: T): void {
        const el = document.getElementById(id);
        if (!el) return;
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.setToastData(id, data);
        this._data.set(el, data);
    }

    /**
     * Sets a manual progress bar's fill fraction (`0`-`1`, clamped) - only meaningful for a
     * toast whose `progress.mode` is `'manual'` (see `ToastProgressOptions.mode`); a no-op
     * otherwise, or if `id`/its progress bar don't exist. Mutates the stored config and
     * re-syncs the bar directly, without the full DOM rebuild `updateToast(id, { progress })`
     * would do, so it's cheap to call repeatedly from a frequent progress event (e.g. an
     * upload's `progress` handler, or from inside `confirmButton()`'s `onConfirm` - it already
     * receives `id`).
     */
    setToastProgress(id: string, value: number): void {
        const el = document.getElementById(id);
        if (!el) return;
        const owner = this._ownerOf(el);
        if (owner !== this) return owner.setToastProgress(id, value);
        const cfg = this._progressConfig.get(el);
        if (!cfg || cfg.mode !== 'manual') return;
        cfg.value = Math.max(0, Math.min(1, value));
        this._syncProgressBar(el);
    }

    /**
     * A ready-made "Close" action button (for the `buttons` option / `ToastBuilder.withCloseButton()`)
     * that dismisses the toast it's on, wired to this `Toasts` instance's `removeToast`.
     * `label` is a plain parameter rather than a hardcoded string - like `detailsLabel` - so it can be
     * overridden by the caller; defaults to the resolved locale's translation (see `configure()`'s
     * `locale`/`translations`).
     */
    closeButton(label?: string, className?: string): ToastButton {
        return {
            label: label ?? this._getTranslations().close,
            className,
            onClick: (_event, id) => this.removeToast(id, 'user'),
        };
    }

    /**
     * A ready-made "Copy" action button for a `ToastDetailItem.buttons` entry - copies `text` to the
     * clipboard and flashes the button's own label to `copiedLabel` for 2s. Nothing copyable is added
     * automatically; push this into a specific item's `buttons` (or every item's, via `.map()`) to opt
     * that item in, same opt-in pattern as `closeButton()`. No-ops if the Clipboard API is unavailable
     * (e.g. insecure context). `label`/`copiedLabel` are plain parameters, not hardcoded - same
     * locale-defaulting as `closeButton()`'s `label`. Also calls `resetToastTimer(id)` on click, same
     * reasoning as `confirmButton()`'s clicks - the "Copied!" flash shouldn't get cut short by the
     * toast auto-dismissing underneath it. Built on `stepButton()` - see that for the underlying
     * multi-step mechanics.
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
     * A ready-made confirm-before-action button. Rather than relabeling just itself to
     * "Are you sure?", clicking it swaps out the *whole toast's* content: `message`/`color`
     * become `confirmMessage`/`confirmColor` and every button on the toast (this one included)
     * is replaced with a `yesLabel`/`noLabel` pair. Clicking "Yes" runs `onConfirm`; while an
     * async `onConfirm` is pending, either the toast switches to `pendingMessage`/`pendingColor`
     * (buttons cleared), or - if `pendingMessage` isn't set - every action just disables in
     * place, same as before. On success it optionally flashes `doneMessage`/`doneColor` ("Done"
     * by default; pass `doneMessage: null` to skip it) for `doneTimeoutMs`, then either restores
     * the toast's original title/message/buttons/color (`doneAction: 'restore'`, the default) or
     * dismisses the toast entirely (`doneAction: 'close'`) - useful when reverting to the
     * pre-confirm content wouldn't make sense anymore (e.g. after a delete). Clicking "No"
     * restores immediately without running anything - no revert timer needed, since the explicit
     * "No" is the revert. A rejected `onConfirm` always restores (never closes) after logging a
     * warning. Every click also calls `resetToastTimer(id)` - see that method - so the toast's
     * own auto-dismiss timer can't fire out from under the user mid-confirmation; a no-op if the
     * toast is sticky. `onConfirm` still receives the toast's `id`, so a consumer wanting a real
     * progress bar during the pending step (rather than just `pendingMessage` text) can call
     * `setToastProgress(id, value)` themselves as their own async work reports progress - see
     * `ToastProgressOptions.mode: 'manual'`. For flows that don't fit this shape at all, build
     * them directly with `updateToast()`/`stepButton()` instead.
     */
    confirmButton(
        label: string,
        onConfirm: (event: MouseEvent, id: string) => void | Promise<void>,
        options?: {
            confirmMessage?: string;
            confirmColor?: string;
            yesLabel?: string;
            noLabel?: string;
            pendingMessage?: string;
            pendingColor?: string;
            doneMessage?: string | null;
            doneColor?: string;
            doneTimeoutMs?: number;
            doneAction?: 'restore' | 'close';
            className?: string;
        }
    ): ToastButton {
        const t = this._getTranslations();
        const {
            confirmMessage = t.areYouSure,
            confirmColor,
            yesLabel = t.yes,
            noLabel = t.no,
            pendingMessage,
            pendingColor,
            doneMessage = t.done,
            doneColor,
            doneTimeoutMs = 2000,
            doneAction = 'restore',
            className,
        } = options ?? {};

        return {
            label,
            className,
            onClick: (_event, id) => {
                this.resetToastTimer(id);
                const original = this._getState(id);
                if (!original) return;

                const restore = (): void => {
                    this.updateToast(id, {
                        title: original.title,
                        message: original.message,
                        buttons: original.buttons,
                        color: original.color,
                    });
                };
                const settle = (): void => {
                    if (doneAction === 'close') this.removeToast(id, 'user');
                    else restore();
                };

                const yesButton: ToastButton = {
                    label: yesLabel,
                    onClick: (event, confirmId) => {
                        this.resetToastTimer(confirmId);

                        const finish = (): void => {
                            if (doneMessage) {
                                const doneUpdate: ToastUpdateOptions = { message: doneMessage, buttons: [] };
                                if (doneColor !== undefined) doneUpdate.color = doneColor;
                                this.updateToast(confirmId, doneUpdate);
                                setTimeout(settle, doneTimeoutMs);
                            } else {
                                settle();
                            }
                        };
                        const fail = (err: unknown): void => {
                            console.warn('[brents-toasts] confirmButton\'s onConfirm rejected:', err);
                            restore();
                        };

                        let result: void | Promise<void>;
                        try {
                            result = onConfirm(event, confirmId);
                        } catch (err) {
                            fail(err);
                            return;
                        }
                        if (result instanceof Promise) {
                            const pendingUpdate: ToastUpdateOptions = {};
                            if (pendingColor !== undefined) pendingUpdate.color = pendingColor;
                            if (pendingMessage !== undefined) {
                                pendingUpdate.message = pendingMessage;
                                pendingUpdate.buttons = [];
                            }
                            if (Object.keys(pendingUpdate).length > 0) this.updateToast(confirmId, pendingUpdate);
                            if (pendingMessage === undefined) {
                                // Disable every action on the toast (not just this button)
                                // while onConfirm is pending, so "No" can't race a running confirm.
                                (event.currentTarget as HTMLButtonElement).closest<HTMLElement>('.bt-toast-actions')
                                    ?.querySelectorAll('button')
                                    .forEach((b) => { b.disabled = true; });
                            }
                            result.then(finish).catch(fail);
                        } else {
                            finish();
                        }
                    },
                };

                const noButton: ToastButton = {
                    label: noLabel,
                    onClick: (_event, cancelId) => {
                        this.resetToastTimer(cancelId);
                        restore();
                    },
                };

                const confirmUpdate: ToastUpdateOptions = { message: confirmMessage, buttons: [yesButton, noButton] };
                if (confirmColor !== undefined) confirmUpdate.color = confirmColor;
                this.updateToast(id, confirmUpdate);
            },
        };
    }

    /**
     * The general-purpose primitive behind `detailsCopyButton()` - builds a button whose `onClick`
     * walks through `steps` in order (each with its own label, optional `onClick`, and optional
     * auto-revert), for custom multi-step flows (temporary feedback, a guarded action, or anything
     * else with more than one click-driven state) that don't need the whole-toast content swap
     * `confirmButton()` does. See `ToastButtonStep` for the per-step options. Lives on `Toasts` (not
     * a free function) for discoverability/symmetry with `closeButton()`, even though - unlike
     * `closeButton()` - it doesn't need this instance.
     */
    stepButton(steps: ToastButtonStep[], className?: string): ToastButton {
        return createStepButton(steps, className);
    }

    /**
     * Ties a toast to a `Promise`'s lifecycle - shows `messages.loading` right away (forced
     * sticky, `duration: 0`, since there's nothing sensible to auto-dismiss into while the
     * promise is still pending), then patches that same toast to `messages.success`/
     * `messages.error` via `updateToast` once `promise` settles, defaulting the outcome's
     * `severity` to `ToastSeverity.SUCCESS`/`.ERROR` (and its `color` to
     * `config.colors.SUCCESS`/`.ERROR` accordingly - see `ToastsConfig.colors`) unless
     * overridden. Each of
     * `loading`/`success`/`error` is a plain message (`string`/`Node`, shorthand for
     * `{ message }`), a full `ToastUpdateOptions` patch, or - for `success`/`error` - a
     * function of the resolved value/rejection reason returning either, for outcome messages
     * that depend on the result (e.g. echoing the error). Omit `success`/`error` to just
     * dismiss the toast on that outcome instead of showing one. `options` is shared
     * `ToastOptions` applied under the loading toast and both outcomes alike (`position`,
     * `closable`, `theme`, ...); per-state entries in `messages` win over it. Set `transition:
     * ToastTransition.FADE`/`SHAKE_LR` (on `options`, or per-outcome in `messages.success`/
     * `error` - e.g. fade on success but shake on error) to animate the loading→success/error
     * swap instead of an instant jump - see `ToastOptions.transition`.
     *
     * `options.timeout` (falling back to `configure()`'s `promiseTimeout`, default disabled)
     * bounds how long the loading toast is allowed to stay sticky: if `promise` hasn't settled
     * within `timeout` ms, the toast is patched to `messages.timeout` (same shapes as
     * `success`/`error`, but with no resolved value/reason to pass through - just a plain
     * message/patch/thunk) instead, defaulting to `ToastSeverity.WARNING`/`config.colors.WARNING`,
     * or dismissed if
     * `messages.timeout` is omitted. `promise` itself is untouched either way - a timeout only
     * changes what the *toast* shows; if `promise` later settles anyway, that's ignored, since
     * the toast has already moved on. `0`/omitted disables the timeout entirely (the pre-#33
     * behavior - the loading toast waits indefinitely).
     * Returns
     * `promise` itself, unchanged, so it still resolves/rejects and can be `await`ed/chained
     * normally - turning a rejection into an `error` toast here doesn't count as handling it
     * for `promise` itself, so callers still need their own `.catch`/try-catch around it to
     * avoid an unhandled rejection.
     */
    promise<T>(
        promise: Promise<T>,
        messages: {
            loading: string | Node | ToastUpdateOptions;
            success?: string | Node | ToastUpdateOptions | ((data: T) => string | Node | ToastUpdateOptions);
            error?: string | Node | ToastUpdateOptions | ((err: unknown) => string | Node | ToastUpdateOptions);
            timeout?: string | Node | ToastUpdateOptions | (() => string | Node | ToastUpdateOptions);
        },
        options?: ToastPromiseOptions
    ): Promise<T> {
        const loading = this._resolvePromiseMessage<void>(messages.loading);
        const id = this.showToast(loading.message ?? '', { ...options, ...loading, duration: 0 });

        let settled = false;
        const timeoutMs = options?.timeout ?? this.config.promiseTimeout;
        const timeoutId = timeoutMs > 0 ? setTimeout(() => {
            settled = true;
            if (messages.timeout === undefined) { this.removeToast(id, 'promise'); return; }
            const update = this._resolvePromiseMessage(messages.timeout);
            this.updateToast(id, { severity: ToastSeverity.WARNING, color: this.config.colors.WARNING, duration: this.config.duration, ...options, ...update });
        }, timeoutMs) : undefined;

        promise.then(
            (data) => {
                if (settled) return;
                if (timeoutId !== undefined) clearTimeout(timeoutId);
                if (messages.success === undefined) { this.removeToast(id, 'promise'); return; }
                const update = this._resolvePromiseMessage(messages.success, data);
                this.updateToast(id, { severity: ToastSeverity.SUCCESS, color: this.config.colors.SUCCESS, duration: this.config.duration, ...options, ...update });
            },
            (err) => {
                if (settled) return;
                if (timeoutId !== undefined) clearTimeout(timeoutId);
                if (messages.error === undefined) { this.removeToast(id, 'promise'); return; }
                const update = this._resolvePromiseMessage(messages.error, err);
                this.updateToast(id, { severity: ToastSeverity.ERROR, color: this.config.colors.ERROR, duration: this.config.duration, ...options, ...update });
            }
        );

        return promise;
    }

    /**
     * Dismisses every currently visible toast, across all positions/snackbars -
     * each one animates out via `removeToast` rather than vanishing instantly.
     * Queries the DOM directly rather than iterating `this.snackbars`, since a
     * same-position instance (BOTTOM_CENTER by default) may share a physical
     * snackbar this instance never itself created/discovered - `removeToast`
     * still delegates each toast to its real owning instance either way.
     */
    removeAllToasts(): void {
        document.querySelectorAll<HTMLElement>('.bt-snackbar').forEach(snackbar => {
            Array.from(snackbar.children).forEach(child => this.removeToast(child.id));
        });
    }

    // Shared by `promise()` for `loading`/`success`/`error` - each of which accepts a bare
    // message, a full `ToastUpdateOptions` patch, or (for success/error) a function of the
    // settled value/reason. Normalizes all three shapes down to a patch object.
    private _resolvePromiseMessage<T>(
        value: string | Node | ToastUpdateOptions | ((arg: T) => string | Node | ToastUpdateOptions),
        arg?: T
    ): ToastUpdateOptions {
        let resolved: string | Node | ToastUpdateOptions;
        if (typeof value === 'function') {
            try {
                resolved = value(arg as T);
            } catch (err) {
                console.warn('[brents-toasts] a promise() message resolver threw:', err);
                return {};
            }
        } else {
            resolved = value;
        }
        return typeof resolved === 'string' || resolved instanceof Node ? { message: resolved } : resolved;
    }

    private _getState(id: string): ToastState | undefined {
        const el = document.getElementById(id);
        if (!el) return undefined;
        const owner = this._ownerOf(el);
        return owner !== this ? owner._getState(id) : this._toastState.get(el);
    }

    // A same-position instance (BOTTOM_CENTER by default) can share a physical
    // snackbar with other Toasts instances, so any `id` handed to a public
    // method may belong to a toast this instance never created - its state
    // (timers, data, `_toastState`, ...) lives in the owning instance's own
    // WeakMaps, not this one's. Every method that reads/writes per-toast
    // state must resolve the true owner via this and delegate if it isn't
    // `this`, the same way `removeToast` does. Falls back to `this` only for
    // a toast somehow untracked (shouldn't happen - every toast is recorded
    // in `toastOwners` at creation in `showToast`).
    private _ownerOf(el: HTMLElement): Toasts {
        return toastOwners.get(el) ?? this;
    }

    // Stores (or clears) `toastContainer`'s resolved progress config -
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
    // whenever there's no live timer - same "no timer = safe no-op" rule
    // sticky toasts already rely on elsewhere, so it also transparently covers
    // updateToast turning a sticky toast into a timed one later.
    private _syncProgressBar(toastContainer: HTMLElement): void {
        const cfg = this._progressConfig.get(toastContainer);
        if (!cfg) return; // opt-in feature - zero cost for toasts without it

        const wrap = toastContainer.querySelector<HTMLElement>('.bt-toast-progress');
        const fill = wrap?.querySelector<HTMLElement>('.bt-toast-progress-fill');
        if (!wrap || !fill) return;

        if (cfg.mode === 'manual') {
            // Entirely decoupled from `_timers` - never hides for lack of a
            // running countdown (unlike 'fill'/'drain' below), since a manual
            // bar is meant to reflect the consumer's own `setToastProgress`
            // calls even on a sticky (`duration: 0`) toast.
            wrap.style.display = '';
            fill.style.transition = 'transform 150ms linear';
            fill.style.transform = `scaleX(${cfg.value})`;
            setProgressAriaValue(wrap, cfg.value);
            return;
        }

        const timer = this._timers.get(toastContainer);
        if (!timer) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = '';

        const { duration, remaining, startedAt } = timer;
        // duration<=0 guard: resetToastTimer(id, 0) can leave a transient
        // _timers entry with duration 0 (about to fire via setTimeout(...,0)) -
        // treat as "fully elapsed" instead of dividing by zero.
        const elapsedFraction = duration > 0 ? 1 - Math.max(0, Math.min(1, remaining / duration)) : 1;
        const currentScale = cfg.mode === 'fill' ? elapsedFraction : 1 - elapsedFraction;

        fill.style.transition = 'none';
        fill.style.transform = `scaleX(${currentScale})`;
        setProgressAriaValue(wrap, currentScale);

        if (startedAt === null) return; // paused - stays frozen at currentScale

        void fill.offsetWidth; // force a reflow so the frozen frame above actually paints before re-enabling the transition
        const target = cfg.mode === 'fill' ? 1 : 0;
        fill.style.transition = `transform ${Math.max(0, remaining)}ms linear`;
        fill.style.transform = `scaleX(${target})`;
    }

    // Recomputes whether this toast's timer should be paused right now,
    // combining two independent triggers: `pauseOnHover` against the raw
    // hover/focus presence tracked in `_pointerFocusState` (hovering and
    // focusing both feed the same flag), and `pauseOnPageHidden` against
    // the page-wide `Toasts._pageHidden` flag. Either trigger alone is
    // enough to pause. Called on every mouseenter/mouseleave/focusin/
    // focusout/visibilitychange rather than pausing/resuming directly from
    // those handlers, so e.g. a mouse leaving a toast while a button inside
    // it still has keyboard focus (or the page regaining visibility while
    // still hovered) can't resume the timer while another trigger is still
    // active - every active trigger has to release before the countdown
    // actually continues.
    private _syncPauseState(el: HTMLElement, id: string): void {
        const state = this._toastState.get(el);
        const pointer = this._pointerFocusState.get(el);
        if (!state || !pointer) return;
        const shouldPause =
            ((pointer.hovering || pointer.focused) && state.pauseOnHover) ||
            (Toasts._pageHidden && state.pauseOnPageHidden);
        if (shouldPause) this.pauseToastTimer(id);
        else this.resumeToastTimer(id);
    }

    // Only called for `duration > 0` - a sticky toast never gets a `_timers`
    // entry at all, which is what every public pause/resume/reset/extend
    // method above relies on to no-op for it.
    private _startToastTimer(el: HTMLElement, duration: number): void {
        const state: ToastTimerState = { duration, remaining: duration, startedAt: Date.now(), timeoutId: null };
        state.timeoutId = setTimeout(() => this.removeToast(el.id, 'timeout'), duration);
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
            severity: this.config.severity,
            color: this.config.colors[this.config.severity],
            duration: this.config.duration,
            closable: this.config.closable,
            allowHtml: this.config.allowHtml,
            allowLineBreaks: this.config.allowLineBreaks,
            position: this.config.position,
            animation: this.config.animation,
            layout: this.config.layout,
            title: undefined,
            titleMode: this.config.titleMode,
            onClose: undefined,
            removeOtherToasts: false,
            reverseOrder: false,
            buttons: undefined,
            details: undefined,
            detailsLabel: undefined,
            detailsHideLabel: undefined,
            pauseOnHover: this.config.pauseOnHover,
            pauseOnPageHidden: this.config.pauseOnPageHidden,
            progress: this.config.progress,
            data: undefined,
            theme: this.config.theme,
        };

        if (colorOrOptions !== null && typeof colorOrOptions === 'object') {
            const resolved: ResolvedToastOptions = { ...base, ...colorOrOptions };
            // An explicit `severity` with no explicit `color` picks up that
            // severity's default color from the palette - same as `base` above
            // does for the configured default severity - so `{ severity:
            // ToastSeverity.WARNING }` alone gets the right look for free. An
            // explicit `color` always wins outright, regardless of `severity`.
            if (colorOrOptions.severity !== undefined && colorOrOptions.color === undefined) {
                resolved.color = this.config.colors[resolved.severity];
            }
            // Merged key-by-key (unlike every other object-shaped option,
            // e.g. `progress`, which is a whole-value replacement) so a
            // per-toast theme only needs to give the fields it wants to
            // change on top of the configured default.
            if (base.theme || colorOrOptions.theme) {
                resolved.theme = { ...base.theme, ...colorOrOptions.theme };
            }
            return this._validateDuration(resolved);
        }

        // Legacy positional signature has no `severity` parameter - it keeps
        // whatever the configured default severity is, same as it always has.
        if (colorOrOptions !== undefined) base.color = colorOrOptions;
        if (duration !== undefined) base.duration = duration;
        if (closable !== undefined) base.closable = closable;
        if (allowHtml !== undefined) base.allowHtml = allowHtml;
        return this._validateDuration(base);
    }

    // `duration: 0` deliberately means "sticky" - only reject values that can't mean
    // anything (negative, NaN, Infinity), not 0 itself.
    private _validateDuration(opts: ResolvedToastOptions): ResolvedToastOptions {
        if (!Number.isFinite(opts.duration) || opts.duration < 0) {
            this._warnInvalid('duration', opts.duration, `the configured default (${this.config.duration})`);
            opts.duration = this.config.duration;
        }
        return opts;
    }

    private _resolvePosition(position: ToastPositionValue): ToastPositionValue {
        if (IMPLEMENTED_POSITIONS.has(position)) return position;
        this._warnUnimplemented('position', position, ToastPosition.BOTTOM_CENTER);
        return ToastPosition.BOTTOM_CENTER;
    }

    /**
     * Which container a toast with the given identity `position` should
     * actually render into right now - collapsed to the edge's `*-center`
     * equivalent below `config.responsiveBreakpoint`. Never mutates the
     * toast's stored identity `position` (see `_toastState`); only the
     * container/edge/positionConfig lookups in `showToast`/`_reconcilePosition`
     * consume this.
     */
    private _effectivePosition(position: ToastPositionValue): ToastPositionValue {
        const bp = this.config.responsiveBreakpoint;
        if (!bp || window.innerWidth > bp) return position;
        return collapsedPosition(position);
    }

    private _resolveAnimation(animation: ToastAnimationValue): ToastAnimationValue {
        if (getToastAnimation(animation)) return animation;
        this._warnUnimplemented('animation', animation, ToastAnimation.SLIDE);
        return ToastAnimation.SLIDE;
    }

    private _resolveLayout(layout: ToastLayoutValue): ToastLayoutValue {
        if (isKnownLayout(layout)) return layout;
        this._warnUnimplemented('layout', layout, ToastLayout.DEFAULT);
        return ToastLayout.DEFAULT;
    }

    private _resolveTransition(transition: ToastTransitionValue): ToastTransitionValue {
        if (getToastTransition(transition)) return transition;
        this._warnUnimplemented('transition', transition, ToastTransition.FADE);
        return ToastTransition.FADE;
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

    // Shared by showToast (creation) and updateToast's `closable` branch -
    // keeps the row's focusability, its `role`/accessible-name pair, and the
    // `bt-closable` class (which drives the hover/focus-visible CSS in
    // toasts.css) all in sync with each other, so a closable toast is never
    // left focusable-but-unlabeled or labeled-but-unfocusable. `role="button"`
    // plus `aria-label` (reusing the same localized "Close" string a real
    // close-labeled button would use) is what gives the row a programmatically
    // determinable name/role - without it, a screen reader only ever
    // encounters a generic focusable container that happens to act like a
    // button (see #41).
    private _applyClosableAttrs(toastRow: HTMLElement, closable: boolean, t: ToastTranslations): void {
        toastRow.classList.toggle('bt-closable', closable);
        if (closable) {
            toastRow.setAttribute('tabindex', '0');
            toastRow.setAttribute('role', 'button');
            toastRow.setAttribute('aria-label', t.close);
        } else {
            toastRow.removeAttribute('tabindex');
            toastRow.removeAttribute('role');
            toastRow.removeAttribute('aria-label');
        }
    }

    private _warnUnimplemented(kind: string, value: string, fallback: string): void {
        const key = `${kind}:${value}`;
        if (this._warned.has(key)) return;
        this._warned.add(key);
        console.warn(`[brents-toasts] ${kind} "${value}" is not implemented yet, falling back to "${fallback}".`);
    }

    // Same one-time-per-bad-value dedup as _warnUnimplemented, for options that are
    // simply invalid (NaN/negative/etc.) rather than unrecognized enum values.
    private _warnInvalid(kind: string, value: unknown, fallback: string): void {
        const key = `invalid-${kind}:${String(value)}`;
        if (this._warned.has(key)) return;
        this._warned.add(key);
        console.warn(`[brents-toasts] ${kind} "${String(value)}" is invalid, falling back to ${fallback}.`);
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
        if (!document.body) {
            // Most likely a <script> tag calling showToast() synchronously from
            // <head>, before <body> exists yet - a clear, actionable error beats
            // the cryptic null-reference TypeError this would otherwise throw.
            throw new Error('[brents-toasts] document.body is not available yet - call showToast() after the document has a <body> (e.g. from a deferred script, or after DOMContentLoaded).');
        }
        const root = document.createElement('div');
        root.className = 'bt-toasts-root';
        document.body.appendChild(root);
        document.body.insertBefore(document.createComment(`brents-toasts v${VERSION} root container`), root);
        this._root = root;
        return root;
    }

    /**
     * Distinct accessible name per position (e.g. "Notifications, top
     * left") so simultaneously-visible regions at different positions read
     * as separate landmarks to a screen reader instead of several
     * identically-named "Notifications" regions.
     */
    private _snackbarLabel(position: ToastPositionValue, t: ToastTranslations): string {
        return `${t.notificationsRegion}, ${t.positions[position]}`;
    }

    /**
     * Reusing the literal `id="snackbar"` element for BOTTOM_CENTER only is a
     * back-compat hook for pages that already had a `<div id="snackbar">`
     * before position support existed - not a statement about which
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
            cached.setAttribute('aria-label', this._snackbarLabel(position, t));
            return cached;
        }

        const existing = position === ToastPosition.BOTTOM_CENTER
            ? document.getElementById('snackbar')
            : null;
        if (existing) {
            existing.setAttribute('aria-label', this._snackbarLabel(position, t));
            this.snackbars.set(position, existing);
            return existing;
        }

        const snackbar = document.createElement('div');
        snackbar.className = 'bt-snackbar';
        snackbar.dataset.position = position;
        if (position === ToastPosition.BOTTOM_CENTER) snackbar.id = 'snackbar';
        snackbar.setAttribute('role', 'region');
        snackbar.setAttribute('aria-label', this._snackbarLabel(position, t));
        const root = this._getRoot();
        root.appendChild(snackbar);
        root.insertBefore(document.createComment(`brents-toasts v${VERSION} snackbar container`), snackbar);
        this.snackbars.set(position, snackbar);
        return snackbar;
    }

    /**
     * Called for every live toast on window resize (see `scheduleReconcile`)
     * to move it into whichever container `_effectivePosition` currently
     * resolves its identity `position` to, if that's changed since it was
     * shown (or last reconciled). A plain DOM reparent - listeners, WeakMap
     * state, and the per-toast `ResizeObserver` are all keyed off `toastEl`
     * itself, so they survive unchanged across the move. Instant, not
     * animated - acceptable for a resize/rotate edge case.
     */
    private _reconcilePosition(toastEl: HTMLElement): void {
        const state = this._toastState.get(toastEl);
        if (!state) return; // mid-removal - removeToast deletes this first
        const target = this._effectivePosition(state.position);
        const source = toastEl.parentElement;
        if (source?.dataset.position === target) return;
        const targetSnackbar = this._getSnackbar(target, this._getTranslations());
        targetSnackbar.appendChild(toastEl);
        if (source) recalculatePositions(source);
        recalculatePositions(targetSnackbar);
    }
}

export const toasts = new Toasts();
