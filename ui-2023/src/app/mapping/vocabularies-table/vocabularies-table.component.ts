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

import { Input, Component } from '@angular/core';
import { Vocabulary } from '../data';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
  selector: 'vocabularies-table',
  templateUrl: './vocabularies-table.component.html',
  styleUrls: ['./vocabularies-table.component.scss']
})
export class VocabulariesTableComponent {
  @Input() vocabularies : Vocabulary[] = [];
  public selection = new SelectionModel<Vocabulary>(true, []);

  columns : string[] = ['select', 'id', 'name', 'version'];

  isAllSelected() {
    return this.selection.selected.length == this.vocabularies.length;
  }

  idTooltip(voc : Vocabulary) : string {
    if (voc.custom) {
      return "Custom vocabulary";
    } else {
      return "";
    }
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.vocabularies.forEach(row => this.selection.select(row));
    }
  }
}
