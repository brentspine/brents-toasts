import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
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
});
