// This file is part of CodeMapper.
//
// Copyright 2022-2024 VAC4EU - Vaccine monitoring Collaboration for Europe.
// Copyright 2017-2021 Erasmus Medical Center, Department of Medical Informatics.
//
// CodeMapper is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option) any
// later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ApiService, csvFilter, ImportedMapping } from '../api.service';
import { firstValueFrom } from 'rxjs';
import { MappingInfo } from '../persistency.service';

@Component({
    selector: 'import-csv-dialog',
    templateUrl: './import-csv-dialog.component.html',
    styleUrls: ['./import-csv-dialog.component.scss'],
    standalone: false
})
export class ImportCsvDialogComponent {
  @Input({required: true}) mappingInfo!: MappingInfo;
  @Input({required: true}) ignoreTermTypes!: string[];
  @Input() noWarning: boolean = false;
  @Output() mapping = new EventEmitter<ImportedMapping>();
  csvImportFile: File | null = null;
  constructor(
    private api: ApiService,
  ) {}

  handleCsvFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.csvImportFile = null;
    if (input.files) {
      if (input.files.length == 1) {
        this.csvImportFile = input.files[0];
      }
    }
  }

  unsetCsvImportFile() {
    this.csvImportFile = null;
  }

  async importCsv(file: File, applyFilter: boolean, format: string) {
    try {
      let filter = applyFilter ? csvFilter(this.mappingInfo) : null;
      let imported = await firstValueFrom(
        this.api.importCsv(file, [], format, this.ignoreTermTypes, filter)
      );
      if (imported.warnings.length > 0) {
        let msg =
          'There were problems with the import: ' +
          imported.warnings.map((s) => `${s}. `).join('');
        if (this.noWarning) {
          imported.warning = msg;
        } else if (!confirm(msg + ' Continue?')) {
          return;
        }
      }
      this.unsetCsvImportFile();
      this.mapping.emit(imported);
    } catch (err) {
      console.error('Could not import codelist', err);
      let msg =
        typeof err == 'string'
          ? err
          : (err as any).error ??
            'Could not import codelist: unknown error (see console)';
      alert(msg);
    }
  }
}
