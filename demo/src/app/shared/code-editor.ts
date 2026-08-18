import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Ambient types for the Playground's sandboxed run() scope, fed to Monaco's JS language
 * service via addExtraLib so typing a `.` after a builder call suggests real methods. The
 * declarations themselves are generated at ../../dist/index.d.ts's build time by
 * demo/scripts/generate-monaco-lib.mjs (see demo/package.json's pre{start,build,test} hooks)
 * rather than hand-maintained here, so they can never drift out of sync with the library's
 * actual public API the way they used to - see https://github.com/Brentspine/brents-toasts/issues/64.
 * Keep playground.ts's `run()` sandbox scope (the `new Function(...)` params) in sync with
 * `src/index.ts`'s runtime exports - that's what the suggestions here should actually match.
 * Loaded via a dynamic import (not a static one) so its ~50KB of generated declarations +
 * doc comments only ever ends up in a lazily-fetched chunk alongside Monaco itself, not the
 * app's initial bundle - it's only needed once Monaco has actually loaded from its CDN.
 */
let toastsDtsPromise: Promise<string> | null = null;
function loadToastsDts(): Promise<string> {
  toastsDtsPromise ??= import('./toasts-lib.generated.txt').then((m) => m.default);
  return toastsDtsPromise;
}

const MONACO_VERSION = '0.56.0';
const MONACO_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

declare global {
  interface Window {
    monaco?: typeof import('monaco-editor');
    require?: {
      config(options: { paths: Record<string, string> }): void;
      (deps: string[], callback: () => void): void;
    };
  }
}

let monacoLoadPromise: Promise<typeof import('monaco-editor') | undefined> | null = null;

/**
 * Loads Monaco from a CDN (AMD loader) instead of bundling the npm package: Angular's
 * esbuild-based application builder has no supported hook for Monaco's web worker setup,
 * but the CDN's own loader/workers sidestep that entirely, no build config needed.
 * Resolves to undefined (never rejects the app) if the CDN is unreachable/blocked, in
 * which case CodeEditor's textarea fallback stays in place.
 */
function loadMonaco(): Promise<typeof import('monaco-editor') | undefined> {
  if (window.monaco) return Promise.resolve(window.monaco);
  if (monacoLoadPromise) return monacoLoadPromise;

  monacoLoadPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(undefined), 5000);
    const script = document.createElement('script');
    script.src = `${MONACO_BASE}/loader.js`;
    script.onload = () => {
      try {
        window.require!.config({ paths: { vs: MONACO_BASE } });
        window.require!(['vs/editor/editor.main'], () => {
          clearTimeout(timeout);
          resolve(window.monaco);
        });
      } catch {
        clearTimeout(timeout);
        resolve(undefined);
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      resolve(undefined);
    };
    document.head.appendChild(script);
  });
  return monacoLoadPromise;
}

/**
 * A code editor for the Playground's snippet, Monaco when the CDN is reachable (real
 * JS autocomplete, via `loadToastsDts()` above), a plain textarea otherwise. Two-way bound
 * via `[(code)]` like a native form control.
 */
@Component({
  selector: 'app-code-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-wrap">
      <div #monacoHost class="monaco-host" [class.hidden]="!ready()"></div>
      @if (!ready()) {
        <textarea
          class="fallback"
          [rows]="rows()"
          [attr.aria-label]="ariaLabel()"
          [value]="code()"
          (input)="onTextareaInput($event)"
        ></textarea>
      }
    </div>
  `,
  styles: `
    .editor-wrap {
      position: relative;
    }
    .monaco-host {
      height: 220px;
      border: 1px solid var(--line, #262a31);
      border-radius: 6px;
      overflow: hidden;
    }
    .monaco-host.hidden {
      display: none;
    }
    .fallback {
      width: 100%;
      background: var(--input, #1d2129);
      border: 1px solid var(--line, #262a31);
      border-radius: 6px;
      color: var(--fg, #f2f3f5);
      padding: 10px;
      font-size: 13px;
      resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    }
  `,
})
export class CodeEditor {
  readonly code = model.required<string>();
  readonly rows = input(10);
  readonly ariaLabel = input('Code editor');

  /**
   * Fires once loading has finished one way or another (Monaco initialized, or the CDN
   * failed/timed out and the textarea fallback is staying put). Monaco's async CDN load
   * swaps in a taller element than the textarea it replaces, shifting everything below
   * this component down - callers that need to scroll to something below the editor
   * (e.g. Playground's example links) should wait for this instead of guessing at timing.
   */
  readonly stable = output<void>();

  private readonly monacoHost = viewChild<ElementRef<HTMLDivElement>>('monacoHost');
  protected readonly ready = signal(false);
  private editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
  private applyingExternal = false;

  constructor() {
    afterNextRender(() => {
      loadMonaco().then((monaco) => {
        if (monaco) this.initEditor(monaco);
        this.stable.emit();
      });
    });

    effect(() => {
      const value = this.code();
      if (this.editorInstance && this.editorInstance.getValue() !== value) {
        this.applyingExternal = true;
        this.editorInstance.setValue(value);
        this.applyingExternal = false;
      }
    });
  }

  private initEditor(monaco: typeof import('monaco-editor')): void {
    const host = this.monacoHost()?.nativeElement;
    if (!host) return;

    monaco.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
    });
    // Doesn't block editor creation below - suggestions/hover just go from "none" to "real"
    // once this resolves, same as any other async Monaco language-service update.
    loadToastsDts().then((dts) => monaco.typescript.javascriptDefaults.addExtraLib(dts, 'file:///toasts.d.ts'));

    this.editorInstance = monaco.editor.create(host, {
      value: this.code(),
      language: 'javascript',
      theme: 'vs-dark',
      minimap: { enabled: false },
      fontSize: 13,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      // The editor's host is short (220px) and often near the bottom of the viewport, so
      // suggestion/hover widgets need to escape its bounding box (position: fixed against
      // the body) instead of being confined and clipped/flipped upward within it.
      fixedOverflowWidgets: true,
    });

    this.editorInstance.onDidChangeModelContent(() => {
      if (this.applyingExternal || !this.editorInstance) return;
      this.code.set(this.editorInstance.getValue());
    });

    this.ready.set(true);
  }

  protected onTextareaInput(event: Event): void {
    this.code.set((event.target as HTMLTextAreaElement).value);
  }
}
