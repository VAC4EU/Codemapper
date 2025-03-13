import { Component, Inject } from '@angular/core';
import { ApiService } from '../api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-download-dialog',
  templateUrl: './download-dialog.component.html',
  styleUrls: ['./download-dialog.component.scss'],
})
export class DownloadDialogComponent {
  numMappings: number = 0;
  constructor(
    private api : ApiService,
    public dialogRef : MatDialogRef<DownloadDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data : {
      projectName : string;
      mappingConfigs : string[];
    }
  ) {
    this.numMappings = data.mappingConfigs.length;
  }

  download(includeDescendants : boolean, format : string) {
    let url = new URL(this.api.codeListsUrl);
    url.searchParams.set('project', this.data.projectName);
    for (let mappingConfig of this.data.mappingConfigs) {
      url.searchParams.append('mappings', mappingConfig);
    }
    url.searchParams.set('includeDescendants', '' + includeDescendants);
    url.searchParams.set('format', '' + format);
    window.open(url, '_blank');
  }
  close() {
    this.dialogRef.close();
  }
}
