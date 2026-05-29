import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-skip-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a href="#main-content" class="skip">Skip to main content</a>`,
  styleUrl: './skip-link.scss',
})
export class SkipLink {}
