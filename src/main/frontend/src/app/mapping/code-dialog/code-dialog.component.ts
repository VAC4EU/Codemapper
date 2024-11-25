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
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CodeId, Concept } from '../data';

export interface CodeDialogCode {
  id : string;
  term : string;
  concept : string;
}

export interface CodeDialogData {
  code : CodeDialogCode;
  operation : string;
  concepts : Concept[];
  codeIds : CodeId[];
  idEditable : boolean;
}

@Component({
  selector: 'mapping-code-dialog',
  templateUrl: './code-dialog.component.html',
  styleUrls: ['./code-dialog.component.scss'],
})
export class CodeDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<CodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : CodeDialogData,
  ) {
  }
  cancel() {
    this.dialogRef.close();
  }
  isValid() {
    console.log(this.data.codeIds, this.data.code.id, !this.data.codeIds.includes(this.data.code.id));
    return this.data.code.id &&
      this.data.code.term &&
      this.data.code.concept &&
      (!this.data.idEditable || !this.data.codeIds.includes(this.data.code.id));
  }
}
