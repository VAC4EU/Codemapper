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
import { Mapping, Code, CodeId, VocabularyId } from '../data';

export interface CodesDialogData {
  title : string;
  mapping : Mapping;
  codes : Code[];
  codeParents : { [key : CodeId] : Set<CodeId> };
  vocabularyId : VocabularyId;
}

@Component({
  selector: 'codes-dialog',
  templateUrl: './codes-dialog.component.html',
  styleUrls: ['./codes-dialog.component.scss']
})
export class CodesDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<CodesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : CodesDialogData,
  ) { }

  close() {
    this.dialogRef.close();
  }
}