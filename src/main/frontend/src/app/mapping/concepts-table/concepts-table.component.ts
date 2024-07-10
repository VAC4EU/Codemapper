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

import { Input, Component, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { ReviewsDialogComponent } from '../reviews-dialog/reviews-dialog.component';
import { Concept, Vocabulary, VocabularyId, ConceptId, CodeId, Code } from '../data';
import { AllTopics, TopicsInfo, ReviewData, ReviewOperation } from '../review';
import { AuthService } from '../auth.service';

const BASE_COLUMNS = ["select", "concept", "tag", "comments"];

function sortConcepts(c1 : Concept, c2 : Concept) : number {
  return (c1.name ?? "").localeCompare(c2.name ?? "");
}

@Component({
  selector: 'concepts-table',
  templateUrl: './concepts-table.component.html',
  styleUrls: ['./concepts-table.component.scss']
})
export class ConceptsTableComponent {
  @Input() concepts : { [key : ConceptId] : Concept } = {};
  @Input() allTopics : AllTopics | null = null;
  @Input() codes : { [key : VocabularyId] : { [key : CodeId] : Code } } = {};
  @Input() vocabularies : VocabularyId[] = [];
  @Input() reviewData : ReviewData = new ReviewData();
  @Input() hideTagColumn : boolean = false;
  @Input() disabled : boolean = false;
  @Input() showCodeTagIndication : boolean = false;
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();
  @Output() selected : EventEmitter<Concept[]> = new EventEmitter();
  conceptsList : Concept[] = [];
  selection = new SelectionModel<Concept>(true, []);
  columns : string[] = [];

  // indirection to reviews to get updates in the review dialog
  allTopicsObj : { allTopics : AllTopics } = { allTopics: new AllTopics() };

  constructor(
    private dialog : MatDialog,
    private auth : AuthService,
  ) {
    this.selection.changed
      .subscribe(c => this.selected.emit(Array.from(this.selection.selected)))
  }

  ngOnChanges(changes : SimpleChanges) {
    if (changes['allTopics']) {
      this.allTopicsObj.allTopics = changes['allTopics'].currentValue;
    }
    this.columns = Object.assign([], BASE_COLUMNS);
    if (this.hideTagColumn) {
      this.columns = this.columns.filter(c => c != "tag");
    }
    if (!this.allTopics) {
      this.columns = this.columns.filter(c => c != "comments");
    }
    let vocIds = [...this.vocabularies];
    vocIds.sort((id1, id2) => -id1.localeCompare(id2));
    for (let vocId of vocIds) {
      this.columns.splice(3, 0, "codes-" + vocId);
    }
    for (const concept of this.selection.selected) {
      if (this.concepts[concept.id] === undefined) {
        this.selection.deselect(concept);
      }
    }
    this.conceptsList = Object.values(this.concepts);
    this.conceptsList.sort(sortConcepts);
  }

  isAllSelected() {
    return this.selection.selected.length == this.conceptsList.length;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selectAll();
    }
  }

  selectAll() {
    this.conceptsList.forEach(row => this.selection.select(row));
  }

  setSelected(concepts : Concept[]) {
    this.selection.clear();
    for (let concept of concepts) {
      this.selection.select(concept);
    }
  }

  showReviews(cui : ConceptId) {
    const dialogRef = this.dialog.open(ReviewsDialogComponent, {
      data: {
        heading: `Comments on concept ${cui}: ${this.concepts[cui].name}`,
        cui,
        allTopicsObj: this.allTopicsObj,
        data: this.reviewData,
        userIsEditor: this.auth.userIsEditor,
        run: this.reviewRun,
      }
    });
    dialogRef.afterClosed().subscribe(res => { });
  }

  navigateToComments(id : ConceptId) {
  }
}