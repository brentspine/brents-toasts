import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-code-snippet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="code-snippet">
      <pre><code>{{ code() }}</code></pre>
      <button type="button" class="copy-btn" (click)="copy()">{{ copied() ? 'Copied!' : 'Copy' }}</button>
    </div>
  `,
  styles: `
    .code-snippet {
      position: relative;
      background: var(--input, #1d2129);
      border: 1px solid var(--line, #262a31);
      border-radius: 8px;
    }
    pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      white-space: pre;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--panel, #171a20);
      color: inherit;
      border: 1px solid var(--line, #262a31);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
    }
  `,
})
export class CodeSnippet {
  code = input.required<string>();
  protected readonly copied = signal(false);

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — no-op, same as the library's own detailsCopyButton().
    }
  }
}
