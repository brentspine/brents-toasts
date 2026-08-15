import { Injectable, computed } from '@angular/core';
import { httpResource } from '@angular/common/http';

export interface PagesRepoStats {
  pushed_at: string;
  html_url: string;
}

const PAGES_REPO_API_URL = 'https://api.github.com/repos/Brentspine/brentspine.github.io';

/**
 * GitHub stats for `brentspine.github.io` - the separate repo the live demo is deployed
 * to (see .github/workflows/deploy-demo.yml) - used to link to it and show when it was
 * last pushed to (footer).
 */
@Injectable({ providedIn: 'root' })
export class PagesStatsService {
  private readonly resource = httpResource<PagesRepoStats>(() => PAGES_REPO_API_URL);

  // .value() throws while the resource is in an error state (e.g. the
  // unauthenticated GitHub API's 60 req/hour rate limit), expose a safe
  // computed instead so the footer degrades to omitting the link rather than crashing.
  readonly repo = computed(() => (this.resource.hasValue() ? this.resource.value() : undefined));
}
