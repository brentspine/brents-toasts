import { Injectable, signal } from '@angular/core';

/**
 * Tracks which part of the Playground route is currently in view, so the header nav can
 * highlight "Examples" instead of "Playground" once the user scrolls down to that section
 * (both nav links point at the same route, so RouterLinkActive alone can't distinguish them).
 */
@Injectable({ providedIn: 'root' })
export class SectionService {
  readonly activeSection = signal<'playground' | 'examples'>('playground');
}
