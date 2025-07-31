import { Component, Inject } from '@angular/core';
import { ApiService } from '../api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

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
      mappingConfigs : string[];
      includeDescendants : IncludeDescendants;
    }
  ) {
    this.numMappings = data.mappingConfigs.length;
  }

  download(format : string) {
    let url = new URL(this.api.codeListsUrl);
    url.searchParams.set('project', this.data.projectName);
    for (let mappingConfig of this.data.mappingConfigs) {
      url.searchParams.append('mappings', mappingConfig);
    }
    url.searchParams.set('format', '' + format);
    window.open(url, '_blank');
  }
  close() {
    this.dialogRef.close();
  }
}
