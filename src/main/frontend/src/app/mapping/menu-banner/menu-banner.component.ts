import { Component, Input } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'menu-banner',
    templateUrl: './menu-banner.component.html',
    styleUrls: ['./menu-banner.component.scss'],
    standalone: false
})
export class MenuBannerComponent {
  isProduction : boolean = environment.isProduction;
  @Input() projectName : string | null = null;
}
