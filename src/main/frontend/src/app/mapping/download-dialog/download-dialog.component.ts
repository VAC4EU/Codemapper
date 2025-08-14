import { Component, Inject } from '@angular/core';
import { ApiService } from '../api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MappingInfo } from '../persistency.service';
import { MappingMeta } from '../data';

export enum IncludeDescendants {
  Yes = 0,
  No = 1,
  PerMapping = 2
}

export function includeDescendants(value: boolean) {
  return value ? IncludeDescendants.Yes : IncludeDescendants.No;
}

@Component({
  selector: 'app-download-dialog',
  templateUrl: './download-dialog.component.html',
  styleUrls: ['./download-dialog.component.scss'],
})
export class DownloadDialogComponent {
  IncludeDescendants = IncludeDescendants;
  numMappings: number = 0;
  constructor(
    private api : ApiService,
    public dialogRef : MatDialogRef<DownloadDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data : {
      projectName : string;
      version? : number;
      mappingConfigs : string[];
      mappings: { [key: string]: {name: string, meta: MappingMeta}};
      includeDescendants : IncludeDescendants;
    }
  ) {
    this.numMappings = data.mappingConfigs.length;
  }

  defaultFilename(): string {
    if (this.data.mappingConfigs.length == 1) {
      let config = this.data.mappingConfigs[0];
      let {name, meta} = this.data.mappings[config];
      if (meta.system && meta.type) {
        let versionSuffix = "";
        if (this.data.version != undefined) {
          versionSuffix = `@v${this.data.version}`;
        }
        return `${meta.system}_${name}_${meta.type}${versionSuffix}`;
      }
    }
    let s = this.data.mappingConfigs.length == 1 ? '' : 's';
    return `${this.data.projectName}`
  }

  download(content : string, filename : string) {
    let url = new URL(this.api.codeListsUrl);
    url.searchParams.set('content', content);
    url.searchParams.set('filename', filename);
    url.searchParams.set('project', this.data.projectName);
    for (let mappingConfig of this.data.mappingConfigs) {
      url.searchParams.append('mappings', mappingConfig);
    }
    window.open(url, '_blank');
  }
  close() {
    this.dialogRef.close();
  }
}
