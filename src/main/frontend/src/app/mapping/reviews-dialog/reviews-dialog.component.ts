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

import { Component, Inject, EventEmitter } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConceptId, VocabularyId, CodeId } from '../mapping-data';
import { AllTopics, TopicsInfo, ReviewData, ReviewOperation } from '../review';

export interface ReviewsData {
  heading : string;
  cui : ConceptId | null;
  voc : VocabularyId | null;
  code : CodeId | null;
  allTopicsObj : { allTopics : AllTopics };
  data : ReviewData;
  userIsEditor : boolean;
  run : EventEmitter<ReviewOperation>;
}

@Component({
  selector: 'app-reviews-dialog',
  templateUrl: './reviews-dialog.component.html',
  styleUrls: ['./reviews-dialog.component.scss']
})
export class ReviewsDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<ReviewsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : ReviewsData,
  ) { }
  getTopics() : TopicsInfo {
    let res = null;
    if (this.data.cui) {
      res = this.data.allTopicsObj.allTopics.byConcept[this.data.cui]
    } else if (this.data.voc && this.data.code) {
      res = this.data.allTopicsObj.allTopics.byCode[this.data.voc]?.[this.data.code];
    }
    return res ?? new TopicsInfo();
  }
  close() {
    this.dialogRef.close();
  }
}
