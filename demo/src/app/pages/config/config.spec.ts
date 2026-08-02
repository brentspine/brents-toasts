import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { toasts } from 'brents-toasts';
import { beforeEach, describe, expect, it } from 'vitest';
import { Config } from './config';

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
  });

  it('apply() calls toasts.configure() with the current form values', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('duration', 7000);
    component.updateForm('maxToasts', 2);

    component.apply();

    expect(toasts.config.duration).toBe(7000);
    expect(toasts.config.maxToasts).toBe(2);
  });

  it('apply() maps locale "auto" to undefined so the library auto-detects', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('locale', 'auto');

    component.apply();

    expect(toasts.config.locale).toBeUndefined();
  });

  it('apply() rejects invalid theme JSON without throwing, and reports it', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('themeJson', '{ not valid json');

    expect(() => component.apply()).not.toThrow();
    expect(component.themeError()).toBeTruthy();
  });

  it('apply() parses valid theme JSON and passes it through', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('themeJson', '{ "background": "#111111" }');

    component.apply();

    expect(component.themeError()).toBeNull();
    expect(toasts.config.theme?.background).toBe('#111111');
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
    component.apply();
    expect(toasts.config.duration).toBe(9000);

    component.resetConfig();
    const findButton = (label: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('.bt-toast-actions button')).find((b) => b.textContent === label);

    findButton('Reset')!.click();
    findButton('Yes')!.click();

    expect(component.form().duration).toBe(3000);
    expect(toasts.config.duration).toBe(3000);
    toasts.removeAllToasts();
  });

  it('persists form changes to localStorage and restores them on next load', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.updateForm('duration', 9000);
    fixture.detectChanges();

    expect(JSON.parse(localStorage.getItem('bt-demo:config-form')!).duration).toBe(9000);

    TestBed.resetTestingModule();
    const secondFixture = await createComponent();
    expect(secondFixture.componentInstance.form().duration).toBe(9000);
    // Re-applied automatically on construction, without needing another click of Apply.
    expect(toasts.config.duration).toBe(9000);
  });
});
