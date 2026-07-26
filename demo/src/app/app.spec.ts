import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { SectionService } from './services/section';

describe('App', () => {
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
    expect(links).toEqual(['Install', 'Config', 'Playground', 'Examples', 'Changelog']);
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
});
