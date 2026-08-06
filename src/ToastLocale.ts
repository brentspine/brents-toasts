import en from './locales/toast/en.json';
import de from './locales/toast/de.json';
import es from './locales/toast/es.json';
import fr from './locales/toast/fr.json';
import type { ToastPositionValue } from './ToastPosition';

/*
  Library-owned translatable strings (button labels, the snackbar region's
  aria-label, ...) - everything else (title, message, per-button/detail
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
    /**
     * Per-position suffix for the snackbar region's `aria-label` (e.g.
     * "top left"), so simultaneously-visible regions at different positions
     * get distinct accessible names instead of all being announced as just
     * `notificationsRegion` - see `_snackbarLabel` in `Toasts.ts`.
     */
    positions: Record<ToastPositionValue, string>;
    /** Default accessible name for a progress bar with no explicit `ToastProgressOptions.label`. */
    progress: string;
}

export const ToastLocales: Record<string, ToastTranslations> = { en, de, es, fr };

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
 * browser (SSR-safe - mirrors the lazy-init "sicher für SSR" pattern
 * elsewhere in this library, so importing this module never touches `navigator`
 * at load time).
 */
export function detectBrowserLocales(): string[] {
    if (typeof navigator === 'undefined') return [];
    if (navigator.languages && navigator.languages.length) return [...navigator.languages];
    return navigator.language ? [navigator.language] : [];
}
