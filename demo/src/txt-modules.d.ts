/**
 * Ambient type for any `.txt` import, matching angular.json's esbuild `loader: { ".txt": "text" }`
 * option (and vitest.config.ts's equivalent transform for `ng test`) - both load a `.txt` file as
 * its raw text content, default-exported as a string. Covers `demo/src/app/data/examples/*.example.txt`
 * (see examples/index.ts) and `demo/src/app/shared/toasts-lib.generated.txt` (see code-editor.ts).
 */
declare module '*.txt' {
  const content: string;
  export default content;
}
