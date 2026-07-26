import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toasts, ToastBuilder, ToastColor, ToastPosition, ToastAnimation } from 'brents-toasts';
import { OptionsDataService } from '../../services/options-data';
import { SectionService } from '../../services/section';
import { TypeSpecPanel } from '../../shared/type-spec-panel';
import { CodeEditor } from '../../shared/code-editor';
import type { OptionDescriptor, PlaygroundExample } from '../../data/options.types';

const IMPORT_LINE = "import { ToastBuilder, ToastColor, ToastPosition, ToastAnimation } from 'brents-toasts';";
const DEFAULT_CODE = 'new ToastBuilder("Something happened!")\n  .show();';
const STORAGE_KEY = 'bt-demo:playground-code';
const HIGHLIGHTED_EXAMPLES_KEY = 'bt-demo:highlighted-examples';

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

function loadHighlightedExamples(): Set<string> {
  try {
    const raw = localStorage.getItem(HIGHLIGHTED_EXAMPLES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markExampleHighlighted(id: string, seen: Set<string>): void {
  seen.add(id);
  try {
    localStorage.setItem(HIGHLIGHTED_EXAMPLES_KEY, JSON.stringify([...seen]));
  } catch {
    // Storage unavailable: the glow just replays next time, which is harmless.
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
function scrollToFragmentWhenStable(id: string, onSettled?: () => void): void {
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
    onSettled?.();
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly section = inject(SectionService);

  readonly importLine = IMPORT_LINE;
  readonly search = signal('');
  readonly selectedTypeRef = signal<string | null>(null);
  readonly code = signal(loadStoredCode());
  readonly runError = signal<string | null>(null);
  readonly copied = signal(false);
  readonly examples: PlaygroundExample[] = this.optionsData.examples;

  // Set right before an example/undo overwrites the editor, so a "Try it out" click is
  // one step reversible instead of silently discarding whatever the user had.
  readonly previousCode = signal<string | null>(null);
  readonly copiedExampleId = signal<string | null>(null);
  readonly colorPickerValue = signal('#28a6f5');

  private readonly highlightedExamples = loadHighlightedExamples();

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
      scrollToFragmentWhenStable(id, () => {
        if (id.startsWith('example-')) this.flashExampleHighlight(id);
      });
    });

    // Flips the header nav from "Playground" to "Examples" once that section scrolls
    // into view, and back on the way out. Both nav links point at this same route, so
    // RouterLinkActive alone can't tell them apart.
    afterNextRender(() => {
      const el = document.getElementById('examples');
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.section.activeSection.set(entry.isIntersecting ? 'examples' : 'playground'),
        { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
      );
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    this.destroyRef.onDestroy(() => this.section.activeSection.set('playground'));
  }

  /** Briefly glows an example card's border, but only the first time a given example is linked to. */
  private flashExampleHighlight(id: string): void {
    if (this.highlightedExamples.has(id)) return;
    const el = document.getElementById(id);
    if (!el) return;
    markExampleHighlighted(id, this.highlightedExamples);
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 2000);
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
    if (this.code() !== example.code) this.previousCode.set(this.code());
    this.code.set(example.code);
    this.run();
  }

  /** Restores whatever was in the editor right before the last "Try it out" click. */
  undoLastExample(): void {
    const previous = this.previousCode();
    if (previous === null) return;
    this.code.set(previous);
    this.previousCode.set(null);
    this.runError.set(null);
  }

  async copyExample(example: PlaygroundExample): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${this.importLine}\n\n${example.code}`);
      this.copiedExampleId.set(example.id);
      setTimeout(() => {
        if (this.copiedExampleId() === example.id) this.copiedExampleId.set(null);
      }, 1500);
    } catch {
      // Clipboard API unavailable, no-op, same fallback as the library's own detailsCopyButton().
    }
  }

  /** Inserts or updates a .withColor(...) call from a picked hex value, no hand-typed hex required. */
  onColorPicked(event: Event): void {
    const hex = (event.target as HTMLInputElement).value;
    this.colorPickerValue.set(hex);
    const lines = this.code().split('\n');
    const colorLine = `  .withColor("${hex}")`;
    const existingIndex = lines.findIndex((line) => line.trim().startsWith('.withColor('));

    if (existingIndex !== -1) {
      lines[existingIndex] = colorLine;
    } else {
      const showIndex = lines.findIndex((line) => line.trim() === '.show();');
      const insertAt = showIndex === -1 ? lines.length : showIndex;
      lines.splice(insertAt, 0, colorLine);
    }
    this.code.set(lines.join('\n'));
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
