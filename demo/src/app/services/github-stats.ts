import { Injectable, computed } from '@angular/core';
import { httpResource } from '@angular/common/http';

export interface GithubRepoStats {
  stargazers_count: number;
  open_issues_count: number;
  forks_count: number;
  watchers_count: number;
  pushed_at: string;
  html_url: string;
  owner: { login: string; html_url: string; avatar_url: string };
}

const REPO_API_URL = 'https://api.github.com/repos/Brentspine/brents-toasts';

/** GitHub repo stats (stars/issues/forks/watchers/last commit) for the header badge + footer. */
@Injectable({ providedIn: 'root' })
export class GithubStatsService {
  private readonly resource = httpResource<GithubRepoStats>(() => REPO_API_URL);

  // .value() throws while the resource is in an error state (e.g. the
  // unauthenticated GitHub API's 60 req/hour rate limit), expose a safe
  // computed instead so the header/footer degrade to "-" rather than crashing.
  readonly repo = computed(() => (this.resource.hasValue() ? this.resource.value() : undefined));
}
