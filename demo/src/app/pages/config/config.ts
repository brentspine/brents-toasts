import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toasts, DEFAULT_CONFIG, ToastSeverity, ToastPosition, type ToastPositionValue, type ToastsConfig, type PositionConfig } from 'brents-toasts';
import { CodeSnippet } from '../../shared/code-snippet';
import { OptionsDataService } from '../../services/options-data';
import optionsJson from '../../data/options.json';
import type { OptionsData, OptionDescriptor } from '../../data/options.types';

// Imported directly (not via OptionsDataService) so the module-level default builders below
// and `hasStoredConfigChanges()` - both used outside the component, before Angular DI exists -
// can read the same canonical field list the rendered form is built from.
const CONFIG_OPTIONS: OptionDescriptor[] = (optionsJson as OptionsData).configOptions;

type ScalarValue = string | number | boolean;

/**
 * Every non-JSON (`control !== 'text'`) `configOptions` field maps 1:1 onto a form value here,
 * keyed by name - driven entirely by `configOptions`' `control`/`selectOptions` metadata rather
 * than a hand-maintained field list, so a new `ToastsConfig` field (added only to options.json
 * per CLAUDE.md) shows up in this form automatically instead of needing a matching edit here.
 */
function buildDefaultForm(): Record<string, ScalarValue> {
  const form: Record<string, ScalarValue> = {};
  for (const opt of CONFIG_OPTIONS) {
    if (opt.control === 'text') continue;
    if (opt.name === 'locale') {
      form['locale'] = 'auto'; // DEFAULT_CONFIG.locale is undefined - "auto" is this form's sentinel for that
      continue;
    }
    if (opt.name === 'reducedMotion') {
      form['reducedMotion'] = 'auto'; // DEFAULT_CONFIG.reducedMotion is undefined - "auto" is this form's sentinel for that
      continue;
    }
    form[opt.name] = (DEFAULT_CONFIG as unknown as Record<string, ScalarValue>)[opt.name];
  }
  return form;
}

/** Every JSON-shaped (`control: 'text'`) field's raw textarea contents - blank means "don't override". */
function buildDefaultJson(): Record<string, string> {
  const json: Record<string, string> = {};
  for (const opt of CONFIG_OPTIONS) {
    if (opt.control === 'text') json[opt.name] = '';
  }
  return json;
}

interface StoredConfigForm {
  form: Record<string, ScalarValue>;
  json: Record<string, string>;
}

const STORAGE_KEY = 'bt-demo:config-form';

function loadStoredForm(): StoredConfigForm {
  const defaults: StoredConfigForm = { form: buildDefaultForm(), json: buildDefaultJson() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredConfigForm>;
    return {
      form: { ...defaults.form, ...parsed.form },
      json: { ...defaults.json, ...parsed.json },
    };
  } catch {
    return defaults;
  }
}

/** Whether the persisted config form (see STORAGE_KEY above) differs from the library defaults - used by the Playground to hint that toasts there reflect a customized config, not out-of-the-box behavior. */
export function hasStoredConfigChanges(): boolean {
  const stored = loadStoredForm();
  const defaults: StoredConfigForm = { form: buildDefaultForm(), json: buildDefaultJson() };
  return JSON.stringify(stored) !== JSON.stringify(defaults);
}

/**
 * The `reducedMotion` override currently saved in the persisted config form (via the Config
 * page's select, or `setReducedMotionOverride()` below) - `undefined` for the "auto" sentinel,
 * meaning no override. Read straight from localStorage rather than `toasts.config.reducedMotion`,
 * so it's accurate even before the Config page has been visited this session (which is what
 * actually re-applies the stored form to `toasts.config` - see its constructor).
 */
export function getReducedMotionOverride(): boolean | undefined {
  const raw = loadStoredForm().form['reducedMotion'];
  return raw === 'true' ? true : raw === 'false' ? false : undefined;
}

/**
 * Persists a `reducedMotion` override into the same config form the Config page reads/writes,
 * and applies it to `toasts.config` immediately - used by the Playground's "force animations
 * on" quick-fix so the override sticks around (and shows correctly on the Config page) without
 * requiring a trip there first.
 */
