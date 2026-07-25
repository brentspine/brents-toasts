import { Injectable } from '@angular/core';
import optionsJson from '../data/options.json';
import type { OptionsData } from '../data/options.types';

/**
 * Thin wrapper around the canonical options.json data file, the single source
 * the whole demo builds itself from. See demo/src/app/data/options.types.ts.
 */
@Injectable({ providedIn: 'root' })
export class OptionsDataService {
  readonly data: OptionsData = optionsJson as OptionsData;
}
