import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toasts, ToastBuilder, ToastColor, ToastPosition, ToastAnimation } from 'brents-toasts';
import { OptionsDataService } from '../../services/options-data';
import { TypeSpecPanel } from '../../shared/type-spec-panel';
import { CodeEditor } from '../../shared/code-editor';
import type { OptionDescriptor, PlaygroundExample } from '../../data/options.types';

const IMPORT_LINE = "import { ToastBuilder, ToastColor, ToastPosition, ToastAnimation } from 'brents-toasts';";
const DEFAULT_CODE = 'new ToastBuilder("Something happened!")\n  .show();';
const STORAGE_KEY = 'bt-demo:playground-code';

const RANDOM_MESSAGES = ['Nice!', 'Boom.', 'All set.', 'Here you go!', 'Look at that.', 'Ta-da!'];
const RANDOM_COLORS = [ToastColor.INFO, ToastColor.SUCCESS, ToastColor.WARNING, ToastColor.ERROR];
const RANDOM_POSITIONS = Object.values(ToastPosition);

function loadStoredCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CODE;
  } catch {
    return DEFAULT_CODE;
  }
}

/** Extracts the `.methodName(` prefix from a builderCall, so edited argument values still count as "selected". */
function methodPrefix(builderCall: string): string {
  return builderCall.match(/^(\.[a-zA-Z0-9_]+\()/)?.[1] ?? builderCall;
}

/**
 * Scrolls #id into view once the page has stopped resizing, instead of on a fixed
 * timer. Right after navigating here the CodeEditor's Monaco instance is still loading
 * from its CDN asynchronously, and swaps in a taller element once it's ready, shifting
 * everything below it (including the "Browse examples" section) down. Scrolling before
 * that settles lands short of the target. Debounces on document.body's ResizeObserver,
 * with a hard cutoff so a fragment link can never wait indefinitely.
 */
function scrollToFragmentWhenStable(id: string): void {
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const cutoff = setTimeout(finish, 2500);
  const observer = new ResizeObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(finish, 150);
  });
  observer.observe(document.body);

  function finish(): void {
    clearTimeout(debounce);
    clearTimeout(cutoff);
    observer.disconnect();
    document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}

@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TypeSpecPanel, CodeEditor],
  templateUrl: './playground.html',
  styleUrl: './playground.css',
})
export class Playground {
  private readonly optionsData = inject(OptionsDataService).data;

  readonly importLine = IMPORT_LINE;
  readonly search = signal('');
  readonly selectedTypeRef = signal<string | null>(null);
  readonly code = signal(loadStoredCode());
  readonly runError = signal<string | null>(null);
  readonly copied = signal(false);
  readonly examples: PlaygroundExample[] = this.optionsData.examples;

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

  // Selection state is derived from the code text itself (not tracked separately), so
  // hand-editing or pasting code is automatically reflected in the table without a row
  // click ever needing to regenerate/clobber the snippet.
  private readonly selectedNames = computed(() => {
    const text = this.code();
    const names = new Set<string>();
    for (const opt of this.optionsData.toastOptions) {
      if (opt.builderCall && text.includes(methodPrefix(opt.builderCall))) names.add(opt.name);
    }
    return names;
  });

  readonly selectedTypeSpec = computed(() => {
    const ref = this.selectedTypeRef();
    return ref ? this.optionsData.typeSpecs[ref] : null;
  });

  // ActivatedRoute.fragment, not the router's built-in anchorScrolling: with
  // withHashLocation() the URL ends up as "#/playground#example-id" (a literal second
  // "#", since HashLocationStrategy already owns the first one), which the built-in
  // scroller doesn't reliably parse. Reading the fragment straight from the route and
  // scrolling manually sidesteps that entirely.
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  constructor() {
    effect(() => {
      const value = this.code();
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Storage unavailable (private browsing, quota): persistence is a nice-to-have, not required.
      }
    });

    effect(() => {
      const id = this.fragment();
      if (!id) return;
      scrollToFragmentWhenStable(id);
    });
  }

  isSelected(opt: OptionDescriptor): boolean {
    return this.selectedNames().has(opt.name);
  }

  toggleOption(opt: OptionDescriptor): void {
    if (!opt.builderCall) return;
    const prefix = methodPrefix(opt.builderCall);
    const lines = this.code().split('\n');

    if (this.isSelected(opt)) {
      this.code.set(lines.filter((line) => !line.trim().startsWith(prefix)).join('\n'));
      return;
    }

    const showIndex = lines.findIndex((line) => line.trim() === '.show();');
    const insertAt = showIndex === -1 ? lines.length : showIndex;
    lines.splice(insertAt, 0, '  ' + opt.builderCall);
    this.code.set(lines.join('\n'));
  }

  openType(ref: string | undefined, event: Event): void {
    event.stopPropagation();
    if (ref) this.selectedTypeRef.set(ref);
  }

  closeType(): void {
    this.selectedTypeRef.set(null);
  }

  reset(): void {
    this.code.set(DEFAULT_CODE);
    this.runError.set(null);
  }

  tryExample(example: PlaygroundExample): void {
    this.code.set(example.code);
    this.run();
  }

  async copyExample(example: PlaygroundExample): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${this.importLine}\n\n${example.code}`);
    } catch {
      // Clipboard API unavailable, no-op, same fallback as the library's own detailsCopyButton().
    }
  }

  /** Fires a toast with randomized options, just to show off how much the API can combine. */
  surpriseMe(): void {
    const message = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
    const color = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
    const position = RANDOM_POSITIONS[Math.floor(Math.random() * RANDOM_POSITIONS.length)];
    const withProgress = Math.random() > 0.5;

    new ToastBuilder(message)
      .withColor(color)
      .withPosition(position)
      .withDuration(4000)
      .withProgress(withProgress)
      .show();
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
      // Clipboard API unavailable, no-op, same fallback as the library's own detailsCopyButton().
    }
  }
}
