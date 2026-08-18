import { afterEach, describe, expect, it } from 'vitest';
import { runSandboxedCode } from './run-code';

describe('runSandboxedCode', () => {
  afterEach(() => {
    document.querySelectorAll('.bt-toast').forEach((el) => el.remove());
  });

  it('runs a snippet that uses the real library exports as bare identifiers, with no import needed', () => {
    expect(runSandboxedCode("toasts.showToast('Hi', { duration: 0 });")).toBeNull();
    expect(document.querySelector('.bt-toast')).not.toBeNull();
  });

  it('returns the error message instead of throwing when the snippet is broken', () => {
    const error = runSandboxedCode('this is not valid js(');
    expect(error).toBeTruthy();
  });

  it('returns the thrown error message when the snippet references an undefined helper', () => {
    const error = runSandboxedCode('someUndefinedHelperFunction();');
    expect(error).toContain('someUndefinedHelperFunction');
  });

  it('strips a real `import { X } from \'brents-toasts\';` line instead of throwing, since every name it could import is already a bare identifier here', () => {
    const code = "import { toasts, ToastColor } from 'brents-toasts';\ntoasts.showToast('Hi', { duration: 0 });";
    expect(runSandboxedCode(code)).toBeNull();
    expect(document.querySelector('.bt-toast')).not.toBeNull();
  });

  it('provides demo-only stand-ins for illustrative helper names docs/guide/*.md snippets call (e.g. deleteFile, restore)', () => {
    expect(runSandboxedCode('deleteFile(); restore(); doDelete();')).toBeNull();
  });
});
