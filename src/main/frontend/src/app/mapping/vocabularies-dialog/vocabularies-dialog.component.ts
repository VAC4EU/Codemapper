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

import { Inject, Component } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Vocabulary } from '../data';

@Component({
  selector: 'mapping-vocabularies-dialog',
  templateUrl: './vocabularies-dialog.component.html',
  styleUrls: ['./vocabularies-dialog.component.scss']
})
export class VocabulariesDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<VocabulariesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : {
      vocabularies : Vocabulary[]
    }
  ) { }

  cancel() {
    this.dialogRef.close();
  }
}
