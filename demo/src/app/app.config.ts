import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// Plain path-based routing (PathLocationStrategy, the default - no withHashLocation()),
// so URLs read as "/brents-toasts/playground" instead of "/brents-toasts/#/playground".
// GitHub Pages has no server-side rewrite for deep links, so a hard refresh or a
// bookmarked/shared link straight to a route below the site root (anything but "/")
// 404s at the server instead of loading the app - a deliberate, accepted trade-off for
// cleaner URLs. Every in-app navigation (routerLink clicks, back/forward) stays entirely
// client-side via the History API and is unaffected.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No withInMemoryScrolling(): Playground scrolls to its own fragment manually
    // instead, since it has to wait on the CodeEditor's async Monaco load first (see
    // playground.ts) - the router's built-in anchorScrolling can't do that.
    provideRouter(routes),
    provideHttpClient()
  ]
};
