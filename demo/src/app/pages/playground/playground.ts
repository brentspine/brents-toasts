import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toasts, ToastBuilder, ToastColor, ToastPosition, ToastAnimation } from 'brents-toasts';
import { OptionsDataService } from '../../services/options-data';
import { TypeSpecPanel } from '../../shared/type-spec-panel';
import type { OptionDescriptor } from '../../data/options.types';

const IMPORT_LINE = "import { ToastBuilder, ToastColor, ToastPosition, ToastAnimation } from 'brents-toasts';";
const DEFAULT_CODE = 'new ToastBuilder("Something happened!")\n  .show();';

@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TypeSpecPanel],
  templateUrl: './playground.html',
  styleUrl: './playground.css',
})
export class Playground {
  private readonly optionsData = inject(OptionsDataService).data;

  readonly importLine = IMPORT_LINE;
  readonly search = signal('');
  readonly selected = signal<Map<string, string>>(new Map());
  readonly selectedTypeRef = signal<string | null>(null);
  readonly code = signal(DEFAULT_CODE);
  readonly runError = signal<string | null>(null);
  readonly copied = signal(false);

  readonly filteredOptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.optionsData.toastOptions;
    return this.optionsData.toastOptions.filter(
      (opt) =>
        opt.name.toLowerCase().includes(query) ||
        opt.type.toLowerCase().includes(query) ||
        opt.description.toLowerCase().includes(query),
    );
  });

  readonly selectedTypeSpec = computed(() => {
    const ref = this.selectedTypeRef();
    return ref ? this.optionsData.typeSpecs[ref] : null;
  });

  constructor() {
    effect(() => {
      const calls = [...this.selected().values()];
      const lines = [DEFAULT_CODE.split('\n')[0], ...calls.map((c) => '  ' + c), '  .show();'];
      this.code.set(lines.join('\n'));
    });
  }

  isSelected(opt: OptionDescriptor): boolean {
    return this.selected().has(opt.name);
  }

  toggleOption(opt: OptionDescriptor): void {
    if (!opt.builderCall) return;
    this.selected.update((current) => {
      const next = new Map(current);
      if (next.has(opt.name)) next.delete(opt.name);
      else next.set(opt.name, opt.builderCall!);
      return next;
    });
  }

  openType(ref: string | undefined, event: Event): void {
    event.stopPropagation();
    if (ref) this.selectedTypeRef.set(ref);
  }

  closeType(): void {
    this.selectedTypeRef.set(null);
  }

  run(): void {
    this.runError.set(null);
    try {
      const fn = new Function('toasts', 'ToastBuilder', 'ToastColor', 'ToastPosition', 'ToastAnimation', this.code());
      fn(toasts, ToastBuilder, ToastColor, ToastPosition, ToastAnimation);
    } catch (err) {
      this.runError.set(err instanceof Error ? err.message : String(err));
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${this.importLine}\n\n${this.code()}`);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable — no-op, same fallback as the library's own detailsCopyButton().
    }
  }
}
