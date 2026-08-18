import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { SectionService } from './services/section';

describe('App', () => {
  afterEach(() => {
    // Direct assignment, not vi.spyOn: the target is already a plain stub (test-setup.ts,
    // jsdom has no native scrollIntoView), and spyOn on an already-mocked function reuses
    // the same mock instance rather than wrapping it, so its call history would otherwise
    // leak across every test in this file.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    }).compileComponents();
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the nav links', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('.nav a')).map(
      (a) => (a as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Install', 'Config', 'Playground', 'Examples', 'Changelog', 'Docs']);
  });

  it('highlights the Examples nav link instead of Playground once that section is active', async () => {
    const router = TestBed.inject(Router);
    const section = TestBed.inject(SectionService);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await router.navigate(['/playground']);
    fixture.detectChanges();

    const linkFor = (text: string) =>
      Array.from(fixture.nativeElement.querySelectorAll('.nav a')).find(
        (a) => (a as HTMLAnchorElement).textContent?.trim() === text,
      ) as HTMLAnchorElement;

    expect(linkFor('Playground').classList.contains('active')).toBe(true);
    expect(linkFor('Examples').classList.contains('active')).toBe(false);

    section.activeSection.set('examples');
    fixture.detectChanges();

    expect(linkFor('Playground').classList.contains('active')).toBe(false);
    expect(linkFor('Examples').classList.contains('active')).toBe(true);
  });

  it('clicking "Examples" scrolls to the examples section even when already there (same-URL clicks the router would otherwise ignore)', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await router.navigate(['/playground'], { fragment: 'examples' });
    fixture.detectChanges();

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const event = new MouseEvent('click', { button: 0 });
    fixture.componentInstance['scrollToExamples'](event);

    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.instances[0]).toBe(fixture.nativeElement.querySelector('#examples'));
  });

  it('clicking "Playground" scrolls back to the top of the Playground section', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await router.navigate(['/playground'], { fragment: 'examples' });
    fixture.detectChanges();

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const event = new MouseEvent('click', { button: 0 });
    fixture.componentInstance['scrollToPlaygroundTop'](event);

    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.instances[0]).toBe(fixture.nativeElement.querySelector('#playground-top'));
  });

  it('nav scroll handlers are no-ops when not on the Playground route', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const event = new MouseEvent('click', { button: 0 });
    fixture.componentInstance['scrollToExamples'](event);

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
