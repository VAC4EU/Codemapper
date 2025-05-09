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

import { Component, TemplateRef, Input, Output, EventEmitter, OnInit, ViewChild } from '@angular/core';
import { debounceTime, catchError, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { ConceptsTableComponent } from '../concepts-table/concepts-table.component';
import { FormControl } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TagsDialogComponent } from '../tags-dialog/tags-dialog.component';
import { ConceptsDialogComponent } from '../concepts-dialog/concepts-dialog.component';
import { Mapping, Concept, Concepts, Codes, Indexing, VocabularyId, Vocabularies, filterConcepts, CodeId, Tag } from '../data';
import { AllTopics, ReviewOperation } from '../review';
import { ApiService, TypesInfo } from '../api.service';
import * as ops from '../mapping-ops';
import { CodeTags } from '../mapping-ops';

@Component({
  selector: 'concepts',
  templateUrl: './concepts.component.html',
  styleUrls: ['./concepts.component.scss']
})
export class ConceptsComponent implements OnInit {
  @Input() mapping! : Mapping;
  @Input() vocabularies! : Vocabularies;
  @Input() allTopics : AllTopics = new AllTopics();
  @Input() userCanEdit : boolean = false;
  @Output() run = new EventEmitter<ops.Operation>();
  @Output() reviewRun = new EventEmitter<ReviewOperation>();
  @ViewChild(ConceptsTableComponent) table! : ConceptsTableComponent;

  selectedConcepts : Concept[] = [];
  codeSearchQueryControl = new FormControl('');
  codeConcepts : Concept[] = [];
  dialogRef : MatDialogRef<any, any> | null = null;
  conceptsFilter : string = "";

  constructor(
    private dialog : MatDialog,
    private api : ApiService,
  ) { }

  get numConcepts() : number {
    return Object.keys(this.mapping.concepts).length;
  }

  openDialog(templateRef : TemplateRef<any>) {
    this.dialogRef = this.dialog.open(templateRef, {
      width: '700px'
    });
  }

  setSelectedConcepts(selected : Concept[]) {
    setTimeout( // avoid ExpressionChangedAfterItHasBeenCheckedError
      () => this.selectedConcepts = selected, 0);
  }

  hasSelectedConcepts() : boolean {
    return this.selectedConcepts.length > 0;
  }

  ngOnInit() {
    this.codeSearchQueryControl
      .valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query : string | null) => {
          if (query == null || query == "") {
            return [];
          }
          let parts = query.split(':');
          let voc, query1;
          if (parts.length > 1) {
            voc = parts[0];
            query1 = parts.slice(1).join(':');
          } else {
            voc = "";
            query1 = query;
          }
          return this.api.autocompleteCode(voc, query1)
            .pipe(map(cs => cs.filter(c => !this.mapping.concepts[c.id])))
            .pipe(catchError(err => {
              console.error("Could not autocomplete code", err);
              return []
            }));
        }))
      .subscribe(codeConcepts => this.codeConcepts = codeConcepts);
  }

  vocIds() : VocabularyId[] {
    return Object.keys(this.mapping.vocabularies);
  }

  selectAutocompleteCode(concept0 : Concept, query : string) {
    this.api.concept(concept0.id, this.vocIds())
      .subscribe(([concept, codes]) =>
        this.confirmAddConceptsDialog(
          { [concept.id]: concept },
          codes,
          `Concept selected from code query ${query}`))
  }

  showComments() {
    console.log("show comments");
  }

  delete(concepts : Concept[]) {
    for (const concept of concepts) {
      this.run.emit(new ops.RemoveConcept(concept.id));
    }
  }

  addConcepts(selected : Concept[], codes : Codes) {
    let concepts : Concepts = {};
    for (let concept of selected) {
      concepts[concept.id] = concept;
    }
    this.run.emit(new ops.AddConcepts(concepts, codes)
      .withAfterRunCallback(() => {
        this.table.setSelected(selected);
        this.codeConcepts = [];
        this.codeSearchQueryControl.setValue("");
      }))
  }

  confirmAddConceptsDialog(concepts : Concepts, codes : Codes, title : string) {
    let currentCuis = Object.keys(this.mapping.concepts);
    return this.dialog.open(ConceptsDialogComponent, {
      data: {
        title,
        action: "Add selected concepts",
        concepts: filterConcepts(concepts, currentCuis),
        codes,
        vocabularies: this.vocIds()
      }
    })
      .afterClosed()
      .subscribe(selected => {
        if (selected) this.addConcepts(selected, codes);
      })
  }

  searchAddConcepts(query : string, info : TypesInfo) {
    this.api.searchUts(query, this.vocIds(), info)
      .subscribe(({ concepts, codes }) =>
        this.confirmAddConceptsDialog(concepts, codes, `Concepts matching query "${query}"`))
  }
  //
  // searchAddCodes(query : string, voc: VocabularyId) {
  //   this.api.autocompleteCode(voc, query)
  //     .subscribe(concepts =>
  //       this.api.concepts(Object.keys(concepts), this.vocIds())
  //         .subscribe(({ concepts, codes }) =>
  //           this.confirmAddConceptsDialog(concepts, codes, `Codes matching ${query}`)))
  //   }
  // }

  broaderConcepts(concept : Concept, vocIds : VocabularyId[]) {
    this.api.broaderConcepts(concept.id, this.vocIds(), this.mapping.meta)
      .subscribe(({ concepts, codes }) =>
        this.confirmAddConceptsDialog(concepts, codes, `Concepts broader than ${concept.name}`))
  }

  narrowerConcepts(concept : Concept, vocIds : VocabularyId[]) {
    this.api.narrowerConcepts(concept.id, this.vocIds(), this.mapping.meta)
      .subscribe(({ concepts, codes }) =>
        this.confirmAddConceptsDialog(concepts, codes, `Concepts narrower than ${concept.name}`))
  }

  showTagsDialog(concepts : Concept[]) {
    let tags = new Set();
    let codes: CodeTags = {};
    for (let concept of concepts) {
      for (let vocId of Object.keys(concept.codes)) {
        codes[vocId] ??= {};
        for (let codeId of concept.codes[vocId]) {
          let code = this.mapping.codes[vocId][codeId];
          if (!code.enabled) continue;
          codes[vocId][codeId] = null;
          if (code.tag != null) tags.add(code.tag);
        }
      }
    }
    let codesCount = Object.values(codes).map(o => Object.keys(o).length).reduce((x, y) => x + y, 0);
    let tag = tags.size == 1 ? tags.values().next().value : null;
    let config = {
      data: {
        tag: tag,
        heading: `${codesCount} codes in ${concepts.length} concepts`,
        allowedTags: this.mapping.meta.allowedTags
      },
      width: '40em',
    };
    this.dialog
      .open(TagsDialogComponent, config)
      .afterClosed().subscribe(tag => {
        if (tag !== undefined) {
          for (let vocId of Object.keys(codes)) {
            for (let codeId of Object.keys(codes[vocId])) {
              codes[vocId][codeId] = tag;
            }
          }
          this.run.emit(new ops.CodesSetTag(codes));
        }
      });
  }

  addIndexing(indexing : Indexing) {
    let ids = indexing.concepts.map(c => c.id);
    this.api.concepts(ids, this.vocIds(), this.mapping.meta)
      .subscribe(({ concepts, codes }) => this.run.emit(new ops.AddConcepts(concepts, codes)));
  }
}
