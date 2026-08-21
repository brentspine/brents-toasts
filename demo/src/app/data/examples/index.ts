import examplesMeta from './examples.json';
import type { PlaygroundExample, PlaygroundExampleMeta } from '../options.types';

import positions from './positions.example.txt';
import confirm from './confirm.example.txt';
import confirmProgress from './confirm-progress.example.txt';
import stepButton from './step-button.example.txt';
import details from './details.example.txt';
import progress from './progress.example.txt';
import promise from './promise.example.txt';
import playTransition from './play-transition.example.txt';
import reverseOrder from './reverse-order.example.txt';
import theme from './theme.example.txt';
import icons from './icons.example.txt';
import htmlContent from './html-content.example.txt';
import bossFight from './boss-fight.example.txt';
import localization from './localization.example.txt';
import layouts from './layouts.example.txt';
import timers from './timers.example.txt';
import incrementalUpdates from './incremental-updates.example.txt';
import bulkActions from './bulk-actions.example.txt';
import events from './events.example.txt';

/**
 * Maps each example's `id` (from examples.json) to its runnable source, kept in its own
 * `<id>.example.txt` file so it's real, multi-line JS rather than an escaped one-line
 * string. Each import must be listed explicitly (no directory glob) since this has to
 * work under esbuild's static bundling, not just Vite's dev-time glob imports. The
 * `.txt` extension (not `.js`) is deliberate - see angular.json's `loader` option and
 * demo/vitest.config.ts, which both load it as raw text; `ng test`'s Vitest pipeline
 * treats a real `.js` extension as a code dependency to prebundle instead of source to
 * transform, which breaks this.
 */
const EXAMPLE_CODE: Record<string, string> = {
    positions,
    confirm,
    'confirm-progress': confirmProgress,
    'step-button': stepButton,
    details,
    progress,
    promise,
    'play-transition': playTransition,
    'reverse-order': reverseOrder,
    theme,
    icons,
    'html-content': htmlContent,
    'boss-fight': bossFight,
    localization,
    layouts,
    timers,
    'incremental-updates': incrementalUpdates,
    'bulk-actions': bulkActions,
    events,
};

/** Curated cards shown in the Playground's "Browse examples" section, metadata + code merged. */
export const EXAMPLES: PlaygroundExample[] = (examplesMeta as PlaygroundExampleMeta[]).map((meta) => {
    const code = EXAMPLE_CODE[meta.id];
    if (!code) throw new Error(`No <id>.example.txt file found for example "${meta.id}"`);
    return { ...meta, code };
});
