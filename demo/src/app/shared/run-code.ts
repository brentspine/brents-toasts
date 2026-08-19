import {
  toasts,
  Toasts,
  ToastBuilder,
  ToastColor,
  ToastSeverity,
  ToastPosition,
  ToastAnimation,
  ToastLayout,
  ToastModifier,
  ToastTransition,
  ToastLocales,
  ToastQuickActions,
  QuickActionLocales,
  registerToastAnimation,
  registerToastLayout,
  registerToastModifier,
  registerToastTransition,
} from 'brents-toasts';

/** localStorage key the Playground reads its editor contents from on load - shared so other pages (e.g. Docs) can seed it before navigating there. */
export const PLAYGROUND_STORAGE_KEY = 'bt-demo:playground-code';

const SANDBOX_PARAM_NAMES = [
  'toasts',
  'Toasts',
  'ToastBuilder',
  'ToastColor',
  'ToastSeverity',
  'ToastPosition',
  'ToastAnimation',
  'ToastLayout',
  'ToastModifier',
  'ToastTransition',
  'ToastLocales',
  'ToastQuickActions',
  'QuickActionLocales',
  'registerToastAnimation',
  'registerToastLayout',
  'registerToastModifier',
  'registerToastTransition',
] as const;

const SANDBOX_PARAM_VALUES = [
  toasts,
  Toasts,
  ToastBuilder,
  ToastColor,
  ToastSeverity,
  ToastPosition,
  ToastAnimation,
  ToastLayout,
  ToastModifier,
  ToastTransition,
  ToastLocales,
  ToastQuickActions,
  QuickActionLocales,
  registerToastAnimation,
  registerToastLayout,
  registerToastModifier,
  registerToastTransition,
];

/**
 * `docs/guide/*.md` examples are real prose, not written to be pasted in isolation - several
 * lean on an app-supplied function (`deleteFile`, `uploadFile`, ...) purely to read naturally
 * ("call your own delete logic here"). Rather than invent fake business logic inside the guide
 * itself (which would misrepresent what's actually part of the library), the demo sandbox alone
 * supplies harmless stand-ins so those specific snippets can be marked ` live` in the markdown
 * source and actually run here. This is demo-only scaffolding - none of these names are part of
 * `brents-toasts` itself.
 */
const DEMO_STUB_NAMES = [
  'restore',
  'deleteSelectedItems',
  'deleteFile',
  'isValid',
  'publish',
  'doDelete',
  'retryPayment',
  'deletedItems',
  'uploadFile',
  'file',
  'savePost',
  'post',
] as const;

function fakeAsync<T>(value: T, delayMs = 500): () => Promise<T> {
  return () => new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}

const DEMO_STUB_VALUES = [
  () => {}, // restore
  fakeAsync(undefined, 500), // deleteSelectedItems
  () => {}, // deleteFile
  () => true, // isValid
  () => {}, // publish
  () => {}, // doDelete
  () => {}, // retryPayment
  [{ name: 'Report.pdf' }, { name: 'Photo.png' }, { name: 'Notes.txt' }], // deletedItems
  (_file?: unknown, options?: { onProgress?: (fraction: number) => void }) =>
    new Promise<void>((resolve) => {
      let progress = 0;
      const tick = () => {
        progress = Math.min(1, progress + 0.25);
        options?.onProgress?.(progress);
        if (progress >= 1) {
          resolve();
          return;
        }
        setTimeout(tick, 300);
      };
      setTimeout(tick, 300);
    }), // uploadFile
  { name: 'demo-file.txt' }, // file
  fakeAsync(undefined, 600), // savePost
  { title: 'Demo post' }, // post
];

/**
 * `docs/guide/*.md` shows real import syntax (`import { X } from 'brents-toasts';`) since
 * that's what a reader actually types in their own project - but every name it could import is
 * already provided as a bare identifier by the sandbox above, so the import itself is a no-op
 * here and safe to strip before executing (it would otherwise throw "Cannot use import
 * statement outside a module", since the snippet runs as a plain script, not an ES module).
 */
const IMPORT_LINE = /^\s*import\s*\{[^}]*\}\s*from\s*['"]brents-toasts['"]\s*;?\s*$/gm;

/**
 * Runs a snippet of user-facing example code (Playground, and Docs' runnable code blocks)
 * against the real library, with the same names `brents-toasts`' own named exports use
 * available as bare identifiers - no import statement needed at the call site. Keep this
 * param list in sync with `src/index.ts`'s runtime exports, same as `code-editor.ts`'s
 * Monaco ambient lib comment already asks for.
 */
export function runSandboxedCode(code: string): string | null {
  try {
    const fn = new Function(...SANDBOX_PARAM_NAMES, ...DEMO_STUB_NAMES, code.replace(IMPORT_LINE, ''));
    fn(...SANDBOX_PARAM_VALUES, ...DEMO_STUB_VALUES);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
