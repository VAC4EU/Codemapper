import { booleanAttribute, Component, Input } from '@angular/core';

@Component({
  selector: 'menu-banner',
  templateUrl: './menu-banner.component.html',
  styleUrls: ['./menu-banner.component.scss']
})
export class MenuBannerComponent {
  @Input() projectName : string | null = null;
}
