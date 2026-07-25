import { Injectable, computed } from '@angular/core';
import { httpResource } from '@angular/common/http';

interface VersionAsset {
  version: string;
}

/**
 * Reads the build-time-generated `version.json` asset (rewritten by the release
 * workflow right before `ng build`; a "dev" placeholder is committed for local
 * `ng serve`). See CLAUDE.md's "Demo" section.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly resource = httpResource<VersionAsset>(() => 'version.json', {
    defaultValue: { version: 'dev' },
  });

  // .value() throws while the resource is in an error state — guard with
  // hasValue() so a failed fetch (offline, blocked request, ...) falls back
  // to "dev" instead of crashing every template that reads this signal.
  readonly version = computed(() => (this.resource.hasValue() ? this.resource.value().version : 'dev'));
}
