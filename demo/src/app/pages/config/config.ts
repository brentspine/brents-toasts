import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toasts, ToastAnimation, ToastSeverity, ToastPosition, type ToastSeverityValue, type ToastPositionValue, type PositionConfig } from 'brents-toasts';
import { CodeSnippet } from '../../shared/code-snippet';
import { OptionsDataService } from '../../services/options-data';

interface ConfigFormState {
  severity: ToastSeverityValue;
  duration: number;
  closable: boolean;
  allowHtml: boolean;
  allowLineBreaks: boolean;
  position: ToastPositionValue;
  animation: 'slide';
  maxToasts: number;
  evictOldest: boolean;
  pauseOnHover: boolean;
  progress: boolean;
  locale: 'auto' | 'en' | 'de' | 'es' | 'fr';
  themeJson: string;
}

const DEFAULT_FORM_STATE: ConfigFormState = {
  severity: ToastSeverity.INFO,
  duration: 3000,
  closable: true,
  allowHtml: false,
  allowLineBreaks: true,
  position: ToastPosition.BOTTOM_CENTER,
  animation: ToastAnimation.SLIDE,
  maxToasts: 5,
  evictOldest: true,
  pauseOnHover: true,
  progress: false,
  locale: 'auto',
  themeJson: '',
};

const STORAGE_KEY = 'bt-demo:config-form';

function loadStoredForm(): ConfigFormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FORM_STATE };
    return { ...DEFAULT_FORM_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_FORM_STATE };
  }
}

/** Whether the persisted config form (see STORAGE_KEY above) differs from the library defaults - used by the Playground to hint that toasts there reflect a customized config, not out-of-the-box behavior. */
export function hasStoredConfigChanges(): boolean {
  return JSON.stringify(loadStoredForm()) !== JSON.stringify(DEFAULT_FORM_STATE);
}

@Component({
  selector: 'app-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CodeSnippet],
  templateUrl: './config.html',
  styleUrl: './config.css',
})
export class Config {
  readonly configOptions = inject(OptionsDataService).data.configOptions;
  readonly positions = Object.values(ToastPosition);
  readonly severities = Object.values(ToastSeverity);

  readonly form = signal<ConfigFormState>(loadStoredForm());
  readonly themeError = signal<string | null>(null);
  readonly appliedSnippet = signal('// Click "Apply config" to see the generated code here.');

  readonly overridePosition = signal<ToastPositionValue>(ToastPosition.TOP_RIGHT);
  readonly overrideMaxToasts = signal(3);
  readonly overrideEvictOldest = signal(true);
  readonly positionOverrides = signal(new Map(toasts.positionConfig));

  constructor() {
    // Re-apply whatever was last configured (including on first load, which is a harmless
    // no-op re-application of the library's own defaults) so Playground toasts reflect it
    // immediately, without the user needing to click Apply again after a reload.
    this.apply();

    effect(() => {
      const state = this.form();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage unavailable (private browsing, quota): persistence is a nice-to-have, not required.
      }
    });
  }

  updateForm<K extends keyof ConfigFormState>(key: K, value: ConfigFormState[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  resetConfig(): void {
    toasts.showToast('Reset all Playground config to the library defaults?', {
      severity: ToastSeverity.WARNING,
      duration: 0,
      buttons: [
        toasts.confirmButton('Reset', () => {
          this.form.set({ ...DEFAULT_FORM_STATE });
          this.themeError.set(null);
          this.apply();
        }),
      ],
    });
  }

  apply(): void {
    const state = this.form();
    this.themeError.set(null);

    let theme: Record<string, string> | undefined;
    if (state.themeJson.trim()) {
      try {
        theme = JSON.parse(state.themeJson);
      } catch {
        this.themeError.set('Theme must be valid JSON, e.g. { "background": "#222" }');
        return;
      }
    }

    toasts.configure({
      severity: state.severity,
      duration: state.duration,
      closable: state.closable,
      allowHtml: state.allowHtml,
      allowLineBreaks: state.allowLineBreaks,
      position: state.position,
      animation: state.animation,
      maxToasts: state.maxToasts,
      evictOldest: state.evictOldest,
      pauseOnHover: state.pauseOnHover,
      progress: state.progress,
      locale: state.locale === 'auto' ? undefined : state.locale,
      theme,
    });

    this.appliedSnippet.set(this.buildSnippet(state, theme));
  }

  applyPositionOverride(): void {
    toasts.configurePosition(this.overridePosition(), {
      maxToasts: this.overrideMaxToasts(),
      evictOldest: this.overrideEvictOldest(),
    });
    this.positionOverrides.set(new Map(toasts.positionConfig));
  }

  clearPositionOverride(position: ToastPositionValue): void {
    toasts.positionConfig.delete(position);
    this.positionOverrides.set(new Map(toasts.positionConfig));
  }

  positionOverrideEntries(): [ToastPositionValue, PositionConfig][] {
    return [...this.positionOverrides().entries()];
  }

  private buildSnippet(state: ConfigFormState, theme: Record<string, string> | undefined): string {
    const lines = [
      'toasts.configure({',
      `  severity: "${state.severity}",`,
      `  duration: ${state.duration},`,
      `  closable: ${state.closable},`,
      `  allowHtml: ${state.allowHtml},`,
      `  allowLineBreaks: ${state.allowLineBreaks},`,
      `  position: "${state.position}",`,
      `  animation: "${state.animation}",`,
      `  maxToasts: ${state.maxToasts},`,
      `  evictOldest: ${state.evictOldest},`,
      `  pauseOnHover: ${state.pauseOnHover},`,
      `  progress: ${state.progress},`,
      state.locale !== 'auto' ? `  locale: "${state.locale}",` : undefined,
      theme ? `  theme: ${JSON.stringify(theme)},` : undefined,
      '});',
    ].filter((line): line is string => line !== undefined);
    return lines.join('\n');
  }
}
