/*
  Library-owned translatable strings (button labels, the snackbar region's
  aria-label, ...) — everything else (title, message, per-button/detail
  text) is caller-supplied and out of scope for this module.
*/
export interface ToastTranslations {
    close: string;
    details: string;
    hideDetails: string;
    copy: string;
    copied: string;
    areYouSure: string;
    done: string;
    yes: string;
    no: string;
    notificationsRegion: string;
}

export const ToastLocales: Record<string, ToastTranslations> = {
    en: {
        close: 'Close',
        details: 'Details',
        hideDetails: 'Hide details',
        copy: 'Copy',
        copied: 'Copied!',
        areYouSure: 'Are you sure?',
        done: 'Done',
        yes: 'Yes',
        no: 'No',
        notificationsRegion: 'Notifications',
    },
    de: {
        close: 'Schließen',
        details: 'Details',
        hideDetails: 'Details ausblenden',
        copy: 'Kopieren',
        copied: 'Kopiert!',
        areYouSure: 'Bist du sicher?',
        done: 'Fertig',
        yes: 'Ja',
        no: 'Nein',
        notificationsRegion: 'Benachrichtigungen',
    },
    es: {
        close: 'Cerrar',
        details: 'Detalles',
        hideDetails: 'Ocultar detalles',
        copy: 'Copiar',
        copied: '¡Copiado!',
        areYouSure: '¿Estás seguro?',
        done: 'Hecho',
        yes: 'Sí',
        no: 'No',
        notificationsRegion: 'Notificaciones',
    },
    fr: {
        close: 'Fermer',
        details: 'Détails',
        hideDetails: 'Masquer les détails',
        copy: 'Copier',
        copied: 'Copié !',
        areYouSure: 'Êtes-vous sûr ?',
        done: 'Terminé',
        yes: 'Oui',
        no: 'Non',
        notificationsRegion: 'Notifications',
    },
};

/**
 * Case-insensitive match against `ToastLocales`, falling back from a full
 * tag ("de-CH") to its base language ("de"). Undefined if nothing bundled matches.
 */
export function matchToastLocale(code: string): string | undefined {
    const lower = code.toLowerCase();
    if (ToastLocales[lower]) return lower;
    const base = lower.split('-')[0];
    if (base && ToastLocales[base]) return base;
    return undefined;
}

/**
 * The user's preferred languages, most-preferred first. Empty outside a
 * browser (SSR-safe — mirrors the lazy-init "sicher für SSR" pattern
 * elsewhere in this library, so importing this module never touches `navigator`
 * at load time).
 */
export function detectBrowserLocales(): string[] {
    if (typeof navigator === 'undefined') return [];
    if (navigator.languages && navigator.languages.length) return [...navigator.languages];
    return navigator.language ? [navigator.language] : [];
}
