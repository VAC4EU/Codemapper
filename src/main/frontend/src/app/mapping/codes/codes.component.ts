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

import { ViewChild, Component, Input, Output, EventEmitter, SimpleChanges, input, effect, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Code, CodeId, Vocabulary, VocabularyId, ConceptId, Tag } from '../mapping-data';
import * as ops from '../operations';
import { AllTopics, ReviewData, ReviewOperation } from '../review';
import { ApiService, Descendants } from '../api.service';
import { compareCodes } from '../sort.pipe';

import { CodeDialogComponent } from '../code-dialog/code-dialog.component';
import { TagsDialogComponent } from '../tags-dialog/tags-dialog.component';
import { CodesDialogComponent } from '../codes-dialog/codes-dialog.component';
import { CodesTableComponent } from '../codes-table/codes-table.component';
import { MappingState } from '../mapping-state';

@Component({
    selector: 'codes',
    templateUrl: './codes.component.html',
    styleUrls: ['./codes.component.scss'],
    standalone: false
})
export class CodesComponent {
  state = input.required<MappingState>();
  @Input() allTopics : AllTopics = new AllTopics();
  @Input() reviewData : ReviewData = new ReviewData();
  @Input() userCanEdit : boolean = false;
  @Output() run = new EventEmitter<ops.Operation>();
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();

  @ViewChild(CodesTableComponent) table! : CodesTableComponent;

  vocabularyId! : VocabularyId;
  vocabulary! : Vocabulary;
  codes : Code[] = [];
  vocabularyIds : VocabularyId[] = [];
  selected : Code[] = [];
  codesFilter : string = "";

  constructor(
    public dialog : MatDialog,
    private api : ApiService,
  ) { }

  setSelected(selected : Code[]) {
    this.selected = selected;
  }

  ngOnInit() {
    let vocIds = Object.keys(this.state().mapping.vocabularies);
    vocIds.sort((id1, id2) => id1.localeCompare(id2));
    this.vocabularyId = vocIds[0];
  }

  ngOnChanges(changes : SimpleChanges) {
    this.update();
  }

  update() {
    let mapping = this.state().mapping;
    if (!this.vocabularyId || !mapping.vocabularies[this.vocabularyId]) {
      let vocIds = Object.keys(mapping.vocabularies);
      vocIds.sort((id1, id2) => id1.localeCompare(id2));
      this.vocabularyId = vocIds[0];
    }
    let codes = mapping.codes[this.vocabularyId] ?? {};
    this.vocabulary = mapping.vocabularies[this.vocabularyId];
    this.codes = Object.values(codes);
    this.codes.sort((c1, c2) => compareCodes(c1.id, c2.id));
    this.vocabularyIds = Object.keys(mapping.vocabularies).sort();
  }

  selectVocabulary(id : VocabularyId) {
    this.vocabularyId = id;
    this.update();
  }

  isCustom(id : VocabularyId) {
    return this.state().mapping.vocabularies[id].custom;
  }

  conceptIds(code : Code) : ConceptId[] {
    return Array.from(this.state().caches.getConceptsByCode(this.vocabularyId, code.id));
  }

  conceptName(id : ConceptId) : string {
    return this.state().mapping.concepts[id]?.name ?? "n/a"
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
    let tags = new Set(codes.filter(c => c.tag != null).map(c => c.tag));
    let tag = tags.size == 1 ? tags.values().next().value : null;
    let options = {
      data: {
        tag,
        heading: `${codes.length} code${codes.length == 1 ? '' : 's'}`,
        allowedTags: this.state().mapping.meta.allowedTags,
      },
      width: '40em',
    };
    this.dialog.open(TagsDialogComponent, options)
      .afterClosed().subscribe(tag => {
        if (tag !== undefined) {
          let codeIds = Object.fromEntries(codes.map((code) => [code.id, tag]));
          this.run.emit(new ops.CodesSetTag({[this.vocabularyId]: codeIds}));
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
        concepts: Object.values(this.state().mapping.concepts),
        codeIds: Object.keys(this.state().mapping.codes[this.vocabularyId]),
        idEditable: true,
      }
    });
    dialogRef.afterClosed().subscribe(data => {
      if (data !== undefined) {
        let code = {id: data.id, term: data.term, custom: true, enabled: true, tag: null};
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
    let concepts = this.state().caches.getConceptsByCode(this.vocabularyId, selected.id);
    if (concepts.size != 1) {
      console.error("custom code must have exactly one concept");
      return;
    }
    const dialogRef = this.dialog.open(CodeDialogComponent, {
      data: {
        code: {
          id: selected.id,
          term: selected.term,
          concept: concepts.values().next().value,
        },
        operation: "Edit custom code",
        concepts: Object.values(this.state().mapping.concepts),
        codeIds: Object.keys(this.state().mapping.codes[this.vocabularyId]),
        idEditable: false,
      }
    });
    dialogRef.afterClosed().subscribe(data => {
      if (data !== undefined) {
        let code = {id: data.id, term: data.term, custom: selected.custom, enabled: selected.enabled, tag: selected.tag};
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
          mapping: this.state,
        };
        this.dialog.open(CodesDialogComponent, { data });
      });
  }

  importCustomCodeDialog() {
  }

  numCodes(vocId : VocabularyId) : number {
    return Object.keys(this.state().mapping.codes[vocId]).length
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
