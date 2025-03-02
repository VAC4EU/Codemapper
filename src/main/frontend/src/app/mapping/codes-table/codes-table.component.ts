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

import { Input, Output, Component, SimpleChanges, EventEmitter, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { ReviewsDialogComponent } from '../reviews-dialog/reviews-dialog.component';
import { Code, CodeId, Concept, ConceptId, Mapping, VocabularyId } from '../data';
import { AllTopics, TopicsInfo, ReviewOperation, ReviewData } from '../review';
import { AuthService } from '../auth.service';

@Component({
  selector: 'codes-table',
  templateUrl: './codes-table.component.html',
  styleUrls: ['./codes-table.component.scss']
})
export class CodesTableComponent {
  @Input() vocabularyId! : VocabularyId;
  @Input() mapping! : Mapping;
  @Input() filter : string = "";
  @Input() codes : Code[] = [];
  @Input() codeParents : null | { [key : CodeId] : Set<CodeId> } = null;
  @Input() showConcepts : boolean = true;
  @Input() showTags : boolean = true;
  @Input() allTopics : AllTopics | null = null;
  @Input() reviewData : ReviewData | null = null;
  @Input() userCanEdit : boolean = false;
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();
  @Output() selected : EventEmitter<Code[]> = new EventEmitter();
  @ViewChild(MatSort) sort! : MatSort;

  dataSource = new MatTableDataSource<Code>();
  columns : string[] = [];
  selection = new SelectionModel<Code>(true, []);
  allTopicsObj : { allTopics : AllTopics } = { allTopics: new AllTopics() };

  constructor(
    public dialog : MatDialog,
  ) {
    this.selection.changed.subscribe(s => this.selected.emit(this.getSelectedFilteredCodes()));
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item : any, property : string) => {
      switch (property) {
        case 'code': return item.id;
        case 'concepts': return this.codeConcepts(item.id).map(id => this.mapping.concepts[id].name).join(',');
        default: return item[property];
      }
    };
  }

  ngOnChanges(changes : SimpleChanges) {
    if (changes['allTopics'] !== undefined) {
      this.allTopicsObj.allTopics = changes['allTopics'].currentValue;
    }
    if (changes['filter'] !== undefined) {
      this.dataSource.filter = changes['filter'].currentValue.trim().toLowerCase();
      this.selected.emit(this.getSelectedFilteredCodes());
    }
    if (changes['vocabularyId']) {
      setTimeout(() => this.selection.clear(), 0);
    }
    if (changes['codes']) {
      this.dataSource.data = changes['codes'].currentValue;
    }
    let tag = this.showTags ? ["tag"] : [];
    let parents = this.codeParents == null ? [] : ["parents"];
    let concepts = this.showConcepts ? ["concepts"] : [];
    let comments = this.allTopics == null ? [] : ["comments"];
    this.columns = [["select", "code"], tag, comments, concepts, parents].flat();
  }

  getSelectedFilteredCodes() {
    return Array.from(this.selection.selected)
      .filter(c => this.dataSource.filteredData.some(c2 => c2.id == c.id));
  }

  topics(codeId : CodeId) {
    return this.allTopics?.byCode[this.vocabularyId]?.[codeId] ?? new TopicsInfo();
  }

  isAllFilteredSelected() {
    return this.dataSource.filteredData.length <= this.selection.selected.length &&
      this.dataSource.filteredData.every(c => this.selection.selected.indexOf(c) != -1);
  }

  toggleSelectAll() {
    if (this.isAllFilteredSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.filteredData.forEach(row => this.selection.select(row));
    }
  }

  unselect(code : Code) {
    this.selection.deselect(code);
  }

  parents(id : CodeId) : Code[] {
    let codes = this.mapping.codes[this.vocabularyId];
    return Array.from(this.codeParents?.[id] ?? [])
      .map(id => codes[id])
      .filter(c => c != null);
  }

  codeConcepts(id : CodeId) : ConceptId[] {
    return Array.from(this.mapping.conceptsByCode[this.vocabularyId]?.[id] ?? []);
  }

  selectAllCustomCodes() {
    this.selection.clear();
    for (let code of this.codes) {
      if (code.custom) {
        this.selection.select(code);
      }
    }
  }

  showReviews(code : CodeId) {
    if (this.mapping != null) {
      let codeName = this.mapping.codes[this.vocabularyId]?.[code]?.term ?? "unknown";
      this.dialog.open(ReviewsDialogComponent, {
        width: '80em',
        data: {
          heading: `Review ${code}: ${codeName}`,
          voc: this.vocabularyId,
          code: code,
          allTopicsObj: this.allTopicsObj,
          data: this.reviewData,
          userIsEditor: this.userCanEdit,
          run: this.reviewRun,
        }
      });
    }
  }
}
