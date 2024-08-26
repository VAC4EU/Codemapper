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

import { NgFor, AsyncPipe, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Component, Inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent, MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'mapping-tags-dialog',
  standalone: true,
  imports: [NgIf, MatInputModule, MatDialogModule, MatAutocompleteModule, MatChipsModule, FormsModule, ReactiveFormsModule, AsyncPipe, NgFor, MatButtonModule, MatIconModule, MatFormFieldModule],
  templateUrl: './tags-dialog.component.html',
  styleUrls: ['./tags-dialog.component.scss']
})
export class TagsDialogComponent {

  tag : string = "";
  availableTags : string[] = [];

  constructor(
    public dialogRef : MatDialogRef<TagsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : { availableTags : string[], tag : string | null }
  ) {
    this.tag = data.tag ?? '';
    this.availableTags = this.data.availableTags;
  }

  cancel() {
    this.dialogRef.close();
  }

  selected(event : MatAutocompleteSelectedEvent) : void {
    console.log("EVENT", event);
    this.tag = event.option.viewValue;
  }
}
