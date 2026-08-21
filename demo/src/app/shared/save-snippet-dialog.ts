import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, output, signal, viewChild } from '@angular/core';

/**
 * The naming modal for the Playground's "Save" button / Ctrl+S (see
 * https://github.com/brentspine/brents-toasts/issues/121). Purely a name prompt - the caller
 * (`Playground`) owns the actual snippet code and persistence via `SnippetsService`.
 */
@Component({
  selector: 'app-save-snippet-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="panel" role="dialog" aria-modal="true" aria-label="Save snippet" (click)="$event.stopPropagation()">
        <header>
          <h3>Save snippet</h3>
          <button type="button" class="close" (click)="closed.emit()" aria-label="Close">&times;</button>
        </header>
        <label for="snippet-name">Name</label>
        <input
          #nameInput
          id="snippet-name"
          type="text"
          [value]="name()"
          (input)="onNameInput($event)"
          (keydown.enter)="confirm()"
          placeholder="e.g. Retry with exponential backoff"
          autocomplete="off"
        />
        @if (isOverwrite()) {
          <p class="hint">A snippet named "{{ trimmedName() }}" already exists - saving will overwrite it.</p>
        }
        <div class="actions">
          <button type="button" class="cancel" (click)="closed.emit()">Cancel</button>
          <button type="button" class="confirm" [disabled]="!trimmedName()" (click)="confirm()">Save</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }
    .panel {
      background: var(--panel, #171a20);
      border: 1px solid var(--line, #262a31);
      border-radius: 10px;
      padding: 20px;
      max-width: 420px;
      width: 100%;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    h3 {
      margin: 0;
    }
    .close {
      background: none;
      border: none;
      color: inherit;
      font-size: 22px;
      line-height: 1;
    }
    label {
      display: block;
      color: var(--muted, #9aa0a8);
      font-size: 13px;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      background: var(--input, #1d2129);
      border: 1px solid var(--line, #262a31);
      border-radius: 6px;
      color: var(--fg, #f2f3f5);
      padding: 8px 10px;
      font-size: 14px;
    }
    .hint {
      color: var(--warning, #ffc531);
      font-size: 12px;
      margin: 8px 0 0;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .actions button {
      background: var(--input, #1d2129);
      border: 1px solid var(--line, #262a31);
      border-radius: 6px;
      color: var(--fg, #f2f3f5);
      padding: 6px 14px;
    }
    .actions .confirm {
      background: var(--info, #28a6f5);
      border-color: var(--info, #28a6f5);
      color: #05111a;
      font-weight: 600;
    }
    .actions .confirm:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
})
export class SaveSnippetDialog {
  /** Existing saved snippet names, so the dialog can warn before a same-name save overwrites one. */
  readonly existingNames = input<string[]>([]);
  readonly save = output<string>();
  readonly closed = output<void>();

  readonly name = signal('');
  readonly trimmedName = computed(() => this.name().trim());
  readonly isOverwrite = computed(() => this.existingNames().includes(this.trimmedName()));

  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    afterNextRender(() => this.nameInput().nativeElement.focus());
  }

  onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  confirm(): void {
    const trimmed = this.trimmedName();
    if (!trimmed) return;
    this.save.emit(trimmed);
  }
}
