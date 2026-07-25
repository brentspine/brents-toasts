import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toasts, ToastAnimation, ToastColor, ToastPosition, type ToastPositionValue, type PositionConfig } from 'brents-toasts';
import { CodeSnippet } from '../../shared/code-snippet';
import { OptionsDataService } from '../../services/options-data';

interface ConfigFormState {
  color: string;
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
  color: ToastColor.INFO,
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

@Component({
  selector: 'app-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CodeSnippet],
  templateUrl: './config.html',
  styleUrl: './config.css',
})
export class Config {
  readonly configOptions = inject(OptionsDataService).data.configOptions;
  readonly positions = Object.values(ToastPosition);

  readonly form = signal<ConfigFormState>({ ...DEFAULT_FORM_STATE });
  readonly themeError = signal<string | null>(null);
  readonly appliedSnippet = signal('// Click "Apply config" to see the generated code here.');

  readonly overridePosition = signal<ToastPositionValue>(ToastPosition.TOP_RIGHT);
  readonly overrideMaxToasts = signal(3);
  readonly overrideEvictOldest = signal(true);
  readonly positionOverrides = signal(new Map(toasts.positionConfig));

  updateForm<K extends keyof ConfigFormState>(key: K, value: ConfigFormState[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
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
      color: state.color,
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
      `  color: "${state.color}",`,
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
