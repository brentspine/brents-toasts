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
import {
  toasts,
  ToastAnimation,
  ToastBuilder,
  ToastIcon,
  ToastLayout,
  ToastModifier,
  ToastPosition,
  ToastSeverity,
  ToastTransition,
} from 'brents-toasts';
import type { ToastButton, ToastModifierValue, ToastProgressOptions } from 'brents-toasts';
import { OptionsDataService } from '../../services/options-data';
import { SectionService } from '../../services/section';
import { TypeSpecPanel } from '../../shared/type-spec-panel';
import { CodeEditor } from '../../shared/code-editor';
import { PLAYGROUND_STORAGE_KEY, runSandboxedCode } from '../../shared/run-code';
import { hasStoredConfigChanges } from '../config/config';
import type { OptionDescriptor, PlaygroundExample } from '../../data/options.types';

const IMPORT_LINE =
  "import { toasts, Toasts, ToastBuilder, ToastColor, ToastSeverity, ToastPosition, ToastAnimation, ToastLayout, ToastModifier, ToastIcon, ToastTransition, ToastLocales, ToastQuickActions, QuickActionLocales, registerToastAnimation, registerToastLayout, registerToastModifier, registerToastIcon, registerToastTransition } from 'brents-toasts';";
const DEFAULT_CODE = 'new ToastBuilder("Something happened!")\n  .show();';
const STORAGE_KEY = PLAYGROUND_STORAGE_KEY;

const RANDOM_MESSAGES = ['Nice!', 'Boom.', 'All set.', 'Here you go!', 'Look at that.', 'Ta-da!'];
const RANDOM_SEVERITIES = [ToastSeverity.INFO, ToastSeverity.SUCCESS, ToastSeverity.WARNING, ToastSeverity.ERROR];
// Rare decorative flourish on top of the randomized severity above - same "occasional custom
// color override" pattern as the theme/layouts Playground examples.
const WILDCARD_COLORS = ['#9b59b6', '#ff6ec7', '#1abc9c', '#f39c12'];
const RANDOM_POSITIONS = Object.values(ToastPosition);
const RANDOM_ANIMATIONS = [ToastAnimation.SLIDE, ToastAnimation.FADE, ToastAnimation.NONE];
const RANDOM_LAYOUTS = [ToastLayout.DEFAULT, ToastLayout.PROMINENT];
const RANDOM_ICONS = [undefined, ToastIcon.INFO, ToastIcon.SUCCESS, ToastIcon.WARNING, ToastIcon.ERROR, ToastIcon.SPINNER];
// One pick per group - these mirror the mutually-exclusive modifier groups documented in
// options.json's ToastModifierValue typeSpec, so no combination here ever conflicts.
const WIDTH_MODIFIERS: (ToastModifierValue | undefined)[] = [undefined, ToastModifier.COMPACT, ToastModifier.WIDE];
const CLOSE_MODIFIERS: (ToastModifierValue | undefined)[] = [
  undefined,
  ToastModifier.CLOSE_CORNER,
  ToastModifier.CLOSE_PINNED_RIGHT,
  ToastModifier.CLOSE_HIDDEN,
];
const ICON_ANIM_MODIFIERS: ToastModifierValue[] = [ToastModifier.ICON_POP, ToastModifier.ICON_BOUNCE];
const PROGRESS_MODES = ['fill', 'drain', 'manual'] as const;
const PROGRESS_POSITIONS = ['top', 'bottom'] as const;
const PROGRESS_ORIGINS = ['left', 'right', 'center'] as const;
const SURPRISE_BUTTONS: ToastButton[] = [
  { label: 'Nice!', onClick: (event, id) => toasts.removeToast(id) },
  { label: 'Snooze', onClick: (event, id) => toasts.extendToastTimer(id, 3000) },
  { label: 'Shake it', onClick: (event, id) => toasts.playToastTransition(id, ToastTransition.SHAKE_LR) },
  { label: 'Undo', onClick: () => {} },
];

function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomSurpriseProgress(): boolean | ToastProgressOptions {
  const roll = Math.random();
  if (roll < 0.3) return false;
  if (roll < 0.5) return true;
  return {
    mode: pick(PROGRESS_MODES),
    position: pick(PROGRESS_POSITIONS),
    origin: pick(PROGRESS_ORIGINS),
    value: Math.random(),
  };
}

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

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
}

@Component({
  selector: 'app-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TypeSpecPanel, CodeEditor],
  templateUrl: './playground.html',
  styleUrl: './playground.css',
})
export class Playground {
  private readonly optionsDataService = inject(OptionsDataService);
  private readonly optionsData = this.optionsDataService.data;
  private readonly destroyRef = inject(DestroyRef);
  protected readonly section = inject(SectionService);

