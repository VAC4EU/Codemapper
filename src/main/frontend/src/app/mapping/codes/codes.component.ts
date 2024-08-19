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

import { ViewChild, Component, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NgFor } from '@angular/common';
import { MatTable } from '@angular/material/table';
import { Mapping, Code, Concept, CodeId, Vocabulary, VocabularyId, ConceptId, Tag, tagsInCodes, tagsInConcepts } from '../data';
import * as ops from '../mapping-ops';
import { AllTopics, TopicsInfo, ReviewData, ReviewOperation } from '../review';
import { AuthService } from '../auth.service';
import { ApiService, Descendants } from '../api.service';
import { compareCodes } from '../sort.pipe';

import { CodeDialogComponent } from '../code-dialog/code-dialog.component';
import { TagsDialogComponent } from '../tags-dialog/tags-dialog.component';
import { CodesDialogComponent } from '../codes-dialog/codes-dialog.component';
import { CodesTableComponent } from '../codes-table/codes-table.component';

@Component({
  selector: 'codes',
  templateUrl: './codes.component.html',
  styleUrls: ['./codes.component.scss'],
})
export class CodesComponent {
  @Input() mapping! : Mapping;
  @Input() allTopics : AllTopics = new AllTopics();
  @Input() reviewData : ReviewData = new ReviewData();
  @Output() run = new EventEmitter<ops.Operation>();
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();

  @ViewChild(CodesTableComponent) table! : CodesTableComponent;

  vocabularyId! : VocabularyId;
  vocabulary! : Vocabulary;
  codes : Code[] = [];
  vocabularyIds : VocabularyId[] = [];
  selected : Code[] = [];

  constructor(
    public dialog : MatDialog,
    private auth : AuthService,
    private api : ApiService,
  ) { }

  setSelected(selected : Code[]) {
    this.selected = selected;
  }

  ngOnInit() {
    let vocIds = Object.keys(this.mapping.vocabularies);
    vocIds.sort((id1, id2) => id1.localeCompare(id2));
    this.vocabularyId = vocIds[0];
  }

  ngOnChanges(changes : SimpleChanges) {
    this.update();
  }

  update() {
    let codes = this.mapping.codes[this.vocabularyId] ?? {};
    this.vocabulary = this.mapping.vocabularies[this.vocabularyId];
    this.codes = Object.values(codes);
    this.codes.sort((c1, c2) => compareCodes(c1.id, c2.id));
    this.vocabularyIds = Object.keys(this.mapping.vocabularies).sort();
  }

  selectVocabulary(id : VocabularyId) {
    this.vocabularyId = id;
    this.update();
  }

  isCustom(id : VocabularyId) {
    return this.mapping.vocabularies[id].custom;
  }

  conceptIds(code : Code) : ConceptId[] {
    return Array.from(this.mapping.conceptsByCode[this.vocabularyId]?.[code.id] ?? []);
  }

  conceptName(id : ConceptId) : string {
    return this.mapping.concepts[id]?.name ?? "n/a"
  }

  conceptTag(id : ConceptId) : Tag | null {
    return this.mapping.concepts[id].tag;
  }

  enableCodes(codes : Code[]) {
    for (let code of codes) {
      this.run.emit(new ops.SetCodeEnabled(this.vocabularyId, code.id, true));
    }
  }

  disableCodes(codes : Code[]) {
    for (let code of codes) {
      this.run.emit(new ops.SetCodeEnabled(this.vocabularyId, code.id, false));
    }
  }

  editTags(codes : Code[]) {
    let tag = null;
    if (codes.length == 1) {
      tag = codes[0].tag;
    }
    let availableTags = this.mapping.allTags();
    let options = {
      data: { availableTags, tag },
      width: '40em',
    };
    this.dialog.open(TagsDialogComponent, options)
      .afterClosed().subscribe(tag => {
        if (tag !== undefined) {
          let codeIds = Object.fromEntries(codes.map((code) => [code.id, tag]));
          this.run.emit(new ops.CodesSetTag(this.vocabularyId, codeIds))
        }
      });
  }

  oneOrMoreCustomCodes(codes : Code[]) : boolean {
    return codes.length > 0 && codes.every(c => c.custom)
  }

  addCustomCodeDialog() {
    const dialogRef = this.dialog.open(CodeDialogComponent, {
      data: {
        code: {
          id: "",
          term: "",
          concept: "",
        },
        operation: "Create",
        concepts: Object.values(this.mapping.concepts),
        codeIds: Object.keys(this.mapping.codes[this.vocabularyId]),
        idEditable: true,
      }
    });
    dialogRef.afterClosed().subscribe(data => {
      if (data !== undefined) {
        let code = new Code(data.id, data.term, true, true, null);
        this.run.emit(new ops.AddCustomCode(this.vocabularyId, code, data.concept));
      }
    });
  }

  editCustomCodeDialog() {
    if (this.selected.length != 1) {
      console.error("edit custom code only possible with one selected code");
      return;
    }
    let selected = this.selected[0];
    if (!selected.custom) {
      console.error("edit custom code only possible with custom code");
      return;
    }
    let concepts = this.mapping.getConceptsByCode(this.vocabularyId, selected.id);
    if (concepts.length != 1) {
      console.error("custom code must have exactly one concept");
      return;
    }
    const dialogRef = this.dialog.open(CodeDialogComponent, {
      data: {
        code: {
          id: selected.id,
          term: selected.term,
          concept: concepts[0],
        },
        operation: "Edit custom code",
        concepts: Object.values(this.mapping.concepts),
        codeIds: Object.keys(this.mapping.codes[this.vocabularyId]),
        idEditable: false,
      }
    });
    dialogRef.afterClosed().subscribe(data => {
      if (data !== undefined) {
        let code = new Code(data.id, data.term, selected.custom, selected.enabled, selected.tag);
        this.run.emit(new ops.EditCustomCode(this.vocabularyId, selected.id, code, data.concept));
      }
    });
  }

  removeCustomCode(codes : Code[]) {
    for (let code of codes) {
      if (code.custom) {
        this.run.emit(new ops.RemoveCustomCode(this.vocabularyId, code.id)
          .withAfterRunCallback(() => {
            this.table.unselect(code);
          }));
      }
    }
  }

  showDescendants(parents : Code[]) {
    this.api.descendants(this.vocabularyId, parents.map(c => c.id))
      .subscribe(descs => {
        let { codes, codeParents } = codesParents(descs);
        let data = {
          title: `Descendants of ${parents.map(c => c.id).join(", ")}`,
          vocabularyId: this.vocabularyId,
          codes,
          codeParents,
          mapping: this.mapping,
        };
        this.dialog.open(CodesDialogComponent, { data });
      });
  }

  importCustomCodeDialog() {
  }
}

function codesParents(descs : Descendants) : { codes : Code[], codeParents : { [key : CodeId] : Set<CodeId> } } {
  let codes : Code[] = [];
  let codeParents : { [key : CodeId] : Set<CodeId> } = {};
  for (let parent in descs) {
    for (let code of descs[parent]) {
      if (codeParents.hasOwnProperty(code.id)) {
        continue;
      }
      if (codeParents[code.id] === undefined) {
        codeParents[code.id] = new Set();
        codes.push(code);
      }
      codeParents[code.id].add(parent);
    }
  }
  codes.sort((c1, c2) => {
    let p1 = Array.from(codeParents[c1.id] ?? []).join("-");
    let p2 = Array.from(codeParents[c2.id] ?? []).join("-");
    let cmp = p1.localeCompare(p2);
    return cmp != 0 ? cmp : compareCodes(c1.id, c2.id);
  });
  return { codes, codeParents };
}
