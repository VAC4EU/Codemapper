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

import { Operation } from './mapping-ops';

export type VocabularyId = string;
export type ConceptId = string; // CUI
export type CodeId = string; // The actual code
export type Tag = string;

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [key : string] : JSONValue };
export interface JSONArray extends Array<JSONValue> { }

export type Vocabularies = { [key : VocabularyId] : Vocabulary }

export type Concepts = { [key : ConceptId] : Concept }

export type Codes = { [key : VocabularyId] : { [key : CodeId] : Code } }

export interface ConceptsCodes {
  concepts : Concepts,
  codes : Codes
}

export type CustomConcepts = { [key : ConceptId] : { [key : VocabularyId] : CodeId[] } }

export interface CustomCodes {
  codes : Codes,
  concepts : CustomConcepts,
}

export class RemapError {
}

export interface MappingData {
  vocabularies : Vocabularies,
  concepts : Concepts,
  codes : Codes,
  umlsVersion : string | null,
}

export interface Span {
  id : string;
  label : string;
  start : number;
  end : number;
}

export type Start = Indexing | CsvImport | null

export enum StartType {
  Indexing,
  CsvImport,
}

export interface Indexing {
  type : StartType.Indexing;
  text : string;
  spans : Span[];
  concepts : Concept[];
  selected : ConceptId[];
}

export interface CsvImport {
  type : StartType.CsvImport;
  csvContent : string;
}

export function emptyIndexing(text : string = "") : Indexing {
  return {
    type: StartType.Indexing,
    text,
    spans: [],
    concepts: [],
    selected: [],
  }
}

