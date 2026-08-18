import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunnableCodeBlock } from './runnable-code-block';
import { PLAYGROUND_STORAGE_KEY } from './run-code';

describe('RunnableCodeBlock', () => {
  afterEach(() => {
    document.querySelectorAll('.bt-toast').forEach((el) => el.remove());
    localStorage.removeItem(PLAYGROUND_STORAGE_KEY);
  });

  async function render(code: string) {
    await TestBed.configureTestingModule({
      imports: [RunnableCodeBlock],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(RunnableCodeBlock);
    fixture.componentRef.setInput('code', code);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('shows the snippet verbatim in a <pre><code>', async () => {
    const fixture = await render("toasts.showToast('Hi');");
    expect(fixture.nativeElement.querySelector('pre code').textContent).toBe("toasts.showToast('Hi');");
  });

  it('Run executes the snippet against the real library', async () => {
    const fixture = await render("toasts.showToast('Hi', { duration: 0 });");
    fixture.componentInstance.run();
    expect(document.querySelector('.bt-toast')).not.toBeNull();
  });

  it('Run surfaces a thrown error instead of the app crashing', async () => {
    const fixture = await render('this is not valid js(');
    fixture.componentInstance.run();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.run-error')).not.toBeNull();
  });

  it('openInPlayground seeds the Playground storage key and navigates there', async () => {
    const fixture = await render('new ToastBuilder("Hi").show();');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.componentInstance.openInPlayground();

    expect(localStorage.getItem(PLAYGROUND_STORAGE_KEY)).toBe('new ToastBuilder("Hi").show();');
    expect(navigateSpy).toHaveBeenCalledWith('/playground');
  });
});