export function setReducedMotionOverride(value: boolean): void {
  const stored = loadStoredForm();
  stored.form['reducedMotion'] = String(value);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable (private browsing, quota): persistence is a nice-to-have, not required.
  }
  toasts.configure({ reducedMotion: value });
}

/**
 * Friendly label for one `<option>` of a `control: 'select'` field, for the couple of fields
 * (`locale`, `reducedMotion`) whose raw `selectOptions` value ("auto", "true", ...) isn't
 * self-explanatory on its own. Every other select field's choices are shown as-is.
 */
function selectOptionLabel(optName: string, choice: string): string {
  if (optName === 'locale' && choice === 'auto') return 'auto-detect';
  if (optName === 'reducedMotion') {
    if (choice === 'auto') return 'auto (system default)';
    if (choice === 'true') return 'true (force reduced motion)';
    if (choice === 'false') return 'false (force animations on)';
  }
  return choice;
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
  readonly selectOptionLabel = selectOptionLabel;
  readonly scalarOptions = this.configOptions.filter((o) => o.control !== 'text');
  readonly jsonOptions = this.configOptions.filter((o) => o.control === 'text');
  readonly positions = Object.values(ToastPosition);

  readonly search = signal('');
  readonly filteredConfigOptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.configOptions;
    return this.configOptions.filter(
      (opt) =>
        opt.name.toLowerCase().includes(query) ||
        opt.type.toLowerCase().includes(query) ||
        opt.description.toLowerCase().includes(query),
    );
  });
  readonly filteredScalarOptions = computed(() => this.filteredConfigOptions().filter((o) => o.control !== 'text'));
  readonly filteredJsonOptions = computed(() => this.filteredConfigOptions().filter((o) => o.control === 'text'));

  private readonly stored = loadStoredForm();
  readonly form = signal<Record<string, ScalarValue>>(this.stored.form);
  readonly jsonFields = signal<Record<string, string>>(this.stored.json);
  readonly jsonErrors = signal<Record<string, string>>({});
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
      const state: StoredConfigForm = { form: this.form(), json: this.jsonFields() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage unavailable (private browsing, quota): persistence is a nice-to-have, not required.
      }
    });
  }

  updateForm(name: string, value: ScalarValue): void {
    this.form.update((current) => ({ ...current, [name]: value }));
  }

  updateJsonField(name: string, value: string): void {
    this.jsonFields.update((current) => ({ ...current, [name]: value }));
  }

  resetConfig(): void {
    toasts.showToast('Reset all Playground config to the library defaults?', {
      severity: ToastSeverity.WARNING,
      duration: 0,
      buttons: [
        toasts.confirmButton('Reset', () => {
          this.form.set(buildDefaultForm());
          this.jsonFields.set(buildDefaultJson());
          this.jsonErrors.set({});
          // Reverts every field the library tracks (including ones apply() would otherwise
          // leave untouched, like a JSON field left blank meaning "don't override" rather than
          // "clear back to default") before re-applying the now-default form on top.
          toasts.resetConfig();
          this.apply();
        }),
      ],
    });
  }

  apply(): void {
    const state = this.form();
    const json = this.jsonFields();
    const config: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const opt of this.scalarOptions) {
      if (opt.name === 'locale') {
        if (state['locale'] !== 'auto') config['locale'] = state['locale'];
        continue;
      }
      if (opt.name === 'reducedMotion') {
        if (state['reducedMotion'] !== 'auto') config['reducedMotion'] = state['reducedMotion'] === 'true';
        continue;
      }
      config[opt.name] = state[opt.name];
    }

    for (const opt of this.jsonOptions) {
      const raw = (json[opt.name] ?? '').trim();
      if (!raw) continue;
      try {
        config[opt.name] = JSON.parse(raw);
      } catch {
        errors[opt.name] = `${opt.name} must be valid JSON`;
      }
    }

    this.jsonErrors.set(errors);
    if (Object.keys(errors).length > 0) return;

    toasts.configure(config as Partial<ToastsConfig>);
    this.appliedSnippet.set(this.buildSnippet(config));
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

  private buildSnippet(config: Record<string, unknown>): string {
    const lines = ['toasts.configure({'];
    for (const [key, value] of Object.entries(config)) {
      lines.push(`  ${key}: ${JSON.stringify(value)},`);
    }
    lines.push('});');
    return lines.join('\n');
  }
}
