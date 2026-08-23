import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { toasts } from 'brents-toasts';
import { beforeEach, describe, expect, it } from 'vitest';
import { Config, getReducedMotionOverride, setReducedMotionOverride } from './config';

describe('Config', () => {
  async function createComponent() {
    await TestBed.configureTestingModule({ imports: [Config], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Config);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    toasts.positionConfig.clear();
    localStorage.clear();
  });

  it('lists every configOptions row', async () => {
    const fixture = await createComponent();
    const names = fixture.componentInstance.configOptions.map((o) => o.name);
    expect(names).toContain('maxToasts');
    expect(names).toContain('locale');
    expect(names).toContain('gap');
    expect(names).toContain('zIndex');
    expect(names).toContain('minVisibleDuration');
    expect(names).toContain('theme');
  });

  it('every configOptions row has a form control, either scalar or JSON', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const scalarNames = new Set(component.scalarOptions.map((o) => o.name));
    const jsonNames = new Set(component.jsonOptions.map((o) => o.name));
    for (const opt of component.configOptions) {
      expect(scalarNames.has(opt.name) || jsonNames.has(opt.name)).toBe(true);
    }
  });

  it('apply() calls toasts.configure() with the current form values, covering fields beyond the old hardcoded set', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('duration', 7000);
    component.updateForm('maxToasts', 2);
    component.updateForm('gap', 20);
    component.updateForm('zIndex', 999);
    component.updateForm('minVisibleDuration', 1500);
    component.updateForm('animation', 'fade');
    component.updateForm('responsiveBreakpoint', 600);
    component.updateForm('promiseTimeout', 5000);
    component.updateForm('layout', 'prominent');
    component.updateForm('titleMode', 'inline');

    component.apply();

    expect(toasts.config.duration).toBe(7000);
    expect(toasts.config.maxToasts).toBe(2);
    expect(toasts.config.gap).toBe(20);
    expect(toasts.config.zIndex).toBe(999);
    expect(toasts.config.minVisibleDuration).toBe(1500);
    expect(toasts.config.animation).toBe('fade');
    expect(toasts.config.responsiveBreakpoint).toBe(600);
    expect(toasts.config.promiseTimeout).toBe(5000);
    expect(toasts.config.layout).toBe('prominent');
    expect(toasts.config.titleMode).toBe('inline');

    toasts.configure({ gap: 8, zIndex: 10000, animation: 'slide', layout: 'default', titleMode: 'stacked' });
  });

  it('apply() maps locale "auto" to undefined so the library auto-detects', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('locale', 'auto');

    component.apply();

    expect(toasts.config.locale).toBeUndefined();
  });

  it('apply() maps reducedMotion "auto" to undefined so the library auto-detects', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('reducedMotion', 'auto');

    component.apply();

    expect(toasts.config.reducedMotion).toBeUndefined();
  });

  it('apply() maps reducedMotion "true"/"false" to real booleans', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.updateForm('reducedMotion', 'true');
    component.apply();
    expect(toasts.config.reducedMotion).toBe(true);

    component.updateForm('reducedMotion', 'false');
    component.apply();
    expect(toasts.config.reducedMotion).toBe(false);

    toasts.configure({ reducedMotion: undefined });
  });

  it('apply() rejects invalid JSON in an advanced field without throwing, and reports it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateJsonField('theme', '{ not valid json');

    expect(() => component.apply()).not.toThrow();
    expect(component.jsonErrors()['theme']).toBeTruthy();
  });

  it('apply() parses valid JSON in an advanced field and passes it through', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateJsonField('theme', '{ "background": "#111111" }');

    component.apply();

    expect(component.jsonErrors()['theme']).toBeUndefined();
    expect(toasts.config.theme?.background).toBe('#111111');
  });

  it('apply() parses a JSON array field (modifiers)', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateJsonField('modifiers', '["compact", "wide"]');

    component.apply();

    expect(toasts.config.modifiers).toEqual(['compact', 'wide']);
    toasts.configure({ modifiers: [] });
  });

  it('apply() passes injectStyles through, and only includes it in the snippet when false', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.apply();
    expect(toasts.config.injectStyles).toBe(true);
    expect(component.appliedSnippet()).not.toContain('injectStyles: false');

    component.updateForm('injectStyles', false);
    component.apply();
    expect(toasts.config.injectStyles).toBe(false);
    expect(component.appliedSnippet()).toContain('injectStyles: false,');

    toasts.configure({ injectStyles: true });
  });

  it('apply() passes injectLayoutStyles through independently of injectStyles', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.apply();
    expect(toasts.config.injectLayoutStyles).toBe(true);

    component.updateForm('injectLayoutStyles', false);
    component.apply();
    expect(toasts.config.injectLayoutStyles).toBe(false);
    expect(toasts.config.injectStyles).toBe(true);
    expect(component.appliedSnippet()).toContain('injectLayoutStyles: false,');

    toasts.configure({ injectLayoutStyles: true });
  });

  it('applyPositionOverride() writes to toasts.positionConfig and clearPositionOverride() removes it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.overridePosition.set('top-right');
    component.overrideMaxToasts.set(2);
    component.overrideEvictOldest.set(false);

    component.applyPositionOverride();
    expect(toasts.positionConfig.get('top-right')).toEqual({ maxToasts: 2, evictOldest: false });
    expect(component.positionOverrideEntries()).toEqual([['top-right', { maxToasts: 2, evictOldest: false }]]);

    component.clearPositionOverride('top-right');
    expect(toasts.positionConfig.has('top-right')).toBe(false);
    expect(component.positionOverrideEntries()).toEqual([]);
  });

  it('resetConfig() shows a confirm toast; confirming it resets the form and re-applies defaults', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('duration', 9000);
    component.updateJsonField('theme', '{ "background": "#111111" }');
    component.apply();
    expect(toasts.config.duration).toBe(9000);

    component.resetConfig();
    const findButton = (label: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('.bt-toast-actions button')).find((b) => b.textContent === label);

    findButton('Reset')!.click();
    findButton('Yes')!.click();

    expect(component.form()['duration']).toBe(3000);
    expect(component.jsonFields()['theme']).toBe('');
    expect(toasts.config.duration).toBe(3000);
    expect(toasts.config.theme).toBeUndefined();
    toasts.removeAllToasts();
  });

  it('persists form and JSON field changes to localStorage and restores them on next load', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('duration', 9000);
    component.updateJsonField('theme', '{ "background": "#111111" }');
    fixture.detectChanges();

    const stored = JSON.parse(localStorage.getItem('bt-demo:config-form')!);
    expect(stored.form.duration).toBe(9000);
    expect(stored.json.theme).toBe('{ "background": "#111111" }');

    TestBed.resetTestingModule();
    const secondFixture = await createComponent();
    expect(secondFixture.componentInstance.form()['duration']).toBe(9000);
    expect(secondFixture.componentInstance.jsonFields()['theme']).toBe('{ "background": "#111111" }');
    // Re-applied automatically on construction, without needing another click of Apply.
    expect(toasts.config.duration).toBe(9000);
    expect(toasts.config.theme?.background).toBe('#111111');
  });

  it('getReducedMotionOverride() reads undefined by default and reflects setReducedMotionOverride(), applying it to toasts.config too', async () => {
    expect(getReducedMotionOverride()).toBeUndefined();

    setReducedMotionOverride(false);
    expect(getReducedMotionOverride()).toBe(false);
    expect(toasts.config.reducedMotion).toBe(false);

    // A Config page opened afterwards picks up the same override from storage.
    const fixture = await createComponent();
    expect(fixture.componentInstance.form()['reducedMotion']).toBe('false');

    toasts.configure({ reducedMotion: undefined });
  });

  it('search filters both the rendered fields and the reference table by name/type/description', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.search.set('gap');
    fixture.detectChanges();

    const names = component.filteredConfigOptions().map((o) => o.name);
    expect(names).toEqual(['gap']);
    expect(component.filteredScalarOptions().map((o) => o.name)).toEqual(['gap']);
    expect(component.filteredJsonOptions()).toEqual([]);
  });

  it('search matches on description text too, not just the field name', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.search.set('z-index');
    fixture.detectChanges();

    expect(component.filteredConfigOptions().map((o) => o.name)).toContain('zIndex');
  });
});
