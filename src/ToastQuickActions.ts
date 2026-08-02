import { detectBrowserLocales } from './ToastLocale';

/**
 * Pre-translated common action words — "Yes", "Cancel", "Undo", ... — for
 * dropping straight into button labels/messages you build yourself (e.g.
 * `withButton(ToastQuickActions.yes(), onYes)`). Entirely separate from
 * `ToastLocales`/`ToastTranslations` (`ToastLocale.ts`), which cover the
 * library's own built-in chrome text (close/details/copy/confirm labels)
 * instead — these two locale sets are matched independently, on purpose,
 * so adding a bundled language to one never silently breaks the other.
 */
export interface QuickActionStrings {
    yes: string;
    no: string;
    ok: string;
    cancel: string;
    confirm: string;
    dismiss: string;
    undo: string;
    retry: string;
    save: string;
    delete: string;
}

export const QuickActionLocales: Record<string, QuickActionStrings> = {
    en: { yes: 'Yes', no: 'No', ok: 'OK', cancel: 'Cancel', confirm: 'Confirm', dismiss: 'Dismiss', undo: 'Undo', retry: 'Retry', save: 'Save', delete: 'Delete' },
    de: { yes: 'Ja', no: 'Nein', ok: 'OK', cancel: 'Abbrechen', confirm: 'Bestätigen', dismiss: 'Verwerfen', undo: 'Rückgängig', retry: 'Erneut versuchen', save: 'Speichern', delete: 'Löschen' },
    es: { yes: 'Sí', no: 'No', ok: 'Aceptar', cancel: 'Cancelar', confirm: 'Confirmar', dismiss: 'Descartar', undo: 'Deshacer', retry: 'Reintentar', save: 'Guardar', delete: 'Eliminar' },
    fr: { yes: 'Oui', no: 'Non', ok: 'OK', cancel: 'Annuler', confirm: 'Confirmer', dismiss: 'Ignorer', undo: 'Annuler', retry: 'Réessayer', save: 'Enregistrer', delete: 'Supprimer' },
};

// Case-insensitive match against QuickActionLocales, falling back from a
// full tag ("de-CH") to its base language ("de") — same shape as
// `matchToastLocale` in ToastLocale.ts, kept as its own copy (rather than
// imported) so this utility's locale set can diverge from `ToastLocales`'s
// without either one silently resolving into a key the other doesn't have.
function matchQuickActionLocale(code: string): string | undefined {
    const lower = code.toLowerCase();
    if (QuickActionLocales[lower]) return lower;
    const base = lower.split('-')[0];
    if (base && QuickActionLocales[base]) return base;
    return undefined;
}

/**
 * Static, stateless utility — no `Toasts` instance needed, and calling it
 * never reads or changes any `Toasts` instance's `configure()`d locale.
 * `locale` on every method defaults to auto-detecting from
 * `navigator.language`(s) (falling back to `"en"` if nothing bundled
 * matches), same resolution order `Toasts.configure()`'s `locale` uses, just
 * independent of it — pass an explicit locale to override per call.
 */
export class ToastQuickActions {
    /** All ten strings for one resolved locale at once. */
    static all(locale?: string): QuickActionStrings {
        return QuickActionLocales[ToastQuickActions._resolveLocaleKey(locale)]!;
    }
    static yes(locale?: string): string { return ToastQuickActions.all(locale).yes; }
    static no(locale?: string): string { return ToastQuickActions.all(locale).no; }
    static ok(locale?: string): string { return ToastQuickActions.all(locale).ok; }
    static cancel(locale?: string): string { return ToastQuickActions.all(locale).cancel; }
    static confirm(locale?: string): string { return ToastQuickActions.all(locale).confirm; }
    static dismiss(locale?: string): string { return ToastQuickActions.all(locale).dismiss; }
    static undo(locale?: string): string { return ToastQuickActions.all(locale).undo; }
    static retry(locale?: string): string { return ToastQuickActions.all(locale).retry; }
    static save(locale?: string): string { return ToastQuickActions.all(locale).save; }
    static delete(locale?: string): string { return ToastQuickActions.all(locale).delete; }

    private static _resolveLocaleKey(locale?: string): string {
        if (locale) return matchQuickActionLocale(locale) ?? 'en';
        for (const candidate of detectBrowserLocales()) {
            const match = matchQuickActionLocale(candidate);
            if (match) return match;
        }
        return 'en';
    }
}
