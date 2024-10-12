import { Component, Input } from '@angular/core';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrls: ['./download.component.scss']
})
export class DownloadComponent {
  @Input() disabled : boolean = false;
  @Input({ required: true }) projectName! : string;
  @Input({ required: true }) mappingConfigs! : string[];

  constructor(
    private api : ApiService,
  ) { }

  download(includeDescendants : boolean, compatibilityFormat : boolean) {
    let url = new URL(this.api.codeListsUrl);
    url.searchParams.set('project', this.projectName);
    for (let mappingConfig of this.mappingConfigs) {
      url.searchParams.append("mappingConfigs", mappingConfig);
    }
    url.searchParams.set('includeDescendants', "" + includeDescendants);
    url.searchParams.set('compatibilityFormat', "" + compatibilityFormat);
    window.open(url, '_blank');
  }
}
