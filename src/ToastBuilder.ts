import { toasts as defaultToasts, Toasts, type ToastOptions, type ToastDetailItem } from './Toasts';
import { ToastColor } from './ToastColor';
import type { ToastPositionValue } from './ToastPosition';
import type { ToastAnimationValue } from './ToastAnimation';

/*
  Fluent alternative to showToast(message, options). Builds the exact same
  options object showToast() accepts, then hands it off — so builder-created
  toasts and directly-called showToast(message, { ... }) toasts always behave
  identically.
*/
export class ToastBuilder {
    private _toasts: Toasts;
    private _message: string | Node;
    private _options: ToastOptions;

    constructor(message: string | Node, toastsInstance: Toasts = defaultToasts) {
        this._toasts = toastsInstance;
        this._message = message;
        this._options = {};
    }

    withTitle(title: string): this { this._options.title = title; return this; }
    withColor(color: string): this { this._options.color = color; return this; }
    asInfo(): this { return this.withColor(ToastColor.INFO); }
    asSuccess(): this { return this.withColor(ToastColor.SUCCESS); }
    asWarning(): this { return this.withColor(ToastColor.WARNING); }
    asError(): this { return this.withColor(ToastColor.ERROR); }
    withDuration(durationMs: number): this { this._options.duration = durationMs; return this; }
    withClosable(closable: boolean): this { this._options.closable = closable; return this; }
    withAllowHtml(allowHtml: boolean): this { this._options.allowHtml = allowHtml; return this; }
    withPosition(position: ToastPositionValue): this { this._options.position = position; return this; }
    withAnimation(animation: ToastAnimationValue): this { this._options.animation = animation; return this; }
    withOnClose(onClose: () => void): this { this._options.onClose = onClose; return this; }
    andRemoveOtherToasts(): this { this._options.removeOtherToasts = true; return this; }
    /** Adds one action button (repeatable — call multiple times for multiple buttons). */
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
    /** Default `copyable` for every details item that doesn't set its own. See `ToastOptions.detailsCopyable`. */
    withDetailsCopyable(copyable: boolean): this { this._options.detailsCopyable = copyable; return this; }
    /** Default `copyable` when `details` has exactly one entry. See `ToastOptions.detailsCopyableSingle`. */
    withDetailsCopyableSingle(copyable: boolean): this { this._options.detailsCopyableSingle = copyable; return this; }
    /** Adds a ready-made "Close" button that dismisses the toast. See `Toasts.closeButton()`. */
    withCloseButton(label?: string, className?: string): this {
        if (!this._options.buttons) this._options.buttons = [];
        this._options.buttons.push(this._toasts.closeButton(label, className));
        return this;
    }

    /** @returns the toast's id, same as showToast() */
    show(): string {
        return this._toasts.showToast(this._message, this._options);
    }
}