export class Mapping {
  conceptsByCode : { [key : VocabularyId] : { [key : CodeId] : Set<ConceptId> } } = {};
  undoStack : [String, Operation][] = [];
  redoStack : [String, Operation][] = [];
  constructor(
    public start : Start,
    public vocabularies : Vocabularies,
    public concepts : Concepts,
    public codes : Codes,
    public umlsVersion : string | null,
  ) {
    this.cleanupRecacheCheck();
  }
  numVocabularies() : number {
    return Object.keys(this.vocabularies).length;
  }
  allTags() {
    let tags = new Set();
    for (let concept of Object.values(this.concepts)) {
      if (concept.tag != null) {
        tags.add(concept.tag);
      }
    }
    for (let codes of Object.values(this.codes)) {
      for (let code of Object.values(codes)) {
        if (code.tag != null) {
          tags.add(code.tag);
        }
      }
    }
    return Array.from(tags);
  }
  static jsonifyReplacer(field : string, value : any) : any {
    if (this instanceof Mapping) {
      switch (field) {
        case 'undoStack':
        case 'redoStack':
        case 'conceptsByCode':
          return;
      }
    }
    if (value instanceof Set) {
      return [...value];
    }
    return value;
  }
  public clone() {
    let res = new Mapping(this.start, this.vocabularies, this.concepts, this.codes, this.umlsVersion);
    res.undoStack = this.undoStack;
    res.redoStack = this.redoStack;
    return res;
  }
  public getCustomCodes() : CustomCodes {
    let codes : Codes = {};
    let concepts : CustomConcepts = {};
    for (let [vocId, codes1] of Object.entries(this.codes)) {
      for (let [codeId, code] of Object.entries(codes1)) {
        if (code.custom) {
          codes[vocId] ??= {};
          codes[vocId][codeId] = code;
          for (let conceptId of this.getConceptsByCode(vocId, codeId)) {
            concepts[conceptId] ??= {};
            concepts[conceptId][vocId] ??= [];
            concepts[conceptId][vocId].push(codeId);
          }
        }
      }
    }
    return { codes, concepts };
  }
  public runIntern(op : Operation) {
    let inv = op.run(this);
    this.cleanupRecacheCheck();
    return inv;
  }
  public run(op : Operation) {
    console.log("Run", op);
    let inv = this.runIntern(op);
    if (inv !== undefined) {
      this.undoStack.push([op.describe(), inv]);
    } else {
      console.log("no inversion");
    }
  }
  public undo() {
    let op = this.undoStack.pop();
    if (op !== undefined) {
      console.log("Undo", op[0]);
      let inv = this.runIntern(op[1]);
      if (inv !== undefined) {
        this.redoStack.push([op[0], inv]);
      }
    }
  }
  public redo() {
    let op = this.redoStack.pop();
    if (op !== undefined) {
      console.log("Redo", op[0]);
      let inv = this.runIntern(op[1]);
      if (inv !== undefined) {
        this.undoStack.push([op[1].describe(), inv]);
      }
    }
  }
  public isEmpty() {
    return this.start == null && Object.keys(this.concepts).length === 0;
  }
  static empty() {
    return new Mapping(null, {}, {}, {}, null);
  }
  cleanupRecacheCheck() {
    // reset: conceptsByCode lookup
    this.conceptsByCode = {};
    for (const vocId of Object.keys(this.vocabularies)) {
      this.codes[vocId] ??= {};
    }
    for (const concept of Object.values(this.concepts)) {
      for (const [vocId, codeIds] of Object.entries(concept.codes)) {
        this.conceptsByCode[vocId] ??= {};
        for (const codeId of codeIds) {
          this.conceptsByCode[vocId][codeId] ??= new Set();
          this.conceptsByCode[vocId][codeId].add(concept.id);
        }
      }
    }
    // cleanup: drop non-custom codes that are not referred to by any concepts
    for (const [vocId, codes] of Object.entries(this.codes)) {
      for (const codeId of Object.keys(codes)) {
        if (this.conceptsByCode[vocId]?.[codeId] == undefined && !this.codes[vocId]?.[codeId]?.custom) {
          delete this.codes[vocId][codeId];
        }
      }
    }
    // check invariants
    // - for all vocId, codeId of concepts.codes[vocId]: codes[vocId][codeId] !== undefined
    // - for all vocId, codeId, code of codes[vocId][codeId]:
    //     code.custom || exists conceptId: concepts[conceptId].codes[vocId].contains(codeId]
    // - every custom code has exactly one concept
  }
  getConceptsByCode(vocId : VocabularyId, codeId : CodeId) : ConceptId[] {
    return Array.from(this.conceptsByCode[vocId]?.[codeId] ?? []);
  }
  setCodeConcept(vocId : VocabularyId, codeId : CodeId, conceptIds : ConceptId[]) {
    for (const id of this.getConceptsByCode(vocId, codeId)) {
      this.concepts[id].codes[vocId].delete(codeId);
    }
    for (const id of conceptIds) {
      this.concepts[id].codes[vocId] ??= new Set()
      this.concepts[id].codes[vocId].add(codeId);
    }
  }
  static importJSON(json0 : JSONValue) : Mapping {
    let json = json0 as JSONObject;
    let mapping = new Mapping(null, {}, {}, {}, null);
    if (json['start']) {
      let start = json['start'] as JSONObject;
      if (!start['type']) {
        if (["text", "spans", "concepts", "selected"].every(s => start.hasOwnProperty(s))) {
          start['type'] = StartType.Indexing;
        }
        if (["csvContent"].every(s => start.hasOwnProperty(s))) {
          start['type'] = StartType.CsvImport;
        }
      }
      mapping.start = start as unknown as Start;
    } else {
      mapping.start = null;
    }
    for (const vocJson0 of Object.values(json['vocabularies'] as JSONObject)) {
      let vocJson = vocJson0 as JSONObject;
      let id = vocJson["id"] as VocabularyId;
      let name = vocJson["name"] as string;
      let version = vocJson["version"] as string | null;
      let custom = vocJson["custom"] as boolean;
      let voc = new Vocabulary(id, name, version, custom);
      mapping.vocabularies[voc.id] = voc;
    }
    for (const conceptJson0 of Object.values(json['concepts'] as JSONObject)) {
      let conceptJson = conceptJson0 as JSONObject;
      let id = conceptJson["id"] as ConceptId;
      let name = conceptJson["name"] as string;
      let definition = conceptJson["definition"] as string;
      let codes : { [key : VocabularyId] : Set<CodeId> } = {};
      for (let [vocId, codeIds0] of Object.entries(conceptJson['codes'] as JSONObject)) {
        codes[vocId] = new Set();
        for (let codeId of codeIds0 as JSONArray) {
          codes[vocId].add(codeId as string);
        }
      }
      let tag = getTag(conceptJson);
      let concept = new Concept(id, name, definition, codes, tag);
      mapping.concepts[concept.id] = concept;
    }
    for (let [vocId, codesJson] of Object.entries(json['codes'] as JSONObject)) {
      mapping.codes[vocId] = {};
      for (let codeJson0 of Object.values(codesJson as JSONObject)) {
        let codeJson = codeJson0 as JSONObject;
        let id = codeJson['id'] as CodeId;
        let term = codeJson['term'] as string;
        let custom = codeJson['custom'] as boolean;
        let enabled = codeJson['enabled'] as boolean;
        let tag = getTag(codeJson);
        let code = new Code(id, term, custom, enabled, tag);
        mapping.codes[vocId][code.id] = code;
      }
    }
    mapping.umlsVersion = json["umlsVersion"] as string | null;
    return mapping;
  }
  static importOG(v0 : JSONValue) : Mapping {
    let v = v0 as JSONObject;
    let vocabularies : { [key : VocabularyId] : Vocabulary } = {};
    for (const id0 of v['codingSystems'] as JSONArray) {
      let id = id0 as string;
      vocabularies[id] = new Vocabulary(id, id, "unknown (imported)", false);
    }
    let concepts : { [key : ConceptId] : Concept } = {};
    let codes : { [key : VocabularyId] : { [key : CodeId] : Code } } = {};
    for (const concept0 of (v['mapping'] as JSONObject)['concepts'] as JSONArray) {
      let conceptJson = concept0 as JSONObject;
      let tag = conceptJson['tag'] as string | null
      let concept = new Concept(
        conceptJson['cui'] as string,
        conceptJson['preferredName'] as string,
        conceptJson['definition'] as string,
        {},
        tag
      );
      concepts[concept.id] = concept;
      for (let sourceConcept0 of conceptJson['sourceConcepts'] as JSONArray) {
        let sourceConcept = sourceConcept0 as JSONObject;
        let vocabularyId = sourceConcept['codingSystem'] as string;
        let code = new Code(
          sourceConcept['id'] as string,
          sourceConcept['preferredTerm'] as string,
          false,
          sourceConcept['selected'] as boolean,
          null,
        );
        concept.codes[vocabularyId] ??= new Set();
        concept.codes[vocabularyId].add(code.id);
        codes[vocabularyId] ??= {};
        codes[vocabularyId][code.id] = code;
      }
    }
    let indexing = v['indexing'] as JSONObject;
    let text = indexing['caseDefinition'] as string;
    let spans = (indexing['spans'] as JSONArray)
      .map(s0 => {
        let s = s0 as JSONObject;
        let id = s['id'] as string;
        let label = s['label'] as string;
        let start = s['start'] as number;
        let end = s['end'] as number;
        return { id, label, start, end };
      });
    let selected = Object.entries(v['cuiAssignment'] as JSONObject)
      .filter(([cui, state]) => state as string == "include")
      .map(([cui, state]) => cui as string);
    let startConcepts = Object.values(indexing['concepts'] as JSONObject)
      .map(c0 => {
        let c = c0 as JSONObject;
        let id = c['cui'] as string;
        let name = c['preferredName'] as string;
        return new Concept(id, name, "");
      });
    let start : Start = { type: StartType.Indexing, text, spans, concepts: startConcepts, selected };
    return new Mapping(start, vocabularies, concepts, codes, null);
  }

