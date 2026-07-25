import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangelogPage } from './changelog';

describe('ChangelogPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Default: everything 404s — no real network calls, deterministic in CI.
    fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function createComponent() {
    await TestBed.configureTestingModule({ imports: [ChangelogPage] }).compileComponents();
    const fixture = TestBed.createComponent(ChangelogPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('legacyVersionUrl() points at the archived static snapshot for a version', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance.legacyVersionUrl('2.1.0')).toBe('versions/2.1.0/index.html');
  });

  it('selectVersion() toggles the selected version on and off', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.selectedVersion()).toBeNull();

    component.selectVersion('2.2.0');
    expect(component.selectedVersion()).toBe('2.2.0');

    component.selectVersion('2.2.0');
    expect(component.selectedVersion()).toBeNull();
  });

  it('selecting a different version replaces the selection', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.selectVersion('2.2.0');
    component.selectVersion('2.1.0');
    expect(component.selectedVersion()).toBe('2.1.0');
  });

  it('fetches historical options + changelog data for a version that has a snapshot', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/docs/options/2.2.0.json')) {
        return new Response(JSON.stringify({ toastOptions: [{ name: 'color' }] }), { status: 200 });
      }
      if (url.includes('/docs/changelogs/2.2.0.md')) {
        return new Response('# 2.2.0 - 2026-01-01\n\n## Added\n\n- Something', { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.selectVersion('2.2.0');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.historicalOptions.value()).toEqual({ toastOptions: [{ name: 'color' }] });
    expect(component.historicalChangelog.value()).toContain('Added');
  });

  it('falls back to no data (legacy) when docs/options/<version>.json 404s', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.selectVersion('2.0.1');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.historicalOptions.value()).toBeNull();
  });

  it('does not fetch historical data until a version is selected', async () => {
    await createComponent();
    const historicalCalls = fetchMock.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('/docs/options/'),
    );
    expect(historicalCalls).toEqual([]);
  });
});
