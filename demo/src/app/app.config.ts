import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No withInMemoryScrolling(): with withHashLocation() the URL becomes
    // "#/path#fragment" (a literal second "#"), which its anchorScrolling/
    // scrollPositionRestoration don't reliably handle and were observed fighting a
    // manual scroll. Playground scrolls to its own fragment manually instead.
    provideRouter(routes, withHashLocation()),
    provideHttpClient()
  ]
};
