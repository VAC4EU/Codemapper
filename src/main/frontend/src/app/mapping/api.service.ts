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

import { firstValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../src/environments/environment';
import * as compat from './data-compatibility';
import { MappingData, Vocabulary, VocabularyId, ConceptId, Concept, Concepts, ConceptsCodes, Code, CodeId, VersionInfo, Span, Mapping, Vocabularies, cuiOfId } from './data';
import { AllTopics0 } from './review';
import { urlEncodedOptions } from '../app.module';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl : string = `${environment.apiUrl}/code-mapper`;
  private autocompleteUrl : string = `${environment.apiUrl}/code-mapper/autocomplete-code`;
  private searchUtsUrl : string = `${environment.apiUrl}/code-mapper/search-uts`;
  private conceptsUrl : string = `${environment.apiUrl}/code-mapper/umls-concepts`;
  private vocabulariesUrl : string = `${environment.apiUrl}/code-mapper/coding-systems`;
  private broaderConceptsUrl : string = `${environment.apiUrl}/code-mapper/broader-concepts`;
  private narrowerConceptsUrl : string = `${environment.apiUrl}/code-mapper/narrower-concepts`;
  private descendantsUrl : string = `${environment.apiUrl}/code-mapper/descendants`;
  public downloadMappingUrl : string = `${environment.apiUrl}/code-mapper/export-mapping-csv`;
  public downloadProjectUrl : string = `${environment.apiUrl}/code-mapper/export-project-csv`;
  public downloadJsonUrl : string = `${environment.apiUrl}/code-mapper/output-json`;
  private reviewUrl : string = `${environment.apiUrl}/review`;
  private peregrineIndexUrl : string = `${environment.peregrineUrl}/index`;

  constructor(private http : HttpClient) { }

  autocompleteCode(vocId : string, query : string) : Observable<Concept[]> {
    let params : any = { str: query };
    if (vocId != "") {
      params.codingSystem = vocId;
    }
    return this.http.get<compat.UmlsConcept[]>(this.autocompleteUrl, { params })
      .pipe(map(concepts => concepts.map(compat.importConcept0)))
  }

  descendants(vocId : string, codes : string[]) : Observable<Descendants> {
    let params = new HttpParams().append("codingSystem", vocId);
    for (let code of codes) {
      params = params.append("codes", code);
    }
    return this.http.get<Descendants>(this.descendantsUrl, { params });
  }

  searchUts(query : string, vocIds : VocabularyId[]) : Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    body.append("query", query);
    return this.http.post<string[]>(this.searchUtsUrl, body, urlEncodedOptions)
      .pipe(switchMap(cuis =>
        this.concepts(cuis, vocIds)
      ))
  }

  broaderConcepts(conceptId : ConceptId, vocIds : VocabularyId[]) : Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    body.append("cuis", conceptId);
    for (let vocId of vocIds) {
      body.append("codingSystems", vocId);
    }
    return this.http.post<compat.UmlsConcept[]>(this.broaderConceptsUrl, body, urlEncodedOptions)
      .pipe(map(res => compat.importConcepts(res)))
  }

  narrowerConcepts(conceptId : ConceptId, vocIds : VocabularyId[]) : Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    body.append("cuis", conceptId);
    for (let vocId of vocIds) {
      body.append("codingSystems", vocId);
    }
    return this.http.post<compat.UmlsConcept[]>(this.narrowerConceptsUrl, body, urlEncodedOptions)
      .pipe(map(res => compat.importConcepts(res)))
  }

  vocabularies() : Observable<Vocabulary[]> {
    return this.http.get<compat.Vocabulary[]>(this.vocabulariesUrl)
      .pipe(map(v => v.map(compat.importVocabulary)))
  }

  concepts(cuis : ConceptId[], vocIds : VocabularyId[], ignoreTermTypes : string[] = []) : Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    for (let cui of cuis) {
      body.append("cuis", cui);
    }
    for (let vocId of vocIds) {
      body.append('codingSystems', vocId);
    }
    for (let tty of ignoreTermTypes) {
      body.append("ignoreTermTypes", tty);
    }
    return this.http.post<compat.UmlsConcept[]>(this.conceptsUrl, body, urlEncodedOptions)
      .pipe(map(compat.importConcepts))
  }

  async remapData(mapping : Mapping, vocabularies : Vocabularies, ignoreTermTypes : string[]) : Promise<{ conceptsCodes : ConceptsCodes, vocabularies : Vocabularies }> {
    let cuis = Object.keys(mapping.concepts);
    let vocIds = Object.keys(mapping.vocabularies);
    let vocs = Object.fromEntries(vocIds.map(id => [id, vocabularies[id]]));
    let conceptsCodes = await firstValueFrom(
      this.concepts(cuis, vocIds, ignoreTermTypes));
    return { conceptsCodes, vocabularies: vocs }
  }

  concept(cui : ConceptId, vocIds : VocabularyId[]) :
    Observable<[Concept, { [key : string/*VocabularyId*/] : { [key : string/*CodeId*/] : Code } }]> {
    let body = new URLSearchParams();
    body.append('cuis', cui);
    for (let vocId of vocIds) {
      body.append('codingSystems', vocId);
    }
    return this.http.post<compat.UmlsConcept[]>(this.conceptsUrl, body, urlEncodedOptions)
      .pipe(map(concepts => compat.importConcept(concepts[0])))
  }

  allTopics(mappingUUID : string) : Observable<AllTopics0> {
    let url = `${this.reviewUrl}/topics/${mappingUUID}`;
    return this.http.get<AllTopics0>(url);
  }

  saveAllTopics(mappingUUID : string, allTopics : AllTopics0) : Observable<any> {
    let body = new URLSearchParams();
    body.append("allTopics", JSON.stringify(allTopics));
    let url = `${this.reviewUrl}/topics/${mappingUUID}`;
    return this.http.post(url, body, urlEncodedOptions);
  }

  newTopic(mappingUUID : string, cui : ConceptId | null, voc : VocabularyId | null, code : CodeId | null, heading : string) : Observable<number> {
    let url = new URL(`${this.reviewUrl}/topic/${mappingUUID}`);
    if (cui) {
      url.searchParams.set("cui", cui);
    }
    if (voc) {
      url.searchParams.set("sab", voc);
    }
    if (code) {
      url.searchParams.set("code", code);
    }
    let body = new URLSearchParams();
    body.append('heading', heading);
    return this.http.post<number>(url.toString(), body, urlEncodedOptions);
  }

  newMessage(mappingUUID : string, topicId : number, content : string) : Observable<Object> {
    let url = `${this.reviewUrl}/message/${mappingUUID}/${topicId}`;
    let body = new URLSearchParams();
    body.append('content', content);
    return this.http.post(url, body, urlEncodedOptions);
  }

  markAsRead(mappingUUID : string, topicId : number) : Observable<Object> {
    let url = `${this.reviewUrl}/topic-mark-read/${mappingUUID}/${topicId}`;
    return this.http.post(url, null, {});
  }

  resolveTopic(mappingUUID : string, topicId : number) : Observable<Object> {
    let url = `${this.reviewUrl}/topic-resolve/${mappingUUID}/${topicId}`;
    return this.http.post(url, null, {});
  }

  versionInfo() : Observable<VersionInfo> {
    return this.http.get<VersionInfo>(this.baseUrl + "/version-info")
  }

  importCsvContent(csvContent : string, commentColumns : string[]) : Observable<ImportResult> {
    let url = `${this.baseUrl}/import-csv`;
    let body = new URLSearchParams();
    body.append("csvContent", csvContent);
    for (let commentColumns1 of commentColumns) {
      body.append("commentColumns", commentColumns1);
    }
    return this.http.post<ImportResult>(url, body, urlEncodedOptions);
  }

  importCsv(csv : File, commentColumns : string[]) : Observable<ImportedMapping> {
    let api = this;
    return new Observable((subscriber) => {
      var reader = new FileReader();
      reader.onload = function() {
        let csvContent = reader.result;
        if (typeof csvContent == "string") {
          api.importCsvContent(csvContent, commentColumns)
            .subscribe(res => {
              if (res.success && res.imported) {
                let imported = res.imported!;
                imported.csvContent = csvContent as string;
                for (let concept of Object.values(imported.mapping.concepts)) {
                  for (let vocId of Object.keys(concept.codes)) {
                    concept.codes[vocId] = new Set(concept.codes[vocId]);
                  }
                }
                return subscriber.next(imported);
              } else {
                console.log("IMPORT RESULT", res);
                throw subscriber.error("Could not import CSV: " + res.error!);
              }
            });
        };
      };
      reader.readAsText(csv);
    });
  }

  peregrineIndex(text : string) : Observable<[Span[], Concepts]> {
    let normalize = (text : string) => {
      // Python: print "".join(r"\u%x" % ord(c) for c in u"–—")
      return text
        .replace(/\s/g, ' ')
        .replace(/[\u201e\u201c\u201d]/g, '"')
        .replace(/[\u201a\u2018\u2019\u0060]/g, "'")
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2265]/g, '>')
        .replace(/[\u2264]/g, '<')
        .replace(/[\u2264]/g, '<')
        .replace(/[\u2022]/g, '*')
        .replace(/[\u00e8\u00e9]/g, 'e')
        .replace(/[\u00e0\u00e1]/g, 'e');
    }
    let body = new URLSearchParams();
    body.append("text", normalize(text));
    return this.http.post<PeregrineResult>(this.peregrineIndexUrl, body, urlEncodedOptions)
      .pipe(switchMap(res => {
        if (res.status != 0) {
          return [];
        }
        let ids = res.spans.map(s => cuiOfId(s.id));
        return this.concepts(ids, [])
          .pipe(map(cc => [res.spans, cc.concepts] as [Span[], Concepts]));
      }));
  }
}

interface PeregrineResult {
  status : number;
  spans : Span[];
}

interface ImportResult {
  success : boolean;
  imported : ImportedMapping | null;
  error : string | null;
}

export interface ImportedMapping {
  mapping : MappingData,
  allTopics : AllTopics0,
  warnings : string[],
  csvContent : string;
  mappingName : string;
}

export type Descendants = { [key : CodeId] : Code[] }
