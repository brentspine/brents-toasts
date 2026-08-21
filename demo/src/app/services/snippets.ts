import { Injectable, signal } from '@angular/core';

/** localStorage key for the Playground's locally-saved named snippets (see `SnippetsService`). */
export const SNIPPETS_STORAGE_KEY = 'bt-demo:playground-snippets';

export interface SavedSnippet {
  id: string;
  name: string;
  code: string;
  savedAt: string;
  /** e.g. `'examples'` when saved right after loading a curated example unedited - see `Playground.confirmSaveSnippet`. */
  tags?: string[];
}

function loadStored(): SavedSnippet[] {
  try {
    const raw = localStorage.getItem(SNIPPETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedSnippet[]) : [];
  } catch {
    return [];
  }
}

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `snippet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Named Playground snippets the user has explicitly saved locally (Save button or Ctrl+S,
 * see `Playground`/`SaveSnippetDialog`) - a list the user builds up over time, distinct from
 * `PLAYGROUND_STORAGE_KEY` in run-code.ts, which always just mirrors whatever is currently in
 * the editor. Lives only in this browser; there is no sync/server component.
 */
@Injectable({ providedIn: 'root' })
export class SnippetsService {
  readonly snippets = signal<SavedSnippet[]>(loadStored());

  /** Saves `code` under `name`, overwriting any existing snippet with the same (trimmed) name. */
  save(name: string, code: string, tags?: string[]): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const savedAt = new Date().toISOString();

    this.snippets.update((current) => {
      const existing = current.find((s) => s.name === trimmed);
      const entry: SavedSnippet = { id: existing?.id ?? generateId(), name: trimmed, code, savedAt, tags };
      return [...current.filter((s) => s.name !== trimmed), entry].sort((a, b) => a.name.localeCompare(b.name));
    });
    this.persist();
  }

  remove(id: string): void {
    this.snippets.update((current) => current.filter((s) => s.id !== id));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(this.snippets()));
    } catch {
      // Storage unavailable (private browsing, quota): persistence is a nice-to-have, not required.
    }
  }
}
