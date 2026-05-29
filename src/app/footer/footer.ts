import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FooterStore } from './state/footer.store';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'contentinfo' },
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class AppFooter {
  protected readonly store = inject(FooterStore);
}
