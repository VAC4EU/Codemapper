import { Input, Output, EventEmitter, Component, ViewChild, SimpleChanges, OnChanges } from '@angular/core';
import { Concept, Concepts, ConceptId, StartType, Span, Indexing, cuiOfId } from '../data';
import { ApiService } from '../api.service';
import { ConceptsTableComponent } from '../concepts-table/concepts-table.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

enum State {
  Editing,
  Indexed,
}

@Component({
  selector: 'indexer',
  templateUrl: './indexer.component.html',
  styleUrls: ['./indexer.component.scss']
})
export class IndexerComponent implements OnChanges {
  @Input() initialIndexing : Indexing | null = null;
  @Input() locked : boolean = false;
  @Input() confirmLabel : string = "";
  @Output() confirmedIndexing = new EventEmitter<Indexing>;

  text : string = ""; // ngModel of the textarea
  indexedText : string | null = null; // text when last call to index()
  spans : Span[] = [];
  selected : Concept[] = [];
  concepts : { [key : ConceptId] : Concept } = {};
  @ViewChild(ConceptsTableComponent) table! : ConceptsTableComponent;

  state : State = State.Editing;
  rendering : SafeHtml | null = null;

  readonly State = State;

  constructor(
    private api : ApiService,
    private sanitizer : DomSanitizer,
  ) { }

  ngOnChanges(changes : SimpleChanges) {
    if (this.initialIndexing != null) {
      this.state = State.Indexed;
      this.text = this.initialIndexing.text;
      this.spans = this.initialIndexing.spans;
      this.concepts = Object.fromEntries(this.initialIndexing.concepts.map(c => [c.id, c]));
      this.selected = this.initialIndexing.concepts
        .filter(c => this.initialIndexing!.selected.includes(c.id));
      this.setRendering(this.text, this.spans, this.concepts, this.selected);
      if (this.table) {
        this.table.setSelected(this.selected);
      }
    }
  }

  ngAfterViewInit() {
    this.table.setSelected(this.selected);
  }

  setSelected(concepts : Concept[]) {
    this.selected = concepts;
    let ids = concepts.map(c => c.id);
    let elts = document.getElementsByClassName("indexedConcept");
    for (let i = 0; i < elts.length; i++) {
      let elt = elts[i];
      if (ids.some(id => elt.classList.contains(id))) {
        elt.classList.add("enabled");
      } else {
        elt.classList.remove("enabled");
      }
    }
  }

  index(text : string) {
    this.api.peregrineIndex(text)
      .subscribe(([spans, concepts]) => {
        this.indexedText = text;
        this.state = State.Indexed;
        this.spans = spans;
        this.concepts = concepts;
        this.setRendering(this.text, this.spans, this.concepts, Object.values(this.concepts));
        setTimeout(() => this.table.selectAll(), 0);
      });
  }

  setRendering(text : string, spans : Span[], concepts : Concepts, selected : Concept[]) {
    let rendering = this.highlight(text, spans, Object.values(concepts), selected);
    this.rendering = this.sanitizer.bypassSecurityTrustHtml(rendering);
  }

  setEditing() {
    this.concepts = {};
    this.selected = [];
    this.state = State.Editing;
  }

  getIndexing() : Indexing {
    if (this.indexedText != null) {
      return {
        type: StartType.Indexing,
        text: this.indexedText,
        spans: this.spans,
        concepts: Object.values(this.concepts),
        selected: this.selected.map(c => c.id),
      };
    } else {
      throw new Error("Not indexed, cannot get indexing");
    }
  }

  highlight(text : string, spans0 : Span[], concepts : Concept[], selected : Concept[]) {
    let group = (array : Span[], by : (span : Span) => number) : { [key : number] : Span[] } => {
      var res : { [key : number] : Span[] } = {};
      for (let elt of array) {
        var key = by(elt);
        res[key] ??= [];
        res[key].push(elt);
      }
      return res;
    }
    let selectedCuis = selected.map(c => c.id);
    var conceptsByCui = Object.fromEntries(concepts.map(c => [c.id, c]));
    let spans = spans0.filter(s => conceptsByCui[cuiOfId(s.id)] !== undefined);
    var spansByStart : { [key : number] : Span[] } = group(spans, s => s.start);
    var result = "";
    var ends : number[] = [];
    var here = 0;
    for (let c of text) {
      var hereStartSpans = spansByStart[here] || [];
      var hereStartSpansByEnd : { [key : number] : Span[] } =
        group(hereStartSpans, s => s.end);;
      for (let [end, hereSpans] of Object.entries(hereStartSpansByEnd)) {
        var cuis = hereSpans.map(s => cuiOfId(s.id));
        var concepts = cuis.map(cui => conceptsByCui[cui]).filter(c => c !== undefined);
        var title = concepts
          .map(c => conceptsByCui[c.id]?.name)
          .filter(s => s !== undefined)
          .join(", ");
        var cuisStr = concepts.map(c => c.id).join(" ");
        let cuiClasses = concepts.map(c => c.id).join(" ")
        let enabled = cuis.some(cui => selectedCuis.includes(cui)) ? "enabled " : "";
        result += `<span class="indexedConcept ${enabled}${cuiClasses}" title="${title}" >`;
        ends.push(+end);
      }
      if (c == '\n' || c == '\r') {
        if (ends.length == 0) {
          result += "<br/>";
        } else {
          result += ' ';
        }
      } else {
        result += `<span>${c}</span>`;
      }
      ends.sort();
      while (ends.length > 0 && ends[0] == here) {
        result += "</span>";
        ends.shift();
      }
      here += 1;
    }
    while (ends.length > 0) {
      result += "</span>";
      ends.shift();
    }
    return "<div class='highlight'>" + result + "</div>";
  }
}
