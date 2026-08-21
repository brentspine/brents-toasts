import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SaveSnippetDialog } from './save-snippet-dialog';

describe('SaveSnippetDialog', () => {
  async function createComponent(existingNames: string[] = []) {
    await TestBed.configureTestingModule({ imports: [SaveSnippetDialog] }).compileComponents();
    const fixture = TestBed.createComponent(SaveSnippetDialog);
    fixture.componentRef.setInput('existingNames', existingNames);
    fixture.detectChanges();
    return fixture;
  }

  it('confirm() does not emit save when the name is blank', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: string | null = null;
    component.save.subscribe((name) => (emitted = name));

    component.confirm();

    expect(emitted).toBeNull();
  });

  it('confirm() emits the trimmed name once one is entered', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: string | null = null;
    component.save.subscribe((name) => (emitted = name));

    component.onNameInput({ target: { value: '  My snippet  ' } } as unknown as Event);
    component.confirm();

    expect(emitted).toBe('My snippet');
  });

  it('isOverwrite() is true only when the trimmed name matches an existing snippet', async () => {
    const fixture = await createComponent(['Existing']);
    const component = fixture.componentInstance;

    component.onNameInput({ target: { value: 'New one' } } as unknown as Event);
    expect(component.isOverwrite()).toBe(false);

    component.onNameInput({ target: { value: 'Existing' } } as unknown as Event);
    expect(component.isOverwrite()).toBe(true);
  });

  it('closed emits when requested', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let closedCount = 0;
    component.closed.subscribe(() => closedCount++);

    component.closed.emit();

    expect(closedCount).toBe(1);
  });
});
