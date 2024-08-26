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
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

@Component({
  selector: 'mapping-tags-dialog',
  templateUrl: './tags-dialog.component.html',
  styleUrls: ['./tags-dialog.component.scss']
})
export class TagsDialogComponent {
  heading : string = "";
  tag : string = "";
  allowedTags : string[] = [];

  constructor(
    public dialogRef : MatDialogRef<TagsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : { heading: string, allowedTags : string[], tag : string | null }
  ) {
    this.tag = data.tag ?? '';
    this.heading = data.heading ?? '';
    this.allowedTags = this.data.allowedTags;
  }

  cancel() {
    this.dialogRef.close();
  }

  selected(event : MatAutocompleteSelectedEvent) : void {
    console.log("EVENT", event);
    this.tag = event.option.viewValue;
  }
}