  readonly importLine = IMPORT_LINE;
  readonly search = signal('');
  readonly selectedTypeRef = signal<string | null>(null);
  readonly code = signal(loadStoredCode());
  readonly runError = signal<string | null>(null);
  readonly copied = signal(false);
  readonly examples: PlaygroundExample[] = this.optionsDataService.examples;

  // Set right before an example/undo overwrites the editor, so a "Try it out" click is
  // one step reversible instead of silently discarding whatever the user had.
  readonly previousCode = signal<string | null>(null);
  readonly copiedExampleId = signal<string | null>(null);
  readonly colorPickerValue = signal('#28a6f5');
  readonly colorCopied = signal(false);

  // Flips once the CodeEditor's Monaco instance has finished loading (or given up and
  // fallen back to a textarea) - see the fragment effect below for why a fragment scroll
  // has to wait on this instead of firing immediately.
  readonly editorStable = signal(false);

  // Read once at construction - Angular recreates this component on every navigation into
  // /playground, so this always reflects whatever was last saved on the Config page, without
  // needing to watch localStorage while already on this page.
  readonly hasCustomConfig = signal(hasStoredConfigChanges());

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

  // ActivatedRoute.fragment, not the router's built-in anchorScrolling: the CodeEditor's
  // Monaco instance loads from a CDN asynchronously and swaps in a taller element once
  // ready, shifting the "Browse examples" section below it - the built-in scroller has
  // no way to wait for that, so the fragment is read here and scrolled to manually once
  // editorStable() confirms that shift has already happened (see the effect below).
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

    // Waits on editorStable(), not just the fragment: right after navigating here the
    // CodeEditor's Monaco instance is still loading from its CDN asynchronously and swaps
    // in a taller element once it's ready, shifting everything below it (including the
    // "Browse examples" section) down. Scrolling before that settles lands short/long of
    // the target - reading editorStable() here subscribes the effect to it, so it
    // automatically re-runs (and actually scrolls) once loading finishes.
    effect(() => {
      const id = this.fragment();
      const stable = this.editorStable();
      if (!id || !stable) return;
      scrollToId(id);
      if (id.startsWith('example-')) this.flashExampleHighlight(id);
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

  /** Briefly glows an example card's border to draw attention to it after a fragment link scroll. */
  private flashExampleHighlight(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
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
    // Only captured on the *first* example click of a streak (previousCode still null) -
    // trying example 2 right after example 1 must not overwrite this with example 1's
    // code, or Undo would restore example 1 instead of what the user actually had before.
    if (this.previousCode() === null && this.code() !== example.code) {
      this.previousCode.set(this.code());
    }
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

  /**
   * A standalone color-picking utility, not tied to the code editor: hex codes are
   * annoying to guess/hand-type, so this just lets a user pick a color and copy its hex
   * to paste wherever they need it (e.g. into a .withColor("...") call themselves). It
   * deliberately never touches the code snippet.
   */
  onColorPicked(event: Event): void {
    this.colorPickerValue.set((event.target as HTMLInputElement).value);
  }

  async copyPickedColor(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.colorPickerValue());
      this.colorCopied.set(true);
      setTimeout(() => this.colorCopied.set(false), 1500);
    } catch {
      // Clipboard API unavailable, no-op, same fallback as the library's own detailsCopyButton().
    }
  }

  /** Fires a toast with randomized options, just to show off how much the API can combine. */
  surpriseMe(): void {
    const icon = pick(RANDOM_ICONS);
    const modifiers = [pick(WIDTH_MODIFIERS), pick(CLOSE_MODIFIERS), icon && pick(ICON_ANIM_MODIFIERS)].filter(
      (m): m is ToastModifierValue => !!m,
    );

    const builder = new ToastBuilder(pick(RANDOM_MESSAGES))
      .withSeverity(pick(RANDOM_SEVERITIES))
      .withPosition(pick(RANDOM_POSITIONS))
      .withAnimation(pick(RANDOM_ANIMATIONS))
      .withLayout(pick(RANDOM_LAYOUTS))
      .withModifiers(modifiers)
      .withProgress(randomSurpriseProgress())
      .withDuration(4500);

    if (icon) builder.withIcon(icon);
    if (Math.random() < 0.15) builder.withColor(pick(WILDCARD_COLORS));

    const buttonCount = Math.random() < 0.5 ? 0 : Math.random() < 0.8 ? 1 : 2;
    [...SURPRISE_BUTTONS]
      .sort(() => Math.random() - 0.5)
      .slice(0, buttonCount)
      .forEach((btn) => builder.withButton(btn.label, btn.onClick));

    builder.show();
  }

  run(): void {
    this.runError.set(runSandboxedCode(this.code()));
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
