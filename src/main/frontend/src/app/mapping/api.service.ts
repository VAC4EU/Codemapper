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
import {
  MappingData,
  Vocabulary,
  VocabularyId,
  ConceptId,
  Concept,
  Concepts,
  ConceptsCodes,
  Code,
  CodeId,
  ServerInfo,
  Span,
  Mapping,
  Vocabularies,
  cuiOfId,
} from './data';
import { AllTopics0 } from './review';
import { urlEncodedOptions } from '../app.module';

export interface TypesInfo {
  ignoreTermTypes: string[];
  ignoreSemanticTypes: string[];
}

export const EMPTY_TYPES_INFO: TypesInfo = {
  ignoreTermTypes: [],
  ignoreSemanticTypes: [],
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl: string = `${environment.apiUrl}/code-mapper`;
  private autocompleteUrl: string = `${environment.apiUrl}/code-mapper/autocomplete-code`;
  private searchUtsUrl: string = `${environment.apiUrl}/code-mapper/search-uts`;
  private conceptsUrl: string = `${environment.apiUrl}/code-mapper/umls-concepts`;
  private vocabulariesUrl: string = `${environment.apiUrl}/code-mapper/coding-systems`;
  private broaderConceptsUrl: string = `${environment.apiUrl}/code-mapper/broader-concepts`;
  private narrowerConceptsUrl: string = `${environment.apiUrl}/code-mapper/narrower-concepts`;
  private descendantsUrl: string = `${environment.apiUrl}/code-mapper/descendants`;
  public codeListsUrl: string = `${environment.apiUrl}/code-mapper/code-lists-csv`;
  public downloadJsonUrl: string = `${environment.apiUrl}/code-mapper/output-json`;
  private reviewUrl: string = `${environment.apiUrl}/review`;
  private peregrineIndexUrl: string = `${environment.peregrineUrl}/index`;

  constructor(private http: HttpClient) {}

  autocompleteCode(vocId: string, query: string): Observable<Concept[]> {
    let params: any = { str: query };
    if (vocId != '') {
      params.codingSystem = vocId;
    }
    return this.http
      .get<compat.UmlsConcept[]>(this.autocompleteUrl, { params })
      .pipe(map((concepts) => concepts.map(compat.importConcept0)));
  }

  descendants(vocId: string, codes: string[]): Observable<Descendants> {
    let params = new HttpParams().append('codingSystem', vocId);
    for (let code of codes) {
      params = params.append('codes', code);
    }
    return this.http.get<Descendants>(this.descendantsUrl, { params });
  }

  searchUts(
    query: string,
    vocIds: VocabularyId[],
    info: TypesInfo
  ): Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    body.append('query', query);
    return this.http
      .post<string[]>(this.searchUtsUrl, body, urlEncodedOptions)
      .pipe(switchMap((cuis) => this.concepts(cuis, vocIds, info)));
  }

  broaderConcepts(
    conceptId: ConceptId,
    vocIds: VocabularyId[],
    info: TypesInfo
  ): Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    body.append('cuis', conceptId);
    for (let vocId of vocIds) {
      body.append('codingSystems', vocId);
    }
    return this.http
      .post<compat.UmlsConcept[]>(
        this.broaderConceptsUrl,
        body,
        urlEncodedOptions
      )
      .pipe(map((res) => compat.importConcepts(res, vocIds, info)));
  }

  narrowerConcepts(
    conceptId: ConceptId,
    vocIds: VocabularyId[],
    info: TypesInfo
  ): Observable<ConceptsCodes> {
    let body = new URLSearchParams();
    body.append('cuis', conceptId);
    for (let vocId of vocIds) {
      body.append('codingSystems', vocId);
    }
    return this.http
      .post<compat.UmlsConcept[]>(
        this.narrowerConceptsUrl,
        body,
        urlEncodedOptions
      )
      .pipe(map((res) => compat.importConcepts(res, vocIds, info)));
  }

  vocabularies(): Observable<Vocabulary[]> {
    return this.http
      .get<compat.Vocabulary[]>(this.vocabulariesUrl)
      .pipe(map((v) => v.map(compat.importVocabulary)));
  }

  async concepts(
    cuis: ConceptId[],
    vocIds: VocabularyId[],
    info: TypesInfo
  ): Promise<ConceptsCodes> {
    let body = new URLSearchParams();
    for (let cui of cuis) {
      body.append('cuis', cui);
    }
    for (let vocId of vocIds) {
      body.append('codingSystems', vocId);
    }
    for (let tty of info.ignoreTermTypes) {
      body.append('ignoreTermTypes', tty);
    }
    let concepts = await firstValueFrom(
      this.http.post<compat.UmlsConcept[]>(
        this.conceptsUrl,
        body,
        urlEncodedOptions
      )
    );
    return compat.importConcepts(concepts, vocIds, info);
  }

  async remapData(
    mapping: Mapping,
    vocabularies: Vocabularies,
    info: TypesInfo
  ): Promise<{
    conceptsCodes: ConceptsCodes;
    vocabularies: Vocabularies;
    messages: string[];
  }> {
    let cuis = Object.keys(mapping.concepts);
    let vocIds = Object.keys(mapping.vocabularies);
    let vocs: Vocabularies = {},
      lostVocs = [];
    for (let vocId of vocIds) {
      let voc = vocabularies[vocId];
      if (voc === undefined) {
        lostVocs.push(vocId);
      } else {
        vocs[vocId] = voc;
      }
    }
    let messages = [];
    if (lostVocs.length) {
      messages.push(
        "The following vocabularies aren't supported anymore and were removed: " +
          lostVocs.join(', ') +
          '.'
      );
      if (lostVocs.includes('ICD10/CM')) {
        messages.push(
          'Instead of ICD10/CM please select vocabularies ICD10 and ICD10-CM.'
        );
      }
    }
    let conceptsCodes = await this.concepts(cuis, vocIds, info);
    return { conceptsCodes, vocabularies: vocs, messages };
  }

  concept(
    cui: ConceptId,
    vocIds: VocabularyId[]
  ): Observable<
    [
      Concept,
      { [key: string /*VocabularyId*/]: { [key: string /*CodeId*/]: Code } }
    ]
  > {
    let body = new URLSearchParams();
    body.append('cuis', cui);
    for (let vocId of vocIds) {
      body.append('codingSystems', vocId);
    }
    return this.http
      .post<compat.UmlsConcept[]>(this.conceptsUrl, body, urlEncodedOptions)
      .pipe(map((concepts) => compat.importConcept(concepts[0])));
  }

  allTopics(mappingShortkey: string): Observable<AllTopics0> {
    let url = `${this.reviewUrl}/topics/${mappingShortkey}`;
    return this.http.get<AllTopics0>(url);
  }

  saveAllTopics(
    mappingShortkey: string,
    allTopics: AllTopics0
  ): Observable<any> {
    let body = new URLSearchParams();
    body.append('allTopics', JSON.stringify(allTopics));
    let url = `${this.reviewUrl}/topics/${mappingShortkey}`;
    return this.http.post(url, body, urlEncodedOptions);
  }

  newTopic(
    mappingShortkey: string,
    cui: ConceptId | null,
    voc: VocabularyId | null,
    code: CodeId | null,
    heading: string
  ): Observable<number> {
    let url = new URL(`${this.reviewUrl}/topic/${mappingShortkey}`);
    if (cui) {
      url.searchParams.set('cui', cui);
    }
    if (voc) {
      url.searchParams.set('sab', voc);
    }
    if (code) {
      url.searchParams.set('code', code);
    }
    let body = new URLSearchParams();
    body.append('heading', heading);
    return this.http.post<number>(url.toString(), body, urlEncodedOptions);
  }

  newMessage(
    mappingShortkey: string,
    topicId: number,
    content: string
  ): Observable<Object> {
    let url = `${this.reviewUrl}/message/${mappingShortkey}/${topicId}`;
    let body = new URLSearchParams();
    body.append('content', content);
    return this.http.post(url, body, urlEncodedOptions);
  }

  editMessage(
    mappingShortkey: string,
    topicId: number,
    messageId: number,
    content: string
  ) {
    let url = `${this.reviewUrl}/message/${mappingShortkey}/${topicId}`;
    let body = new URLSearchParams();
    body.append('messageId', '' + messageId);
    body.append('content', content);
    return this.http.put(url, body, urlEncodedOptions);
  }

  markAsRead(mappingShortkey: string, topicId: number): Observable<Object> {
    let url = `${this.reviewUrl}/topic-mark-read/${mappingShortkey}/${topicId}`;
    return this.http.post(url, null, {});
  }

  resolveTopic(mappingShortkey: string, topicId: number): Observable<Object> {
    let url = `${this.reviewUrl}/topic-resolve/${mappingShortkey}/${topicId}`;
    return this.http.post(url, null, {});
  }

  serverInfo(): Observable<ServerInfo> {
    return this.http.get<ServerInfo>(this.baseUrl + '/server-info');
  }

  importCsvContent(
    csvContent: string,
    commentColumns: string[],
    format: string,
    ignoreTermTypes: string[]
  ): Observable<ImportResult> {
    let url = `${this.baseUrl}/import-csv`;
    let body = new URLSearchParams();
    body.set('format', format);
    body.set('csvContent', csvContent);
    for (let commentColumns1 of commentColumns) {
      body.append('commentColumns', commentColumns1);
    }
    for (let ignoreTermType of ignoreTermTypes) {
      body.append('ignoreTermTypes', ignoreTermType);
    }
    return this.http.post<ImportResult>(url, body, urlEncodedOptions);
  }

  importCsv(
    csv: File,
    commentColumns: string[],
    format: string,
    ignoreTermTypes: string[]
  ): Observable<ImportedMapping> {
    let api = this;
    return new Observable((subscriber) => {
      var reader = new FileReader();
      reader.onload = function () {
        let csvContent = reader.result;
        if (typeof csvContent == 'string') {
          api
            .importCsvContent(
              csvContent,
              commentColumns,
              format,
              ignoreTermTypes
            )
            .subscribe((res) => {
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
                console.log('IMPORT RESULT', res);
                throw subscriber.error('Could not import CSV: ' + res.error!);
              }
            });
        }
      };
      reader.readAsText(csv);
    });
  }

  async peregrineIndex(text: string): Promise<Span[]> {
    let normalize = (text: string) => {
      // Python: print "".join(r"\u%x" % ord(c) for c in u"–—")
      return text
        .replace(/\s/g, ' ')
        .replace(/[\u201e\u201c\u201d]/g, '"')
        .replace(/[\u201a\u2018\u2019\u0060]/g, "'")
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2265]/g, '>')
        .replace(/[\u2264]/g, '<')
        .replace(/[\u2264]/g, '<')
        .replace(/[\u2022]/g, '*')
        .replace(/[\u00e8\u00e9]/g, 'e')
        .replace(/[\u00e0\u00e1]/g, 'e');
    };
    let body = new URLSearchParams();
    body.append('text', normalize(text));
    let res = await firstValueFrom(
      this.http.post<PeregrineResult>(
        this.peregrineIndexUrl,
        body,
        urlEncodedOptions
      )
    );
    if (res.status != 0) {
      console.log('error searching concepts with peregrine', res);
      throw new Error('error searching concepts with peregrine');
    }
    return res.spans;
  }
}

interface PeregrineResult {
  status: number;
  spans: Span[];
}

interface ImportResult {
  success: boolean;
  imported: ImportedMapping | null;
  error: string | null;
}

export interface ImportedMapping {
  mapping: MappingData;
  allTopics: AllTopics0;
  warnings: string[];
  csvContent: string;
  ignoreTermTypes: string[];
  mappingName: string;
  warning: string | null;
}

export type Descendants = { [key: CodeId]: Code[] };
