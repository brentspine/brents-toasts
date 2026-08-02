import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Home } from './home';

describe('Home', () => {
  async function createComponent() {
    await TestBed.configureTestingModule({ imports: [Home], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one card per feature from options.json', async () => {
    const fixture = await createComponent();
    const cards = fixture.nativeElement.querySelectorAll('.feature');
    expect(cards.length).toBe(fixture.componentInstance.features.length);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('renders a hint below the CTA buttons', async () => {
    const fixture = await createComponent();
    const hint = fixture.nativeElement.querySelector('.hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent.trim().length).toBeGreaterThan(0);
    expect(hint.querySelector('svg.hint-icon')).not.toBeNull();
  });
});
