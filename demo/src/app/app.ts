import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { GithubStatsService } from './services/github-stats';
import { SectionService } from './services/section';
import { VersionService } from './services/version';
import { formatCompactCount, formatRelativeTime } from './shared/format';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  protected readonly githubStats = inject(GithubStatsService);
  protected readonly versionService = inject(VersionService);
  protected readonly section = inject(SectionService);

  protected readonly formatCompactCount = formatCompactCount;
  protected readonly formatRelativeTime = formatRelativeTime;

  constructor() {
    // Resets scroll on every plain (non-fragment) navigation, so e.g. leaving Playground
    // scrolled down and clicking "Changelog" doesn't land already scrolled into that
    // page. Navigations that carry a fragment (in-page "#id" links) are left alone -
    // those scroll themselves, either via the browser's own anchor handling or, on
    // Playground, the manual fragment effect in playground.ts.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (!event.urlAfterRedirects.includes('#')) {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
  }

  /**
   * routerLink alone falls short for these two: navigating "/playground" with no
   * fragment does clear an existing "#examples" fragment, but nothing then scrolls the
   * page back up - and re-clicking "Examples" while the fragment is already "examples"
   * is a same-URL navigation the router ignores outright, so it wouldn't re-scroll
   * either. Both links are already on the Playground route, so just scroll directly
   * instead of relying on a fragment change to fire the router's own navigation events.
   */
  protected scrollToPlaygroundTop(event: MouseEvent): void {
    if (!this.isPlainClick(event) || !this.router.url.startsWith('/playground')) return;
    document.getElementById('playground-top')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    this.section.activeSection.set('playground');
  }

  protected scrollToExamples(event: MouseEvent): void {
    if (!this.isPlainClick(event) || !this.router.url.startsWith('/playground')) return;
    document.getElementById('examples')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  private isPlainClick(event: MouseEvent): boolean {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }
}
