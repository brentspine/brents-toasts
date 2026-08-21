import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SNIPPETS_STORAGE_KEY, SnippetsService } from './snippets';

describe('SnippetsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function createService(): SnippetsService {
    return TestBed.inject(SnippetsService);
  }

  it('starts empty when nothing is stored', () => {
    const service = createService();
    expect(service.snippets()).toEqual([]);
  });

  it('save() adds a new snippet and persists it to localStorage', () => {
    const service = createService();
    service.save('My snippet', 'new ToastBuilder("Hi").show();');

    expect(service.snippets()).toHaveLength(1);
    expect(service.snippets()[0].name).toBe('My snippet');
    expect(service.snippets()[0].code).toBe('new ToastBuilder("Hi").show();');

    const stored = JSON.parse(localStorage.getItem(SNIPPETS_STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('My snippet');
  });

  it('save() trims the name and ignores a blank name', () => {
    const service = createService();
    service.save('  Spaced  ', 'code();');
    expect(service.snippets()[0].name).toBe('Spaced');

    service.save('   ', 'ignored();');
    expect(service.snippets()).toHaveLength(1);
  });

  it('save() with an existing name overwrites that snippet in place, keeping its id', () => {
    const service = createService();
    service.save('Dupe', 'first();');
    const originalId = service.snippets()[0].id;

    service.save('Dupe', 'second();');

    expect(service.snippets()).toHaveLength(1);
    expect(service.snippets()[0].id).toBe(originalId);
    expect(service.snippets()[0].code).toBe('second();');
  });

  it('remove() deletes a snippet by id and persists the change', () => {
    const service = createService();
    service.save('A', 'a();');
    service.save('B', 'b();');
    const idToRemove = service.snippets().find((s) => s.name === 'A')!.id;

    service.remove(idToRemove);

    expect(service.snippets().map((s) => s.name)).toEqual(['B']);
    const stored = JSON.parse(localStorage.getItem(SNIPPETS_STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });

  it('loads previously persisted snippets on construction', () => {
    const first = createService();
    first.save('Persisted', 'persisted();');

    TestBed.resetTestingModule();
    const second = createService();

    expect(second.snippets()).toHaveLength(1);
    expect(second.snippets()[0].name).toBe('Persisted');
  });
});
