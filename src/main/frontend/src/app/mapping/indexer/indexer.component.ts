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
  Output,
  EventEmitter,
  Component,
  ViewChild,
  SimpleChanges,
  OnChanges,
  signal,
  effect,
  viewChild,
  OnInit,
} from '@angular/core';
import {
  Concept,
  Concepts,
  ConceptId,
  StartType,
  Span,
  Indexing,
  cuiOfId,
  VocabularyId,
} from '../mapping-data';
import { ApiService, EMPTY_TYPES_INFO, TypesInfo } from '../api.service';
import { ConceptsTableComponent } from '../concepts-table/concepts-table.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

enum State {
  Editing,
  Indexed,
}

@Component({
  selector: 'indexer',
  templateUrl: './indexer.component.html',
  styleUrls: ['./indexer.component.scss'],
  standalone: false,
})
export class IndexerComponent implements OnChanges, OnInit {
  @Input({ required: true }) vocIds!: VocabularyId[];
  @Input() typesInfo: TypesInfo = EMPTY_TYPES_INFO;
  @Input() initialIndexing: Indexing | null = null;
  @Input() locked: boolean = false;
  @Input() confirmLabel: string = '';
  @Output() confirmedIndexing = new EventEmitter<Indexing>();

  text: string = ''; // ngModel of the textarea
  indexedText: string | null = null; // text when last call to index()
  spans: Span[] = [];
  selected: Concept[] = [];
  concepts: { [key: ConceptId]: Concept } = {};
  table = viewChild<ConceptsTableComponent>('indexerConceptsTable');

  state: State = State.Editing;
  rendering: SafeHtml | null = null;

  readonly State = State;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {
    effect(() => {
      let table = this.table();
      if (table === undefined) return;
      let concepts = table.selectedFiltered();
      this.selected = concepts;
      let ids = concepts.map((c) => c.id);
      let elts = document.getElementsByClassName('indexedConcept');
      for (let i = 0; i < elts.length; i++) {
        let elt = elts[i];
        if (ids.some((id) => elt.classList.contains(id))) {
          elt.classList.add('enabled');
        } else {
          elt.classList.remove('enabled');
        }
      }
    });
  }

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (this.initialIndexing != null) {
      this.state = State.Indexed;
      this.text = this.initialIndexing.text;
      this.spans = this.initialIndexing.spans;
      this.concepts = Object.fromEntries(
        this.initialIndexing.concepts.map((c) => [c.id, c])
      );
      this.selected = this.initialIndexing.concepts.filter((c) =>
        this.initialIndexing!.selected.includes(c.id)
      );
      this.setRendering(this.text, this.spans, this.concepts, this.selected);
      setTimeout(() =>
        this.table()?.setSelected(this.selected.map((c) => c.id))
      );
    }
  }

  async index(text: string) {
    let spans = await this.api.peregrineIndex(text);
    let { concepts } = await this.api.concepts(
      spans.map((s) => cuiOfId(s.id)),
      this.vocIds,
      this.typesInfo
    );
    console.log('INDEX CONCEPTS', concepts);
    this.indexedText = text;
    this.state = State.Indexed;
    this.spans = spans;
    this.concepts = concepts;
    this.setRendering(
      this.text,
      this.spans,
      this.concepts,
      Object.values(this.concepts)
    );
    setTimeout(() => this.table()?.selectAll());
  }

  setRendering(
    text: string,
    spans: Span[],
    concepts: Concepts,
    selected: Concept[]
  ) {
    let rendering = this.highlight(
      text,
      spans,
      Object.values(concepts),
      selected
    );
    this.rendering = this.sanitizer.bypassSecurityTrustHtml(rendering);
  }

  setEditing() {
    this.concepts = {};
    this.selected = [];
    this.state = State.Editing;
  }

  getIndexing(): Indexing {
    if (this.indexedText != null) {
      return {
        type: StartType.Indexing,
        text: this.indexedText,
        spans: this.spans,
        concepts: Object.values(this.concepts),
        selected: this.selected.map((c) => c.id),
      };
    } else {
      throw new Error('Not indexed, cannot get indexing');
    }
  }

  highlight(
    text: string,
    spans0: Span[],
    concepts: Concept[],
    selected: Concept[]
  ) {
    let group = (
      array: Span[],
      by: (span: Span) => number
    ): { [key: number]: Span[] } => {
      var res: { [key: number]: Span[] } = {};
      for (let elt of array) {
        var key = by(elt);
        res[key] ??= [];
        res[key].push(elt);
      }
      return res;
    };
    let selectedCuis = selected.map((c) => c.id);
    var conceptsByCui = Object.fromEntries(concepts.map((c) => [c.id, c]));
    let spans = spans0.filter(
      (s) => conceptsByCui[cuiOfId(s.id)] !== undefined
    );
    var spansByStart: { [key: number]: Span[] } = group(spans, (s) => s.start);
    var result = '';
    var ends: number[] = [];
    var here = 0;
    for (let c of text) {
      var hereStartSpans = spansByStart[here] || [];
      var hereStartSpansByEnd: { [key: number]: Span[] } = group(
        hereStartSpans,
        (s) => s.end
      );
      for (let [end, hereSpans] of Object.entries(hereStartSpansByEnd)) {
        var cuis = hereSpans.map((s) => cuiOfId(s.id));
        var concepts = cuis
          .map((cui) => conceptsByCui[cui])
          .filter((c) => c !== undefined);
        var title = concepts
          .map((c) => conceptsByCui[c.id]?.name)
          .filter((s) => s !== undefined)
          .join(', ');
        let cuiClasses = concepts.map((c) => c.id).join(' ');
        let enabled = cuis.some((cui) => selectedCuis.includes(cui))
          ? 'enabled '
          : '';
        result += `<span class="indexedConcept ${enabled}${cuiClasses}" title="${title}" >`;
        ends.push(+end);
      }
      if (c == '\n' || c == '\r') {
        if (ends.length == 0) {
          result += '<br/>';
        } else {
          result += ' ';
        }
      } else {
        result += `<span>${c}</span>`;
      }
      ends.sort();
      while (ends.length > 0 && ends[0] == here) {
        result += '</span>';
        ends.shift();
      }
      here += 1;
    }
    while (ends.length > 0) {
      result += '</span>';
      ends.shift();
    }
    return "<div class='highlight'>" + result + '</div>';
  }
}
