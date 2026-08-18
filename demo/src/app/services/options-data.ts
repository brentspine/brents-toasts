import { Injectable } from '@angular/core';
import optionsJson from '../data/options.json';
import type { OptionsData, PlaygroundExample } from '../data/options.types';
import { EXAMPLES } from '../data/examples';

/**
 * Thin wrapper around the canonical options.json data file, the single source
 * the whole demo builds itself from. See demo/src/app/data/options.types.ts.
 *
 * Playground examples are assembled separately (see demo/src/app/data/examples/index.ts)
 * from their own per-example files rather than living in options.json itself.
 */
@Injectable({ providedIn: 'root' })
export class OptionsDataService {
  readonly data: OptionsData = optionsJson as OptionsData;
  readonly examples: PlaygroundExample[] = EXAMPLES;
}
