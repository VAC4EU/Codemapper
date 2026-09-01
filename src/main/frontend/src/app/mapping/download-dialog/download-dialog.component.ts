import { Component, Inject, signal } from '@angular/core';
import { ApiService } from '../api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  compareVocabularies,
  MappingMeta,
  Tag,
  Vocabularies,
  Vocabulary,
} from '../mapping-data';
import { AppComponent } from '../../app.component';
import { firstValueFrom, map, race, Subject, takeUntil } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

/** Tag filter element that selects codes without tags. */
const NO_TAG = '';

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
  filterCodingSystems = false;
  filterTags = false;
  NO_TAG = NO_TAG;
  codingSystemOptions: string[] = [];
  selectedCodingSystems: string[] = [];
  tagOptions: string[] = [];
  selectedTags: string[] = [];
  codingSystemNames: { [key: string]: string } = {};
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
      // the coding systems of the mappings, all coding systems if undefined
      vocabularies?: Vocabularies;
      tags?: Tag[];
    }
  ) {
    this.numMappings = data.mappingConfigs.length;
    this.selectedCodingSystems = this.loadFilter('codingSystems');
    this.selectedTags = this.loadFilter('tags');
    this.tagOptions = (data.tags ?? []).slice().sort();
    if (data.vocabularies) {
      this.setCodingSystems(Object.values(data.vocabularies));
    } else {
      this.api
        .vocabularies()
        .subscribe((vocs) => this.setCodingSystems(vocs.slice()));
    }
  }

  private setCodingSystems(vocs: Vocabulary[]) {
    vocs.sort(compareVocabularies);
    this.codingSystemOptions = vocs.map((voc) => voc.id);
    this.codingSystemNames = Object.fromEntries(
      vocs.map((voc) => [voc.id, voc.name])
    );
  }

  private storageKey(field: string): string {
    return `download.${field}.${this.data.projectName}`;
  }

  private loadFilter(field: string): string[] {
    let value = localStorage.getItem(this.storageKey(field));
    if (value === null) return [];
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map((s) => s.trim());
    }
  }

  saveFilters() {
    localStorage.setItem(
      this.storageKey('codingSystems'),
      JSON.stringify(this.selectedCodingSystems)
    );
    localStorage.setItem(
      this.storageKey('tags'),
      JSON.stringify(this.selectedTags)
    );
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

  // undefined means no filter; an empty element selects codes with no tag
  tagFilter(): string[] | undefined {
    return this.filterTags ? this.selectedTags : undefined;
  }

  codingSystemFilter(): string[] | undefined {
    return this.filterCodingSystems ? this.selectedCodingSystems : undefined;
  }

  async download(content: 'codelist' | 'metadata', filename: string) {
    this.saveFilters();
    this.done[content].set(false);
    let csvContents = await this.downloadCsvForAllMappings(content, filename);
    if (csvContents === undefined) return;
    let csvContent = concatCsvContents(csvContents);
    let suffix = content === 'metadata' ? ' - metadata' : '';
    openCsv(csvContent, filename + suffix + '.csv', content);
    this.done[content].set(true);
  }

  /** Downloads and concatenates CSV content for each mapping separately, to
   * avoid overly large requests/responses for many mappings. Returns
   * undefined if the download was canceled or failed. */
  private async downloadCsvForAllMappings(
    content: 'codelist' | 'metadata',
    filename: string
  ): Promise<string[] | undefined> {
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
            filename,
            content === 'codelist' ? this.tagFilter() : undefined,
            content === 'codelist' ? this.codingSystemFilter() : undefined
          )
          .pipe(takeUntil(cancelDownload));
        try {
          let res = await firstValueFrom(
            race([
              download.pipe(
                map((csvContent) => ({
                  type: 'csvContent' as 'csvContent',
                  csvContent,
                }))
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
              return undefined;
          }
        } catch (error) {
          let errorMsg = (error as HttpErrorResponse).message;
          let msg = `Could not download ${name}. ${errorMsg}`;
          console.error(msg, error);
          alert(msg);
          return undefined;
        }
      }
      return csvContents;;
    } finally {
      this.snackbar.dismiss();
    }
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
