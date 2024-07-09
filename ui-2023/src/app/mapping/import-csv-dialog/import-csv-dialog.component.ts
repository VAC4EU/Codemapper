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
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiService } from '../api.service';

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
    public dialogRef : MatDialogRef<ImportCsvDialogComponent>,
    // @Inject(MAT_DIALOG_DATA) public data : {
    //   title : string,
    //   action : string,
    //   concepts : { [key : ConceptId] : Concept },
    //   codes : { [key : VocabularyId] : { [key : CodeId] : Code } },
    //   vocabularies : VocabularyId[]
    // }
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

  importCsv(mappingName : string, file : File) {
    this.api.importCsv(file, [])
      .subscribe(
        (imported) => {
          if (imported.warnings.length) {
            let msg = "There were problems with the import: " +
              imported.warnings.map(s => `${s}. `).join("") +
              "Continue?";
            if (!confirm(msg)) {
              return;
            }
          }
          imported.mappingName = mappingName;
          this.dialogRef.close(imported);
        },
        (error) => alert(error),
      );
    this.unsetCsvImportFile();
  }
}
