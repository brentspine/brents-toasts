import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { TypeSpec } from '../data/options.types';

@Component({
  selector: 'app-type-spec-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div
        class="panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="typeName()"
        (click)="$event.stopPropagation()"
      >
        <header>
          <h3>{{ typeName() }}</h3>
          <button type="button" class="close" (click)="closed.emit()" aria-label="Close">&times;</button>
        </header>
        @let currentSpec = spec();
        <p class="description">{{ currentSpec.description }}</p>

        @if (currentSpec.kind === 'enum') {
          <table>
            <thead>
              <tr>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              @for (v of currentSpec.values; track v.value) {
                <tr>
                  <td><code>{{ v.value }}</code></td>
                  <td>{{ v.description }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              @for (f of currentSpec.fields; track f.name) {
                <tr>
                  <td><code>{{ f.name }}</code></td>
                  <td><code>{{ f.type }}</code></td>
                  <td>{{ f.default ?? '-' }}</td>
                  <td>{{ f.description }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
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
      max-width: 600px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h3 {
      margin: 0;
      font-family: ui-monospace, monospace;
    }
    .close {
      background: none;
      border: none;
      color: inherit;
      font-size: 22px;
      line-height: 1;
    }
    .description {
      color: var(--muted, #9aa0a8);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th,
    td {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid var(--line, #262a31);
      vertical-align: top;
    }
  `,
})
export class TypeSpecPanel {
  typeName = input.required<string>();
  spec = input.required<TypeSpec>();
  closed = output<void>();
}
