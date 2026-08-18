import { ChangeDetectionStrategy, Component, computed, effect, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { MarkdownView } from '../../shared/markdown-view';
import { DOCS_TOPICS } from '../../data/docs-topics';

const RAW_BASE = 'https://raw.githubusercontent.com/Brentspine/brents-toasts/main/docs/guide';

async function fetchText(url: string, abortSignal: AbortSignal): Promise<string | null> {
  const res = await fetch(url, { signal: abortSignal });
  if (!res.ok) return null;
  return res.text();
}

@Component({
  selector: 'app-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, MarkdownView],
  templateUrl: './docs.html',
  styleUrl: './docs.css',
})
export class Docs {
  readonly topics = DOCS_TOPICS;

  private readonly slugParam = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  readonly slug = computed(() => {
    const requested = this.slugParam().get('topic');
    return this.topics.some((t) => t.slug === requested) ? requested! : this.topics[0].slug;
  });

  readonly topic = computed(() => this.topics.find((t) => t.slug === this.slug()) ?? this.topics[0]);

  readonly page = resource({
    params: () => ({ slug: this.slug() }),
    loader: ({ params, abortSignal }) => fetchText(`${RAW_BASE}/${params.slug}.md`, abortSignal),
  });

  constructor() {
    // Waits on page.value(), not just the fragment: the markdown (and the heading it needs to
    // scroll to) hasn't rendered yet on the very first tick after navigating here, since it's
    // still in flight from RAW_BASE. Re-runs once the fetch resolves and the content (with its
    // heading ids, see MarkdownView's headingId()) is actually in the DOM.
    effect(() => {
      const id = this.fragment();
      const md = this.page.value();
      if (!id || !md) return;
      // The signal update this effect reacts to (page.value() resolving) hasn't necessarily
      // been painted into the DOM yet at the point an effect callback runs - MarkdownView's
      // own @if/@for rendering for the new content is still pending. Deferring one microtask
      // lets that rendering flush first, so the target heading actually exists to scroll to.
      queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' }));
    });
  }
}
