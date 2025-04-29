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

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'import-csv-dialog',
  templateUrl: './import-csv-dialog.component.html',
  styleUrls: ['./import-csv-dialog.component.scss']
})
export class ImportCsvDialogComponent {
  csvImportFile : File | null = null;
  mappingName : string = "";
  constructor(
    private api : ApiService,
    private dialogRef : MatDialogRef<ImportCsvDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : {
      ignoreTermTypes: string[],
      noWarning: boolean,
    },
  ) { }

  handleCsvFileInput(event : Event) {
    const input = event.target as HTMLInputElement;
    this.csvImportFile = null;
    if (input.files) {
      if (input.files.length == 1) {
        this.csvImportFile = input.files[0];
        if (this.mappingName == "") {
          let ix = this.csvImportFile.name.lastIndexOf('.');
          if (ix == -1) {
            this.mappingName = this.csvImportFile.name;
          } else {
            this.mappingName = this.csvImportFile.name.slice(0, ix);
          }
        }
      }
    }
  }

  unsetCsvImportFile() {
    this.csvImportFile = null;
  }

  async importCsv(mappingName : string, file : File, format : string) {
    try {
      let imported = await firstValueFrom(this.api.importCsv(file, [], format, this.data.ignoreTermTypes));
      if (imported.warnings.length) {
        let msg = "There were problems with the import: " +
          imported.warnings.map(s => `${s}. `).join("");
        if (this.data.noWarning) {
          imported.warning = msg;
        } else if (!confirm(msg + " Continue?")) {
          return;
        }
      }
      imported.mappingName = mappingName;
      this.unsetCsvImportFile();
      this.dialogRef.close(imported);
    } catch (err) {
      console.error("Could not import codelist", err);
      let msg = typeof(err) == "string" ? err : ((err as any).error ?? "Could not import codelist: unknown error (see console)");
      alert(msg);
    }
  }
}
