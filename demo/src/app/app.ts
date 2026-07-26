import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
  protected readonly githubStats = inject(GithubStatsService);
  protected readonly versionService = inject(VersionService);
  protected readonly section = inject(SectionService);

  protected readonly formatCompactCount = formatCompactCount;
  protected readonly formatRelativeTime = formatRelativeTime;
}
