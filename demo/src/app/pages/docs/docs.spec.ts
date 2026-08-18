import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Docs } from './docs';

describe('Docs', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('# Getting started\n\nHello.', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function createComponent(topic: string | null = 'buttons') {
    await TestBed.configureTestingModule({
      imports: [Docs],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(topic === null ? {} : { topic })), fragment: of(null) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Docs);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('falls back to the first topic when the route param does not match a known slug', async () => {
    const fixture = await createComponent('not-a-real-topic');
    expect(fixture.componentInstance.slug()).toBe(fixture.componentInstance.topics[0].slug);
  });

  it('uses the route param slug when it matches a known topic', async () => {
    const fixture = await createComponent('buttons');
    expect(fixture.componentInstance.slug()).toBe('buttons');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/docs/guide/buttons.md'),
      expect.anything(),
    );
  });

  it('renders the fetched markdown once loaded', async () => {
    const fixture = await createComponent('getting-started');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Hello.');
  });

  it('scrolls to the fragment heading once the markdown has loaded', async () => {
    fetchMock.mockResolvedValue(new Response('# Getting started\n\n## Install\n\nHello.', { status: 200 }));
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    await TestBed.configureTestingModule({
      imports: [Docs],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ topic: 'getting-started' })), fragment: of('install') },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Docs);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrollSpy).toHaveBeenCalled();
    const installHeading = fixture.nativeElement.querySelector('#install');
    expect(installHeading?.textContent?.trim()).toBe('Install');
  });
});
