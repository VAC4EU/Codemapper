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
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Tag } from '../mapping-data';

export interface TagsFilterDialogData {
  heading: string;
  tags: Tag[];
  selected: (Tag | null)[];
}

// MatChipListbox._selectValue skips chips whose value is `null`, so a chip
// bound to null can be clicked but never re-selected programmatically (e.g.
// when the dialog is reopened). Use this sentinel for the "no tag" chip
// instead, and translate to/from null at the component boundary.
export const NO_TAG = ' no-tag';

@Component({
  selector: 'mapping-tags-filter-dialog',
  templateUrl: './tags-filter-dialog.component.html',
  styleUrls: ['./tags-filter-dialog.component.scss'],
  standalone: false,
})
export class TagsFilterDialogComponent {
  readonly NO_TAG = NO_TAG;

  // bound to the chip listbox; data.selected is kept in sync but mutated in
  // place (not reassigned) so the reference the caller holds stays valid
  selectedTags: Tag[];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: TagsFilterDialogData,
  ) {
    this.selectedTags = data.selected.map((tag) => tag ?? NO_TAG);
  }

  onChange(selected: Tag[]) {
    this.selectedTags = selected;
    this.data.selected.length = 0;
    this.data.selected.push(
      ...selected.map((tag) => (tag === NO_TAG ? null : tag)),
    );
  }

  clear() {
    this.selectedTags = [];
    this.data.selected.length = 0;
  }
}
