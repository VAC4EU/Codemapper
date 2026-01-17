import { Component, Inject, signal } from '@angular/core';
import { ApiService } from '../api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MappingMeta } from '../mapping-data';
import { AppComponent } from '../../app.component';
import { firstValueFrom, map, race, Subject, takeUntil } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

export enum IncludeDescendants {
  Yes = 0,
  No = 1,
  PerMapping = 2,
}

export function includeDescendants(value: boolean) {
  return value ? IncludeDescendants.Yes : IncludeDescendants.No;
}

@Component({
    selector: 'app-download-dialog',
    templateUrl: './download-dialog.component.html',
    styleUrls: ['./download-dialog.component.scss'],
    standalone: false
})
export class DownloadDialogComponent {
  IncludeDescendants = IncludeDescendants;
  numMappings: number = 0;
  done = {codelist: signal(false), metadata: signal(false)};
  constructor(
    private api: ApiService,
    private snackbar: MatSnackBar,
    public dialogRef: MatDialogRef<DownloadDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      projectName: string;
      version?: number;
      mappingConfigs: string[];
      mappings: { [key: string]: { name: string; meta: MappingMeta } };
      includeDescendants: IncludeDescendants;
    }
  ) {
    this.numMappings = data.mappingConfigs.length;
  }

  defaultFilename(): string {
    if (this.data.mappingConfigs.length == 1) {
      let config = this.data.mappingConfigs[0];
      let { name, meta } = this.data.mappings[config];
      if (meta.system && meta.type) {
        let versionSuffix = '';
        if (this.data.version != undefined) {
          versionSuffix = `@v${this.data.version}`;
        }
        return `${meta.system}_${name}_${meta.type}${versionSuffix}`;
      }
    }
    let s = this.data.mappingConfigs.length == 1 ? '' : 's';
    return `${this.data.projectName}`;
  }

  async download(content: 'codelist' | 'metadata', filename: string) {
    this.done[content].set(false);
    let csvContent: string;
    let suffix = '';
    switch (content) {
      case 'codelist': {
        try {
          let csvContents: string[] = [];
          for (let ix = 0; ix < this.data.mappingConfigs.length; ix++) {
            let mappingConfig = this.data.mappingConfigs[ix];
            let info = this.data.mappings[mappingConfig];
            let name = [info.meta.system, info.name, info.meta.type]
              .filter((v) => v)
              .join('_');
            let message = `Fetching ${ix + 1} of ${
              this.numMappings
            }: ${name}...`;
            this.snackbar.open(message, undefined, { duration: undefined });
            let cancelDownload = new Subject<void>();
            let download = this.api
              .downloadCsv(
                this.data.projectName,
                [mappingConfig],
                content,
                filename
              )
              .pipe(takeUntil(cancelDownload));
            try {
              let res = await firstValueFrom(
                race([
                  download.pipe(
                    map((csvContent) => ({
                      type: 'csvContent' as 'csvContent',
                      csvContent,
                    })),
                  ),
                  AppComponent.instance!.espapePressed.asObservable().pipe(
                    map(() => ({ type: 'canceled' as 'canceled' }))
                  ),
                ])
              );
              switch (res.type) {
                case 'csvContent':
                  csvContents.push(res.csvContent);
                  break;
                case 'canceled':
                  cancelDownload.next();
                  this.snackbar.open('Download canceled.', 'Ok');
                  return;
              }
            } catch (error) {
              let errorMsg = (error as HttpErrorResponse).message;
              let msg = `Could not download ${name}. ${errorMsg}`;
              console.error(msg, error);
              alert(msg);
              return;
            }
          }
          csvContent = concatCsvContents(csvContents);
        } finally {
          this.snackbar.dismiss();
        }
        break;
      }
      case 'metadata': {
        csvContent = await firstValueFrom(
          this.api.downloadCsv(
            this.data.projectName,
            this.data.mappingConfigs,
            content,
            filename
          )
        );
        suffix = ' - metadata';
        break;
      }
    }
    openCsv(csvContent, filename + suffix + '.csv', content);
    this.done[content].set(true);
  }

  close() {
    this.dialogRef.close();
  }
}

function concatCsvContents(csvContents: string[]): string {
  let result = '';
  let header: string | null = null;
  for (let csvContent of csvContents) {
    let ix = csvContent.indexOf('\n');
    let header1 = csvContent.slice(0, ix);
    if (header === null) {
      header = header1;
      result += csvContent;
    } else {
      if (header1 != header) {
        console.error('expected same header', {
          expected: header,
          found___: header1,
        });
      }
      result += csvContent.slice(ix + 1);
    }
  }
  return result;
}

function openCsv(
  csvContent: string,
  filename: string,
  content: 'codelist' | 'metadata'
) {
  let file = new File([csvContent], filename, { type: 'text/csv' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
