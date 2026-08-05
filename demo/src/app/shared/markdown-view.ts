import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseChangelogMarkdown } from './markdown';

@Component({
  selector: 'app-markdown-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #segment let-seg>
      @if (seg.image) {
        @if (seg.link) {
          <a [href]="seg.link" target="_blank" rel="noopener noreferrer"
            ><img [src]="seg.image" [alt]="seg.text"
          /></a>
        } @else {
          <img [src]="seg.image" [alt]="seg.text" />
        }
      } @else if (seg.link) {
        <a [href]="seg.link" target="_blank" rel="noopener noreferrer">{{ seg.text }}</a>
      } @else if (seg.code) {
        <code>{{ seg.text }}</code>
      } @else {
        {{ seg.text }}
      }
    </ng-template>

    @for (block of blocks(); track $index) {
      @switch (block.type) {
        @case ('heading') {
          @if (block.level === 3) {
            <h3>
              @for (seg of block.segments; track $index) {
                <ng-container [ngTemplateOutlet]="segment" [ngTemplateOutletContext]="{ $implicit: seg }" />
              }
            </h3>
          } @else {
            <h4>
              @for (seg of block.segments; track $index) {
                <ng-container [ngTemplateOutlet]="segment" [ngTemplateOutletContext]="{ $implicit: seg }" />
              }
            </h4>
          }
        }
        @case ('list') {
          <ul>
            @for (item of block.items; track $index) {
              <li>
                @for (seg of item; track $index) {
                  <ng-container [ngTemplateOutlet]="segment" [ngTemplateOutletContext]="{ $implicit: seg }" />
                }
              </li>
            }
          </ul>
        }
        @case ('paragraph') {
          <p>
            @for (seg of block.segments; track $index) {
              <ng-container [ngTemplateOutlet]="segment" [ngTemplateOutletContext]="{ $implicit: seg }" />
            }
          </p>
        }
      }
    }
  `,
  imports: [NgTemplateOutlet],
  styles: [
    `
      :host img {
        max-width: 100%;
        vertical-align: middle;
      }
    `,
  ],
})
export class MarkdownView {
  markdown = input.required<string>();
  protected readonly blocks = computed(() => parseChangelogMarkdown(this.markdown()));
}
