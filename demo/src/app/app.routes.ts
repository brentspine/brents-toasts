import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Install } from './pages/install/install';
import { Config } from './pages/config/config';
import { Playground } from './pages/playground/playground';
import { ChangelogPage } from './pages/changelog/changelog';
import { Docs } from './pages/docs/docs';
import { DOCS_TOPICS } from './data/docs-topics';

export const routes: Routes = [
  { path: '', component: Home, title: 'brents-toasts' },
  { path: 'install', component: Install, title: 'Install | brents-toasts' },
  { path: 'config', component: Config, title: 'Config | brents-toasts' },
  { path: 'playground', component: Playground, title: 'Playground | brents-toasts' },
  { path: 'docs', redirectTo: `docs/${DOCS_TOPICS[0].slug}`, pathMatch: 'full' },
  { path: 'docs/:topic', component: Docs, title: 'Docs | brents-toasts' },
  { path: 'changelog', component: ChangelogPage, title: 'Changelog | brents-toasts' },
  { path: '**', redirectTo: '' },
];
