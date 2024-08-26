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
import { VocabularyId } from '../data';

@Component({
  selector: 'app-custom-vocabulary-dialog',
  templateUrl: './custom-vocabulary-dialog.component.html',
  styleUrls: ['./custom-vocabulary-dialog.component.scss']
})
export class CustomVocabularyDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<CustomVocabularyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : {
      id : VocabularyId,
      name : string,
    }
  ) { }
  cancel() {
    this.dialogRef.close();
  }
}
