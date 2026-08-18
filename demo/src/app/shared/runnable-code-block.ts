import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PLAYGROUND_STORAGE_KEY, runSandboxedCode } from './run-code';

/**
 * A static (non-editable) code block for `ts`/`js` fences rendered from markdown (see
 * `MarkdownView`), with a "Run" button executing the snippet against the real library via the
 * same sandbox `playground.ts` uses, and "Open in Playground" seeding the Playground's editor
 * (its own localStorage key) with this snippet before navigating there for further tinkering.
 * Deliberately not a Monaco `CodeEditor` instance: docs pages can have many of these on one
 * page, and none of them need to be edited in place.
 */
@Component({
  selector: 'app-runnable-code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="runnable-code">
      <pre><code>{{ code() }}</code></pre>
      <div class="actions">
        <button type="button" (click)="run()">Run</button>
        <button type="button" (click)="openInPlayground()">Open in Playground</button>
        <button type="button" (click)="copy()">{{ copied() ? 'Copied!' : 'Copy' }}</button>
      </div>
      @if (error()) {
        <p class="run-error">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .runnable-code {
      position: relative;
      background: var(--input, #1d2129);
      border: 1px solid var(--line, #262a31);
      border-radius: 8px;
      margin: 12px 0;
    }
    pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      white-space: pre;
    }
    .actions {
      display: flex;
      gap: 8px;
      padding: 0 12px 12px;
    }
    .actions button {
      background: var(--panel, #171a20);
      color: inherit;
      border: 1px solid var(--line, #262a31);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
    }
    .run-error {
      margin: 0 12px 12px;
      color: var(--error, #ff4433);
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    }
  `,
})
export class RunnableCodeBlock {
  private readonly router = inject(Router);

  readonly code = input.required<string>();
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);

  run(): void {
    this.error.set(runSandboxedCode(this.code()));
  }

  openInPlayground(): void {
    try {
      localStorage.setItem(PLAYGROUND_STORAGE_KEY, this.code());
    } catch {
      // Storage unavailable (private browsing, quota): the Playground just falls back to its default snippet.
    }
    this.router.navigateByUrl('/playground');
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable, no-op, same fallback as the library's own detailsCopyButton().
    }
  }
}
