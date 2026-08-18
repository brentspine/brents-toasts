import { defineConfig } from 'vitest/config';

/**
 * Extra Vitest config merged into `ng test`'s own (see the `runnerConfig` option on the
 * `test` architect target in angular.json). `ng build`/`ng serve` load any `.txt` file
 * (`demo/src/app/data/examples/*.example.txt`, `demo/src/app/shared/toasts-lib.generated.txt`)
 * as raw text natively via angular.json's esbuild `loader: { ".txt": "text" }` option, but
 * Vitest's own module pipeline doesn't honor that build option - this plugin gives tests the
 * same "import raw text" behavior, for any `.txt` import, matching that loader's scope exactly.
 */
function rawTextImports() {
  return {
    name: 'txt-source-to-string',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('.txt')) return null;
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  };
}

export default defineConfig({
  plugins: [rawTextImports()],
});
