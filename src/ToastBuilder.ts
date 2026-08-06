import { toasts as defaultToasts, Toasts, type ToastOptions, type ToastDetailItem, type ToastButtonStep, type ToastProgressOptions } from './Toasts';
import { ToastColor } from './ToastColor';
import type { ToastTheme } from './ToastTheme';
import type { ToastPositionValue } from './ToastPosition';
import type { ToastAnimationValue } from './ToastAnimation';
import { ToastTransition, type ToastTransitionValue } from './ToastTransition';

/*
  Fluent alternative to showToast(message, options). Builds the exact same
  options object showToast() accepts, then hands it off - so builder-created
  toasts and directly-called showToast(message, { ... }) toasts always behave
  identically.
*/
export class ToastBuilder {
    private _toasts: Toasts;
    private _message: string | Node;
    private _options: ToastOptions;

    /** @param message Defaults to `''` - omit it entirely for a title-only toast (see `withTitle()`). */
    constructor(message: string | Node = '', toastsInstance: Toasts = defaultToasts) {
        this._toasts = toastsInstance;
        this._message = message;
        this._options = {};
    }

    /** @param mode Whether `title` stacks above `message` or shares its line as a bold lead-in. Leaves the configured default (`configure()`'s `titleMode`) in place if omitted. See `ToastOptions.titleMode`. Equivalent to passing the same value to `withTitleMode()`. */
    withTitle(title: string, mode?: 'inline' | 'stacked'): this {
        this._options.title = title;
        if (mode !== undefined) this._options.titleMode = mode;
        return this;
    }
    /** Standalone alternative to `withTitle(title, mode)`'s second argument - set independently since `title` may already be set elsewhere in the chain. No effect when `title` is unset. See `ToastOptions.titleMode`. */
    withTitleMode(mode: 'inline' | 'stacked'): this {
        this._options.titleMode = mode;
        return this;
    }
    withColor(color: string): this { this._options.color = color; return this; }
    asInfo(): this { return this.withColor(ToastColor.INFO); }
    asSuccess(): this { return this.withColor(ToastColor.SUCCESS); }
    asWarning(): this { return this.withColor(ToastColor.WARNING); }
    asError(): this { return this.withColor(ToastColor.ERROR); }
    withDuration(durationMs: number): this { this._options.duration = durationMs; return this; }
    /** Called with no argument, enables closability (`true`) - the library-wide default stays whatever `configure()` says unless you call this. */
    withClosable(closable: boolean = true): this { this._options.closable = closable; return this; }
    /** Called with no argument, enables HTML rendering (`true`) - the library-wide/`ToastOptions` default stays `false` unless you call this. XSS: sanitize input yourself if it may contain user-controlled content. */
    withAllowHtml(allowHtml: boolean = true): this { this._options.allowHtml = allowHtml; return this; }
    /** Whether "\n"/"<br>" render as real line breaks in `message`, `title`, button labels, and `details`. Called with no argument, enables it (`true`) - see `ToastOptions.allowLineBreaks`. */
    withAllowLineBreaks(allowLineBreaks: boolean = true): this { this._options.allowLineBreaks = allowLineBreaks; return this; }
    withPosition(position: ToastPositionValue): this { this._options.position = position; return this; }
    withAnimation(animation: ToastAnimationValue): this { this._options.animation = animation; return this; }
    withOnClose(onClose: () => void): this { this._options.onClose = onClose; return this; }
    /** Whether hovering or focusing this toast pauses its auto-dismiss timer. Called with no argument, enables it (`true`). See `ToastOptions.pauseOnHover`. */
    withPauseOnHover(pauseOnHover: boolean = true): this { this._options.pauseOnHover = pauseOnHover; return this; }
    /** Adds a thin progress bar synced to the toast's auto-dismiss countdown.
     *  See `ToastOptions.progress`/`ToastProgressOptions`. */
    withProgress(progress: boolean | ToastProgressOptions = true): this { this._options.progress = progress; return this; }
    /** Arbitrary data readable later via `getToastData(id)`. See `ToastOptions.data`. */
    withData(data: unknown): this { this._options.data = data; return this; }
    /** Extra color knobs beyond `withColor()` - merges key-by-key over `configure()`'s `theme` at `.show()` time. See `ToastOptions.theme`/`ToastTheme`. */
    withTheme(theme: ToastTheme): this { this._options.theme = theme; return this; }
    /** No-op via `.show()` - there's nothing to transition from on a toast's first render, so this only takes effect if the built options object later reaches `updateToast`/`promise()` some other way. Included for shape-compatibility with `ToastOptions`. See `ToastOptions.transition`. */
    withTransition(transition: ToastTransitionValue = ToastTransition.FADE): this { this._options.transition = transition; return this; }
    andRemoveOtherToasts(): this { this._options.removeOtherToasts = true; return this; }
    /** Inserts this toast at the far end of its position's stack instead of nearest the anchor edge. See `ToastOptions.reverseOrder`. */
    andReverseOrder(): this { this._options.reverseOrder = true; return this; }
    /** Adds one action button (repeatable - call multiple times for multiple buttons). */
    withButton(label: string, onClick?: (event: MouseEvent, id: string) => void, className?: string): this {
        if (!this._options.buttons) this._options.buttons = [];
        this._options.buttons.push({ label, onClick, className });
        return this;
    }
    /** Adds an auto-toggled "Details" block. See `ToastOptions.details`. */
    withDetails(details: (string | ToastDetailItem)[], detailsLabel?: string, detailsHideLabel?: string): this {
        this._options.details = details;
        if (detailsLabel !== undefined) this._options.detailsLabel = detailsLabel;
        if (detailsHideLabel !== undefined) this._options.detailsHideLabel = detailsHideLabel;
        return this;
    }
    /** Adds a ready-made "Close" button that dismisses the toast. See `Toasts.closeButton()`. */
    withCloseButton(label?: string, className?: string): this {
        if (!this._options.buttons) this._options.buttons = [];
        this._options.buttons.push(this._toasts.closeButton(label, className));
        return this;
    }
    /** Adds a ready-made confirm-before-action button ("Delete" -> swaps the toast to "Are you sure?" + Yes/No -> runs `onConfirm` -> "Done" -> reverts or closes). See `Toasts.confirmButton()`. */
    withConfirmButton(
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
    ): this {
        if (!this._options.buttons) this._options.buttons = [];
        this._options.buttons.push(this._toasts.confirmButton(label, onConfirm, options));
        return this;
    }
    /** Adds a button whose `onClick` walks through `steps` in order - the general-purpose primitive behind `Toasts.detailsCopyButton()`. See `Toasts.stepButton()`/`ToastButtonStep`. */
    withStepButton(steps: ToastButtonStep[], className?: string): this {
        if (!this._options.buttons) this._options.buttons = [];
        this._options.buttons.push(this._toasts.stepButton(steps, className));
        return this;
    }

    /** @returns the toast's id, same as showToast() */
    show(): string {
        return this._toasts.showToast(this._message, this._options);
    }
}
