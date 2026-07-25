import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';

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
});