  addConceptsCodes(concepts : Concepts, codes : Codes) {
    for (let [id, concept] of Object.entries(concepts)) {
      this.concepts[id] = concept;
    }
    for (let vocId of Object.keys(codes)) {
      this.codes[vocId] ??= {};
      for (let [id, code] of Object.entries(codes[vocId])) {
        this.codes[vocId][id] = code;
      }
    }
  }
}

function getTag(json : any) {
  if ("tag" in json) {
    return json["tag"] as string | null;
  } else {
    let tags : string[] = (json["tags"] as JSONArray).map(v => v as string);
    if (tags.length == 0) {
      return null;
    } else {
      if (tags.length > 1) {
        console.warn("Taking only the first tag", tags);
      }
      return tags[0];
    }
  }
}

export class Vocabulary {
  constructor(
    readonly id : VocabularyId,
    readonly name : string,
    readonly version : string | null,
    readonly custom : boolean,
  ) { }
  static compare(v1 : Vocabulary, v2 : Vocabulary) : number {
    return v1.id.localeCompare(v2.id)
  }
}

export class Concept {
  constructor(
    readonly id : ConceptId,
    readonly name : string,
    readonly definition : string,
    public codes : { [key : VocabularyId] : Set<CodeId> } = {},
    public tag : Tag | null = null,
  ) { }
}

export function filterConcepts(concepts : { [key : ConceptId] : Concept }, removeCuis : ConceptId[]) : { [key : ConceptId] : Concept } {
  let res : { [key : ConceptId] : Concept } = {};
  for (let cui in concepts) {
    if (!removeCuis.includes(cui)) {
      res[cui] = concepts[cui];
    }
  }
  return res;
}

export class Code {
  constructor(
    readonly id : CodeId,
    readonly term : string,
    readonly custom : boolean,
    public enabled : boolean,
    public tag : Tag | null = null,
  ) { }
  static custom(id : CodeId, term : string) : Code {
    return new Code(id, term, true, true, null);
  }
  static empty(custom : boolean) {
    return new Code("", "", custom, true, null)
  }
  public sameAs(other : Code) : boolean {
    return this.id == other.id
      && this.term == other.term
      && this.custom == other.custom;
  }
}

export function tagsInConcepts(concepts : Concept[]) : Tag[] {
  let tags = new Set<Tag>();
  for (let concept of concepts) {
    if (concept.tag != null) {
      tags.add(concept.tag);
    }
  }
  return Array.from(tags);
}

export function tagsInCodes(codes : Code[]) : Tag[] {
  let tags = new Set<Tag>();
  for (let code of codes) {
    if (code.tag != null) {
      tags.add(code.tag);
    }
  }
  return Array.from(tags);
}

export interface VersionInfo {
  contactEmail : string;
  projectVersion : string;
  umlsVersion : string;
  url : string;
  ignoreTermTypes : string[];
}

export const EMPTY_VERSION_INFO : VersionInfo = {
  contactEmail: "",
  projectVersion: "",
  umlsVersion: "",
  url: "",
  ignoreTermTypes: [],
}

export interface Revision {
  version : number;
  author : string;
  timestamp : string;
  summary : string;
  mapping : string;
}

export function cuiOfId(id : string) : string {
  return 'C' + Array(8 - id.length).join('0') + id;
}
