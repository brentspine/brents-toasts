import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { toasts } from 'brents-toasts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReducedMotionOverride } from '../config/config';
import { Playground } from './playground';

describe('Playground', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function createComponent() {
    await TestBed.configureTestingModule({ imports: [Playground], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Playground);
    fixture.detectChanges();
    return fixture;
  }

  it('lists every toastOptions row by default', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.filteredOptions().length).toBeGreaterThan(15);
  });

  it('filters the table by search text matching the option name', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.search.set('detailsHideLabel');
    fixture.detectChanges();
    const names = component.filteredOptions().map((o) => o.name);
    expect(names).toEqual(['detailsHideLabel']);
  });

  it('search also matches on description text, not just name', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const totalCount = component.filteredOptions().length;

    component.search.set('duration');
    fixture.detectChanges();

    const names = component.filteredOptions().map((o) => o.name);
    expect(names).toContain('duration');
    expect(names.length).toBeGreaterThan(1);
    expect(names.length).toBeLessThan(totalCount);
  });

  it('search matching nothing yields an empty list, not an error', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.search.set('this-option-does-not-exist');
    fixture.detectChanges();
    expect(component.filteredOptions()).toEqual([]);
  });

  it('toggling an option appends its builder call to the generated code, toggling again removes it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const colorOption = component.filteredOptions().find((o) => o.name === 'color')!;

    expect(component.isSelected(colorOption)).toBe(false);
    expect(component.code()).not.toContain('.withColor(');

    component.toggleOption(colorOption);
    fixture.detectChanges();
    expect(component.isSelected(colorOption)).toBe(true);
    expect(component.code()).toContain('.withColor(');

    component.toggleOption(colorOption);
    fixture.detectChanges();
    expect(component.isSelected(colorOption)).toBe(false);
    expect(component.code()).not.toContain('.withColor(');
  });

  it('the generated code always ends with .show();', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const durationOption = component.filteredOptions().find((o) => o.name === 'duration')!;
    component.toggleOption(durationOption);
    fixture.detectChanges();
    expect(component.code().trim().endsWith('.show();')).toBe(true);
  });

  it('clicking a type cell opens the matching type spec, close clears it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const event = new Event('click');

    component.openType('ToastPositionValue', event);
    expect(component.selectedTypeSpec()?.description).toContain('screen edge/corner');

    component.closeType();
    expect(component.selectedTypeSpec()).toBeNull();
  });

  it('a row with no builderCall (e.g. a button-factory helper) cannot be toggled', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const opt = { ...component.filteredOptions()[0], name: 'noop', builderCall: undefined };
    component.toggleOption(opt);
    expect(component.isSelected(opt)).toBe(false);
  });

  it('run() reports a syntax error from a hand-edited snippet instead of throwing', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.code.set('this is not valid javascript {{{');
    component.run();
    expect(component.runError()).toBeTruthy();
  });

  it('selection state is derived from the code text, so a hand-edited/pasted snippet is recognized without clobbering it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const colorOption = component.filteredOptions().find((o) => o.name === 'color')!;
    const durationOption = component.filteredOptions().find((o) => o.name === 'duration')!;

    component.code.set('new ToastBuilder("Pasted!")\n  .withColor("#000000")\n  .show();');
    fixture.detectChanges();

    expect(component.isSelected(colorOption)).toBe(true);
    expect(component.isSelected(durationOption)).toBe(false);

    component.toggleOption(durationOption);
    fixture.detectChanges();

    // toggling a different row must not discard the pasted content
    expect(component.code()).toContain('Pasted!');
    expect(component.code()).toContain('.withColor("#000000")');
    expect(component.isSelected(durationOption)).toBe(true);
  });

  it('reset() restores the default snippet and clears any run error', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.code.set('broken {{{');
    component.run();
    expect(component.runError()).toBeTruthy();

    component.reset();

    expect(component.code()).toContain('.show();');
    expect(component.code()).not.toContain('broken');
    expect(component.runError()).toBeNull();
  });

  it('the code snippet is persisted to localStorage and restored on next load', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.code.set('new ToastBuilder("Persisted!").show();');
    fixture.detectChanges();

    expect(localStorage.getItem('bt-demo:playground-code')).toContain('Persisted!');

    TestBed.resetTestingModule();
    const secondFixture = await createComponent();
    expect(secondFixture.componentInstance.code()).toContain('Persisted!');
  });

  it('lists curated examples and tryExample() loads + runs one', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.examples.length).toBeGreaterThan(3);

    const example = component.examples[0];
    component.tryExample(example);
    fixture.detectChanges();

    expect(component.code()).toBe(example.code);
    expect(component.runError()).toBeNull();
  });

  it('surpriseMe() fires without throwing', async () => {
    const fixture = await createComponent();
    expect(() => fixture.componentInstance.surpriseMe()).not.toThrow();
  });

  it('tryExample() remembers the prior code, undoLastExample() restores it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const original = component.code();

    component.tryExample(component.examples[0]);
    fixture.detectChanges();
    expect(component.code()).toBe(component.examples[0].code);
    expect(component.previousCode()).toBe(original);

    component.undoLastExample();
    fixture.detectChanges();
    expect(component.code()).toBe(original);
    expect(component.previousCode()).toBeNull();
  });

  it('undoLastExample() is a no-op when nothing has been tried yet', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const original = component.code();
    component.undoLastExample();
    expect(component.code()).toBe(original);
  });

  it('trying a second example right after the first does not clobber the original user code, undo restores it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const original = component.code();

    component.tryExample(component.examples[0]);
    fixture.detectChanges();
    component.tryExample(component.examples[1]);
    fixture.detectChanges();

    expect(component.code()).toBe(component.examples[1].code);
    expect(component.previousCode()).toBe(original);

    component.undoLastExample();
    fixture.detectChanges();
    expect(component.code()).toBe(original);
  });

  it('copyExample() marks that example as copied, then clears it', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const example = component.examples[0];

    await component.copyExample(example);
    expect(component.copiedExampleId()).toBe(example.id);

    vi.advanceTimersByTime(1500);
    expect(component.copiedExampleId()).toBeNull();
    vi.useRealTimers();
  });

  it('flashes an example card every time it is linked to, not just the first time', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent();
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as { flashExampleHighlight(id: string): void };
    const el = document.getElementById('example-positions')!;
    expect(el).toBeTruthy();

    component.flashExampleHighlight('example-positions');
    expect(el.classList.contains('highlight')).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(el.classList.contains('highlight')).toBe(false);

    component.flashExampleHighlight('example-positions');
    expect(el.classList.contains('highlight')).toBe(true);

    fixture.nativeElement.remove();
    vi.useRealTimers();
  });

  it('onColorPicked() only updates the standalone color-picker value, never the code snippet', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const original = component.code();

    component.onColorPicked({ target: { value: '#ff0000' } } as unknown as Event);
    fixture.detectChanges();

    expect(component.colorPickerValue()).toBe('#ff0000');
    expect(component.code()).toBe(original);
    expect(component.code()).not.toContain('withColor');
  });

  it('copyPickedColor() copies the picked hex to the clipboard, then clears the copied flag', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.onColorPicked({ target: { value: '#ff0000' } } as unknown as Event);

    await component.copyPickedColor();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#ff0000');
    expect(component.colorCopied()).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(component.colorCopied()).toBe(false);
    vi.useRealTimers();
  });

  it('hasCustomConfig() is false with no saved config', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance.hasCustomConfig()).toBe(false);
  });

  it('hasCustomConfig() is true once the Config page has saved a non-default form', async () => {
    localStorage.setItem('bt-demo:config-form', JSON.stringify({ form: { duration: 9000 }, json: {} }));
    const fixture = await createComponent();
    expect(fixture.componentInstance.hasCustomConfig()).toBe(true);
  });

  it('reducedMotionHint() defaults to false when matchMedia is unavailable, rather than throwing', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance.reducedMotionHint()).toBe(false);
  });

  it('forceAnimationsOn() overrides reducedMotion to false, persists it, and hides the hint', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.reducedMotionHint.set(true); // simulate the hint already being shown

    component.forceAnimationsOn();

    expect(component.reducedMotionHint()).toBe(false);
    expect(component.hasCustomConfig()).toBe(true);
    expect(toasts.config.reducedMotion).toBe(false);
    expect(getReducedMotionOverride()).toBe(false);

    toasts.configure({ reducedMotion: undefined });
  });

  it('openSaveDialog()/closeSaveDialog() toggle saveDialogOpen()', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.saveDialogOpen()).toBe(false);

    component.openSaveDialog();
    expect(component.saveDialogOpen()).toBe(true);

    component.closeSaveDialog();
    expect(component.saveDialogOpen()).toBe(false);
  });

  it('confirmSaveSnippet() saves the current code under the given name, closes the dialog, and lists it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.code.set('new ToastBuilder("Saved!").show();');
    component.openSaveDialog();

    component.confirmSaveSnippet('My saved snippet');

    expect(component.saveDialogOpen()).toBe(false);
    expect(component.snippets().map((s) => s.name)).toEqual(['My saved snippet']);
    expect(component.snippets()[0].code).toBe('new ToastBuilder("Saved!").show();');
    toasts.removeAllToasts();
  });

  it('existingSnippetNames() reflects the currently saved snippet names', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.existingSnippetNames()).toEqual([]);

    component.confirmSaveSnippet('First');
    expect(component.existingSnippetNames()).toEqual(['First']);
    toasts.removeAllToasts();
  });

  it('trySnippet() loads and runs a saved snippet, remembering the prior code for undo', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const original = component.code();
    component.confirmSaveSnippet('Loadable');
    const snippet = component.snippets()[0];
    component.code.set('new ToastBuilder("Something else").show();');

    component.trySnippet(snippet);
    fixture.detectChanges();

    expect(component.code()).toBe(snippet.code);
    expect(component.previousCode()).toBe('new ToastBuilder("Something else").show();');
    expect(component.previousCode()).not.toBe(original);
    toasts.removeAllToasts();
  });

  it('copySnippet() marks that snippet as copied, then clears it', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.confirmSaveSnippet('Copyable');
    const snippet = component.snippets()[0];

    await component.copySnippet(snippet);
    expect(component.copiedSnippetId()).toBe(snippet.id);

    vi.advanceTimersByTime(1500);
    expect(component.copiedSnippetId()).toBeNull();
    vi.useRealTimers();
    toasts.removeAllToasts();
  });

  it('deleteSnippet() shows a confirm toast; confirming it removes the snippet', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.confirmSaveSnippet('Deletable');
    const snippet = component.snippets()[0];

    component.deleteSnippet(snippet);
    const findButton = (label: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('.bt-toast-actions button')).find(
        (b) => b.textContent === label,
      );
    findButton('Delete')!.click();
    findButton('Yes')!.click();

    expect(component.snippets()).toEqual([]);
    toasts.removeAllToasts();
  });

  it('suggestSnippet() opens a pre-filled GitHub issue for that snippet in a new tab', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.confirmSaveSnippet('Suggestable');
    const snippet = component.snippets()[0];
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    component.suggestSnippet(snippet);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(String(url)).toContain('github.com/brentspine/brents-toasts/issues/new');
    expect(String(url)).toContain('example-title=Suggestable');
    expect(target).toBe('_blank');
    openSpy.mockRestore();
    toasts.removeAllToasts();
  });

  it('onGlobalKeydown() opens the save dialog on Ctrl+S and prevents the default browser save', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const event = { ctrlKey: true, metaKey: false, key: 's', preventDefault: vi.fn() } as unknown as KeyboardEvent;

    component.onGlobalKeydown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.saveDialogOpen()).toBe(true);
  });

  it('onGlobalKeydown() ignores keys other than Ctrl/Cmd+S', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const event = { ctrlKey: true, metaKey: false, key: 'a', preventDefault: vi.fn() } as unknown as KeyboardEvent;

    component.onGlobalKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(component.saveDialogOpen()).toBe(false);
  });
});
