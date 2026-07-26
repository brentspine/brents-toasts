import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No withInMemoryScrolling(): with withHashLocation() the URL becomes
    // "#/path#fragment" (a literal second "#"), which its anchorScrolling/
    // scrollPositionRestoration don't reliably handle and were observed fighting a
    // manual scroll. Playground scrolls to its own fragment manually instead, and it
    // also has to wait on the CodeEditor's async Monaco load first (see playground.ts).
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    // The browser's own native scroll restoration (history.scrollRestoration, default
    // "auto") was observed silently reverting Playground's manual fragment-scroll back
    // to the top a few dozen ms after it ran, on a fresh/reloaded load of a fragment
    // URL - since nothing else here ever disables it (withInMemoryScrolling() is
    // deliberately not used, see above). Setting it to "manual" once at startup stops
    // the browser from fighting our own scroll; it doesn't enable any Angular-managed
    // scroll restoration itself.
    provideAppInitializer(() => {
      try {
        history.scrollRestoration = 'manual';
      } catch {
        // Unavailable in some environments (e.g. certain test runners) - safe to ignore.
      }
    })
  ]
};
