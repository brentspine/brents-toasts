import { toasts as defaultToasts, Toasts, type ToastOptions } from './Toasts';
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
    private _message: string;
    private _options: ToastOptions;

    constructor(message: string, toastsInstance: Toasts = defaultToasts) {
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

    /** @returns the toast's id, same as showToast() */
    show(): string {
        return this._toasts.showToast(this._message, this._options);
    }
}
