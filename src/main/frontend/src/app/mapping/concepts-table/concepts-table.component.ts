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

import {
  Input,
  Component,
  Output,
  EventEmitter,
  effect,
  input,
  viewChild,
  signal,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { ReviewsDialogComponent } from '../reviews-dialog/reviews-dialog.component';
import {
  Concept,
  VocabularyId,
  ConceptId,
  CodeId,
  Code,
  Tag,
} from '../mapping-data';
import { AllTopics, ReviewData, ReviewOperation } from '../review';
import { AuthService } from '../auth.service';
import { MatPaginator } from '@angular/material/paginator';
import { CacheConceptTags } from '../caches';

const BASE_COLUMNS = ['concept', 'comments'];

function sortConcepts(c1: Concept, c2: Concept): number {
  return (c1.name ?? '').localeCompare(c2.name ?? '');
}

function arrayEquals<T>(a1: T[], a2: T[]): boolean {
  return a1.length === a2.length && a1.every((v: T, i: number) => v === a2[i]);
}

@Component({
  selector: 'concepts-table',
  templateUrl: './concepts-table.component.html',
  styleUrls: ['./concepts-table.component.scss'],
  standalone: false,
})
export class ConceptsTableComponent {
  concepts = input<{ [key: ConceptId]: Concept }>({});
  codes = input<{ [key: VocabularyId]: { [key: CodeId]: Code } }>({});
  allTopics = input<AllTopics | null>(null);
  vocabularies = input<VocabularyId[]>([]);
  paginator = input<MatPaginator | null>(null);
  filter = input('');

  @Input() conceptTags: CacheConceptTags = new CacheConceptTags({});
  @Input() reviewData: ReviewData = new ReviewData();
  @Input() hideTagColumn: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showCodeTagIndication: boolean = false;
  @Input() userCanEdit: boolean = false;
  @Input() showSelectors: boolean = true;

  @Output() reviewRun: EventEmitter<ReviewOperation> = new EventEmitter();

  selectedFiltered = signal<Concept[]>([]);

  // call if filter, selection, or concepts changed
  updateSelectedFiltered() {
    let filtered = new Set(this.dataSource.filteredData.map((c) => c.id));
    let selectedFiltered = this.selection.selected.filter((c) =>
      filtered.has(c.id)
    );
    this.selectedFiltered.set(selectedFiltered);
  }

  sort = viewChild.required(MatSort);
  dataSource: MatTableDataSource<Concept> = new MatTableDataSource<Concept>();
  selection = new SelectionModel<Concept>(true, []);
  columns: string[] = [];

  // indirection to reviews to get updates in the review dialog
  allTopicsObj: { allTopics: AllTopics } = { allTopics: new AllTopics() };

  lastVocabularies = [];

  constructor(private dialog: MatDialog, private auth: AuthService) {
    this.selection.changed.subscribe(() => {
      this.updateSelectedFiltered();
    });
    effect(() => {
      this.dataSource.filter = this.filter().trim().toLowerCase();
      this.updateSelectedFiltered();
    });
    effect(() => {
      let concepts = this.concepts();
      this.dataSource.data = Object.values(concepts);
      this.dataSource.data.sort(sortConcepts);
      this.dataSource.filterPredicate = this.filterPredicate.bind(this);
      let cuis = new Set(this.selection.selected.map((c) => c.id));
      this.selection.setSelection(
        ...this.dataSource.data.filter((c) => cuis.has(c.id))
      );
      this.updateSelectedFiltered();
    });
    effect(() => {
      let allTopics = this.allTopics();
      this.allTopicsObj.allTopics = allTopics ?? new AllTopics();
    });
    effect(() => {
      let vocabularies = this.vocabularies();
      if (!arrayEquals(this.lastVocabularies, vocabularies)) {
        this.setColumns(vocabularies);
      }
    });
  }

  filterPredicate(concept: Concept, filter: string) {
    let codes = Object.values(concept.codes)
      .map((ids) => Array.from(ids).join(' '))
      .join(' ');
    let haystack = concept.id + ' ' + concept.name + ' ' + codes;
    return haystack.toLowerCase().includes(filter);
  }

  setColumns(vocabularies: VocabularyId[]) {
    this.columns = [];
    if (this.showSelectors) {
      this.columns.push('select');
    }
    this.columns.push(...BASE_COLUMNS);
    if (this.hideTagColumn) {
      this.columns = this.columns.filter((c) => c != 'tag');
    }
    if (!this.allTopics()) {
      this.columns = this.columns.filter((c) => c != 'comments');
    }
    let vocIds = [...vocabularies];
    vocIds.sort((id1, id2) => id1.localeCompare(id2));
    for (let vocId of vocIds) {
      this.columns.push('codes-' + vocId);
    }
  }

  ngAfterViewInit() {
    this.setColumns(this.vocabularies());
    this.dataSource.sort = this.sort();
    this.dataSource.paginator = this.paginator();
    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
      switch (property) {
        case 'concept':
          return item.name;
        default:
          return item[property];
      }
    };
  }

  get filteredConcepts(): Concept[] {
    return this.dataSource.filteredData;
  }

  isAllFilteredSelected() {
    return (
      this.dataSource.filteredData.length <= this.selection.selected.length &&
      this.dataSource.filteredData.every(
        (c) => this.selection.selected.indexOf(c) != -1
      )
    );
  }

  toggleAllRows() {
    if (this.isAllFilteredSelected()) {
      this.selection.clear();
    } else {
      this.selectAll();
    }
  }

  selectAll() {
    this.selection.select(...this.dataSource.filteredData);
  }

  setSelected(cuis: string[]) {
    let concepts0 = this.concepts();
    let concepts = cuis
      .map((id) => concepts0[id])
      .filter((c) => c !== undefined);
    this.selection.setSelection(...concepts);
  }

  showReviews(cui: ConceptId) {
    const dialogRef = this.dialog.open(ReviewsDialogComponent, {
      width: '80em',
      data: {
        heading: `Review ${cui}: ${this.concepts()[cui].name}`,
        cui,
        allTopicsObj: this.allTopicsObj,
        data: this.reviewData,
        userIsEditor: this.userCanEdit,
        run: this.reviewRun,
      },
    });
    dialogRef.afterClosed().subscribe((res) => {});
  }

  navigateToComments(id: ConceptId) {}
}
