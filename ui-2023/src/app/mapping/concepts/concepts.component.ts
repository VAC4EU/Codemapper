import { Component, TemplateRef, Input, Output, EventEmitter, OnChanges, OnInit, ViewChild, SimpleChanges } from '@angular/core';
import { debounceTime, catchError, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { ConceptsTableComponent } from '../concepts-table/concepts-table.component';
import { FormControl } from '@angular/forms';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTable } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';
import { TagsDialogComponent } from '../tags-dialog/tags-dialog.component';
import { ConceptsDialogComponent } from '../concepts-dialog/concepts-dialog.component';
import { Mapping, Concept, ConceptId, Concepts, Code, Codes, CodeId, Indexing, VocabularyId, Vocabulary, tagsInConcepts, filterConcepts } from '../data';
import { AllTopics, AllTopics0, ReviewOperation } from '../review';
import { ApiService } from '../api.service';
import * as ops from '../mapping-ops';

@Component({
  selector: 'concepts',
  templateUrl: './concepts.component.html',
  styleUrls: ['./concepts.component.scss']
})
export class ConceptsComponent implements OnInit {
  @Input() mapping! : Mapping;
  @Input() allTopics : AllTopics = new AllTopics();
  @ViewChild(ConceptsTableComponent) table! : ConceptsTableComponent;
  @Output() run = new EventEmitter<ops.Operation>();
  @Output() reviewRun = new EventEmitter<ReviewOperation>();

  selectedConcepts : Concept[] = [];
  ignoreTermTypes : string = "";
  umlsVersion : string | null = null;
  codeSearchQueryControl = new FormControl('');
  codeConcepts : Concept[] = [];
  dialogRef : MatDialogRef<any, any> | null = null;

  constructor(
    private dialog : MatDialog,
    private api : ApiService,
  ) {
    this.api.versionInfo().subscribe(info => {
      this.umlsVersion = info.umlsVersion
      this.ignoreTermTypes = info.ignoreTermTypes.join(",");
    });
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
        this.addConcepts(selected, codes);
      })
  }

  searchAddConcepts(query : string) {
    this.api.searchUts(query, this.vocIds())
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
    this.api.broaderConcepts(concept.id, this.vocIds())
      .subscribe(({ concepts, codes }) =>
        this.confirmAddConceptsDialog(concepts, codes, `Concepts broader than ${concept.name}`))
  }

  narrowerConcepts(concept : Concept, vocIds : VocabularyId[]) {
    this.api.narrowerConcepts(concept.id, this.vocIds())
      .subscribe(({ concepts, codes }) =>
        this.confirmAddConceptsDialog(concepts, codes, `Concepts narrower than ${concept.name}`))
  }

  showTagsDialog(concepts : Concept[]) {
    let tag = null;
    if (concepts.length == 1) {
      tag = concepts[0].tag;
    }
    let availableTags = this.mapping.allTags();
    let codeConcepts = {
      data: { availableTags, tag },
      width: '40em',
    };
    this.dialog
      .open(TagsDialogComponent, codeConcepts)
      .afterClosed().subscribe(tag => {
        if (tag !== undefined) {
          let conceptIdsTags = Object.fromEntries(concepts.map((c) => [c.id, tag]));
          this.run.emit(new ops.ConceptsSetTag(conceptIdsTags));
        }
      });
  }
  remap() {
    if (this.umlsVersion != null) {
      let ignoreTermTypes = this.ignoreTermTypes.split(",");
      let umlsVersion = this.umlsVersion;
      this.api.concepts(Object.keys(this.mapping.concepts), Object.keys(this.mapping.vocabularies), ignoreTermTypes)
        .subscribe(conceptsCodes => {
          this.run.emit(new ops.Remap(umlsVersion, conceptsCodes));
        });
    } else {
      console.error("unknown UMLS version");
    }
  }

  addIndexing(indexing : Indexing) {
    let ids = indexing.concepts.map(c => c.id);
    this.api.concepts(ids, this.vocIds())
      .subscribe(({ concepts, codes }) => this.run.emit(new ops.AddConcepts(concepts, codes)));
  }
}
