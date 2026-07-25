import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { MarkdownView } from '../../shared/markdown-view';
import { VersionService } from '../../services/version';
import type { OptionsData } from '../../data/options.types';

const RAW_BASE = 'https://raw.githubusercontent.com/Brentspine/brents-toasts/main';

async function fetchText(url: string, abortSignal: AbortSignal): Promise<string | null> {
  const res = await fetch(url, { signal: abortSignal });
  if (!res.ok) return null;
  return res.text();
}

async function fetchJson<T>(url: string, abortSignal: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal: abortSignal });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

@Component({
  selector: 'app-changelog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownView],
  templateUrl: './changelog.html',
  styleUrl: './changelog.css',
})
export class ChangelogPage {
  private readonly versionService = inject(VersionService);

  readonly selectedVersion = signal<string | null>(null);

  readonly latestChangelog = resource({
    params: () => ({ version: this.versionService.version() }),
    loader: ({ params, abortSignal }) => fetchText(`${RAW_BASE}/docs/changelogs/${params.version}.md`, abortSignal),
  });

  readonly versionsList = resource({
    loader: async ({ abortSignal }) => (await fetchJson<string[]>('versions/versions.json', abortSignal)) ?? [],
  });

  readonly historicalOptions = resource({
    params: () => (this.selectedVersion() ? { version: this.selectedVersion()! } : undefined),
    loader: ({ params, abortSignal }) =>
      fetchJson<OptionsData>(`${RAW_BASE}/docs/options/${params.version}.json`, abortSignal),
  });

  readonly historicalChangelog = resource({
    params: () => (this.selectedVersion() ? { version: this.selectedVersion()! } : undefined),
    loader: ({ params, abortSignal }) => fetchText(`${RAW_BASE}/docs/changelogs/${params.version}.md`, abortSignal),
  });

  selectVersion(version: string): void {
    this.selectedVersion.set(this.selectedVersion() === version ? null : version);
  }

  legacyVersionUrl(version: string): string {
    return `versions/${version}/index.html`;
  }
}
