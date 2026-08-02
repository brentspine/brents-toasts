import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OptionsDataService } from '../../services/options-data';

// One is picked at random per page load and shown below the CTA buttons —
// short, single-line tips pointing at a feature that's easy to miss.
const HINTS: string[] = [
  'The Playground generates copy-paste-ready code for every option you toggle.',
  'No bundler required — drop in a single script tag and it just works.',
  'ToastBuilder gives you a fluent, chainable alternative to the options object.',
  "Toasts auto-translate their own close/details/confirm text into four bundled languages.",
  'Pair a progress bar with confirmButton() for a delete-then-undo flow in one toast.',
];

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly features = inject(OptionsDataService).data.features;
  readonly hint = HINTS[Math.floor(Math.random() * HINTS.length)];
}
