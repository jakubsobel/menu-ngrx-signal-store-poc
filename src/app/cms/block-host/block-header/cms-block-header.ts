import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBase } from '../../../pages/state/cms.types';

@Component({
  selector: 'app-cms-block-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let b = block();
    @if (b.label || b.title || b.description) {
      <header class="block-header">
        @if (b.label) { <p class="label">{{ b.label }}</p> }
        @if (b.title) { <h2 class="title">{{ b.title }}</h2> }
        @if (b.description) { <p class="description">{{ b.description }}</p> }
      </header>
    }
  `,
  styleUrl: './cms-block-header.scss',
})
export class CmsBlockHeader {
  readonly block = input.required<ComponentBase>();
}
