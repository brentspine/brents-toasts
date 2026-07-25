import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseChangelogMarkdown } from './markdown';

@Component({
  selector: 'app-markdown-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (block of blocks(); track $index) {
      @switch (block.type) {
        @case ('heading') {
          @if (block.level === 3) {
            <h3>
              @for (seg of block.segments; track $index) {
                @if (seg.code) {
                  <code>{{ seg.text }}</code>
                } @else {
                  {{ seg.text }}
                }
              }
            </h3>
          } @else {
            <h4>
              @for (seg of block.segments; track $index) {
                @if (seg.code) {
                  <code>{{ seg.text }}</code>
                } @else {
                  {{ seg.text }}
                }
              }
            </h4>
          }
        }
        @case ('list') {
          <ul>
            @for (item of block.items; track $index) {
              <li>
                @for (seg of item; track $index) {
                  @if (seg.code) {
                    <code>{{ seg.text }}</code>
                  } @else {
                    {{ seg.text }}
                  }
                }
              </li>
            }
          </ul>
        }
        @case ('paragraph') {
          <p>
            @for (seg of block.segments; track $index) {
              @if (seg.code) {
                <code>{{ seg.text }}</code>
              } @else {
                {{ seg.text }}
              }
            }
          </p>
        }
      }
    }
  `,
})
export class MarkdownView {
  markdown = input.required<string>();
  protected readonly blocks = computed(() => parseChangelogMarkdown(this.markdown()));
}
