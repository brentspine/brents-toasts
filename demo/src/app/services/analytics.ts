import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = 'G-LS3BPWCPLC';

/**
 * Sends a Google Analytics pageview on every route change. index.html loads gtag.js with
 * `send_page_view: false` (routing is hash-based via withHashLocation(), so gtag's own
 * automatic pageview would only ever fire once, on initial load) - this service sends the
 * initial one and every subsequent one instead, keyed off the Angular route so in-app
 * navigation between routes shows up as separate pageviews in GA.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        window.gtag?.('config', GA_MEASUREMENT_ID, {
          page_path: event.urlAfterRedirects,
        });
      });
  }
}
