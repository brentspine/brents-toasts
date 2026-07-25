import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CodeSnippet } from '../../shared/code-snippet';
import { OptionsDataService } from '../../services/options-data';
import { VersionService } from '../../services/version';

@Component({
  selector: 'app-install',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeSnippet, RouterLink],
  templateUrl: './install.html',
  styleUrl: './install.css',
})
export class Install {
  private readonly optionsData = inject(OptionsDataService);
  private readonly versionService = inject(VersionService);

  private readonly snippets = this.optionsData.data.install;

  protected readonly npmSnippet = computed(() => this.snippets.npm);
  protected readonly cdnSnippet = computed(() => this.withVersion(this.snippets.cdn));

  private withVersion(template: string): string {
    return template.replaceAll('{{VERSION}}', this.versionService.version());
  }
}
