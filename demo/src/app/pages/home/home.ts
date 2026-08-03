import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OptionsDataService } from '../../services/options-data';

// One is picked at random per page load and shown below the CTA buttons -
// short, single-line tips pointing at a feature that's easy to miss.
const HINTS: string[] = [
  'The original concept was inspired by Reddit toasts.',
  'The first version of this library started development on November 2, 2022.', // https://www.reddit.com/r/css/comments/ykar43/hey_any_idea_how_i_can_do_this/
  'This demo page was written in Angular!',
  'Explore the many examples on the Playground :)',
  'You can call toasts.removeAllToasts() to clear all snackbars.',
  'You can either use ToastBuilder or toasts.show(...options) - whichever you like more.',
  "Toasts auto-translate their own close/details/confirm text into four bundled languages.",
  'Pair a progress bar with confirmButton() for a delete-then-undo flow in one toast.',
  'The name \'brents-toasts\' was pretty easy to come up with.',
  'Brentspine + Toast Library = \'brents-toasts\'',
  'You can use the Playground to generate a snippet for your own project.',
  'Most of this demo is built via a central options.json file (except these tips)',
  'This project is open source, take a peek!'
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
