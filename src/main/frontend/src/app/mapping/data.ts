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

export const CUSTOM_CUI = 'C0000000';

export type VocabularyId = string;
export type ConceptId = string; // CUI
export type CodeId = string; // The actual code
export type Tag = string;

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export interface JSONArray extends Array<JSONValue> {}

export type Vocabularies = { [key: VocabularyId]: Vocabulary };

export type Concepts = { [key: ConceptId]: Concept };

export type Codes = { [key: VocabularyId]: { [key: CodeId]: Code } };

export type Tags = { [key: VocabularyId]: { [key: CodeId]: Tag } };

export interface ConceptsCodes {
  concepts: Concepts;
  codes: Codes;
}

export type ConceptCodes = {
  [key: ConceptId]: { [key: VocabularyId]: CodeId[] };
};

export interface CustomCodes {
  codes: Codes;
  conceptCodes: ConceptCodes;
}

export class RemapError {}

export interface Span {
  id: string;
  label: string;
  start: number;
  end: number;
}

export type Start = Indexing | CsvImport | EmptyStart | null;

export enum StartType {
  Indexing,
  CsvImport,
  Empty,
}

export interface EmptyStart {
  type: StartType.Empty;
}

export interface Indexing {
  type: StartType.Indexing;
  text: string;
  spans: Span[];
  concepts: Concept[];
  selected: ConceptId[];
}

export interface CsvImport {
  type: StartType.CsvImport;
  csvContent: string;
}

export function emptyIndexing(text: string = ''): Indexing {
  return {
    type: StartType.Indexing,
    text,
    spans: [],
    concepts: [],
    selected: [],
  };
}

export enum MappingFormat {
  version = 1,
}

/// Meta data that influences the generation of codes (one per revision)
export interface DataMeta {
  formatVersion: MappingFormat;
  umlsVersion: string | null; // null indicates import from old CodeMapper format
  allowedTags: string[];
  ignoreTermTypes: string[];
  ignoreSemanticTypes: string[];
  includeDescendants: boolean;
}

export const DEFAULT_INCLUDE_DESCENDANTS = false;

export const EMPTY_DATA_META: DataMeta = {
  formatVersion: MappingFormat.version,
  umlsVersion: null,
  allowedTags: [],
  ignoreTermTypes: [],
  ignoreSemanticTypes: [],
  includeDescendants: DEFAULT_INCLUDE_DESCENDANTS,
};

/// Meta data that is purely descriptive (one per mapping)
export interface MappingMeta {
  system: string | null;
  type: string | null;
  projects: string[];
  definition: string | null;
}

export function emptyMappingMeta(): MappingMeta {
  return {
    system: null,
    type: null,
    projects: [],
    definition: null,
  };
}

export interface MappingData {
  meta: DataMeta;
  vocabularies: Vocabularies;
  concepts: Concepts;
  codes: Codes;
  umlsVersion: string;
}

export class Mapping {
  conceptsByCode: { [key: VocabularyId]: { [key: CodeId]: Set<ConceptId> } } =
    {};
  undoStack: [String, Operation][] = [];
  redoStack: [String, Operation][] = [];
  constructor(
    public meta: DataMeta,
    public start: Start,
    public vocabularies: Vocabularies,
    public concepts: Concepts,
    public codes: Codes
  ) {
    this.cleanupRecacheCheck();
  }
  toObject() {
    return {
      meta: this.meta,
      start: this.start,
      vocabularies: this.vocabularies,
      concepts: this.concepts,
      codes: this.codes,
    };
  }
  addMapping(mapping: MappingData) {
    if (mapping.meta.umlsVersion != this.meta.umlsVersion) {
      let msg = 'the UMLS version does not match';
      console.error(msg, mapping.meta.umlsVersion, this.meta.umlsVersion);
      throw new Error(msg);
    }
    for (let [vocId, voc] of Object.entries(mapping.vocabularies)) {
      let voc1 = this.vocabularies[vocId];
      if (voc1 === undefined) {
        throw new Error(
          `the vocabularies must already exist, but ${vocId} does not`
        );
      }
      if (voc1.version != voc.version) {
        throw new Error(`the vocabulary versions do not match`);
      }
    }
    for (let vocId of Object.keys(mapping.codes)) {
      for (let [id, code] of Object.entries(mapping.codes[vocId])) {
        let code0 = this.codes[vocId][id];
        if (code0 === undefined && !code.custom) {
          throw new Error(
            `code ${vocId}/${id} is not in the original mapping and not a custom code`
          );
        }
      }
    }
    for (let vocId of Object.keys(mapping.codes)) {
      for (let [id, code] of Object.entries(mapping.codes[vocId])) {
        code.tag = normalizeTag(code.tag, this.meta.allowedTags);
        let code0 = this.codes[vocId][id];
        if (code0 === undefined) {
          // custom code, checked above
          this.codes[vocId][id] = code;
        } else {
          if (!code.enabled) {
            continue;
          } else {
            code0.enabled = true;
          }
          if (code.tag) {
            if (!code0.tag) {
              code0.tag = code.tag;
            } else if (code0.tag && code.tag && code0.tag != code.tag) {
              code0.tag = formatMultipleTags([code0.tag, code.tag]);
            }
          }
          if (code.custom != code0.custom && code.term != code0.term) {
            console.warn(
              'unexpected difference in code during merge',
              vocId,
              code,
              code0
            );
          }
        }
      }
    }
    for (let [cui, concept] of Object.entries(mapping.concepts)) {
      let concept0 = this.concepts[cui];
      if (concept0 === undefined) {
        this.concepts[cui] = concept;
      } else {
        for (let vocId of Object.keys(concept.codes)) {
          for (let id of concept.codes[vocId]) {
            concept0.codes[vocId].add(id);
          }
        }
      }
    }
  }
  remap(
    umlsVersion: string,
    concepts: Concepts,
    codes: Codes,
    vocabularies: Vocabularies
  ) {
    let customCodes = this.getCustomCodes();
    let customVocabularies = this.getCustomVocabularies();
    let disabled = this.getCodesDisabled();
    let tags = this.getTags();
    let customConcept = this.concepts[CUSTOM_CUI];
    let lost = this.getLost(concepts, codes);
    console.log('Lost in remap', lost);
    this.meta.umlsVersion = umlsVersion;
    this.concepts = concepts;
    this.codes = codes;
    this.vocabularies = vocabularies;
    Object.assign(this.vocabularies, customVocabularies);
    if (customConcept) this.concepts[customConcept.id] = customConcept;
    this.setCustomCodes(customCodes);
    this.setCodesDisabled(disabled);
    this.setLost(lost);
    this.setTags(tags);
    this.cleanupRecacheCheck();
  }
  numVocabularies(): number {
    return Object.keys(this.vocabularies).length;
  }
  allTags() {
    let tags = new Set();
    for (let codes of Object.values(this.codes)) {
      for (let code of Object.values(codes)) {
        if (code.tag != null) {
          tags.add(code.tag);
        }
      }
    }
    return Array.from(tags);
  }
  static jsonifyReplacer(field: string, value: any): any {
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
    let res = new Mapping(
      this.meta,
      this.start,
      this.vocabularies,
      this.concepts,
      this.codes
    );
    res.undoStack = this.undoStack;
    res.redoStack = this.redoStack;
    return res;
  }
  getCustomCodes(): CustomCodes {
    let res: CustomCodes = { codes: {}, conceptCodes: {} };
    for (let [vocId, codes] of Object.entries(this.codes)) {
      for (let [codeId, code] of Object.entries(codes)) {
        if (code.custom) {
          res.codes[vocId] ??= {};
          res.codes[vocId][codeId] = code;
          for (let conceptId of this.getConceptsByCode(vocId, codeId)) {
            res.conceptCodes[conceptId] ??= {};
            res.conceptCodes[conceptId][vocId] ??= [];
            res.conceptCodes[conceptId][vocId].push(codeId);
          }
        }
      }
    }
    return res;
  }
  setCustomCodes(custom: CustomCodes) {
    for (let vocId of Object.keys(custom.codes)) {
      for (let code of Object.values(custom.codes[vocId])) {
        this.codes[vocId] ??= {};
        if (this.codes[vocId][code.id] !== undefined) {
          throw new Error(
            `Custom code ${code.id} in ${vocId} already defined as regular code`
          );
        }
        this.codes[vocId][code.id] = code;
      }
    }
    for (let conceptId of Object.keys(custom.conceptCodes)) {
      if (this.concepts[conceptId] === undefined) {
        throw new Error(`Custom code with unavailable concept ${conceptId}`);
      }
      for (let vocId of Object.keys(custom.conceptCodes[conceptId])) {
        for (let codeId of custom.conceptCodes[conceptId][vocId]) {
          this.concepts[conceptId].codes[vocId] ??= new Set();
          this.concepts[conceptId].codes[vocId].add(codeId);
        }
      }
    }
  }
  getCustomVocabularies(): Vocabularies {
    let res: Vocabularies = {};
    for (let [vocId, voc] of Object.entries(this.vocabularies)) {
      if (voc.custom) {
        res[vocId] = voc;
      }
    }
    return res;
  }
  public getTags(): Tags {
    let tags: Tags = {};
    for (let vocId of Object.keys(this.codes)) {
      for (let code of Object.values(this.codes[vocId])) {
        if (code.tag != null) {
          tags[vocId] ??= {};
          tags[vocId][code.id] = code.tag;
        }
      }
    }
    return tags;
  }
  public setTags(tags: Tags) {
    for (let vocId of Object.keys(tags)) {
      if (this.codes[vocId]) {
        for (let codeId of Object.keys(tags[vocId])) {
          if (this.codes[vocId][codeId]) {
            this.codes[vocId][codeId].tag = tags[vocId][codeId];
          }
        }
      }
    }
  }
  getCodesDisabled(): { [key: VocabularyId]: Set<CodeId> } {
    let res: { [key: VocabularyId]: Set<CodeId> } = {};
    for (let vocId of Object.keys(this.codes)) {
      res[vocId] ??= new Set();
      for (let code of Object.values(this.codes[vocId])) {
        if (!code.enabled) {
          res[vocId].add(code.id);
        }
      }
    }
    return res;
  }
  setCodesDisabled(disabled: { [key: VocabularyId]: Set<CodeId> }) {
    for (let vocId of Object.keys(disabled)) {
      for (let codeId of disabled[vocId]) {
        if (this.codes[vocId]?.[codeId]) {
          this.codes[vocId][codeId].enabled = false;
        }
      }
    }
  }
  public getLost(remapConcepts: Concepts, remapCodes: Codes): ConceptsCodes {
    let lost: ConceptsCodes = {
      concepts: {},
      codes: {},
    };
    for (let [cui, concept] of Object.entries(this.concepts)) {
      let hasLostCode = false;
      let concept1 = new Concept(cui, concept.name, concept.definition, {});
      for (let voc of Object.keys(concept.codes)) {
        for (let code of concept.codes[voc]) {
          if (!remapConcepts[cui]?.codes[voc]?.has(code)) {
            hasLostCode = true;
            concept1.codes[voc] ??= new Set();
            concept1.codes[voc].add(code);
            if (!remapCodes[voc]?.[code]) {
              lost.codes[voc] ??= {};
              let oldCode = this.codes[voc][code];
              lost.codes[voc][code] = new Code(
                code,
                oldCode.term,
                true,
                oldCode.enabled,
                oldCode.tag
              );
            }
          }
        }
      }
      if (hasLostCode) lost.concepts[cui] = concept1;
    }
    return lost;
  }
  public setLost(lost: ConceptsCodes) {
    for (let [cui, concept] of Object.entries(lost.concepts)) {
      if (this.concepts[cui]) {
        for (let [voc, codes] of Object.entries(concept.codes)) {
          this.concepts[cui].codes[voc] ??= new Set();
          for (let code of codes) {
            this.concepts[cui].codes[voc].add(code);
          }
        }
      } else {
        this.concepts[cui] = concept;
      }
    }
    for (let [voc, codes] of Object.entries(lost.codes)) {
      this.codes[voc] ??= {};
      for (let [id, code] of Object.entries(codes)) {
        if (!this.codes[voc]?.[id]) {
          this.codes[voc][id] = code;
        }
      }
    }
  }
  runIntern(op: Operation) {
    let inv = op.run(this);
    this.cleanupRecacheCheck();
    return inv;
  }
  public run(op: Operation, saveRequired: boolean) {
    console.log('Run', op);
    try {
      if (op.noUndo && (this.undoStack.length > 0 || saveRequired)) {
        alert('save your mapping first, this operation cannot be undone');
        return;
      }
      let inv = this.runIntern(op);
      this.redoStack = [];
      if (inv !== undefined) {
        this.undoStack.push([op.describe(), inv]);
      } else {
        console.log('no inverse operation');
      }
    } catch (err) {
      console.error('could not run operation', op, err);
      alert(`could not run operation: ${(err as Error).message}`);
    }
  }
  public undo() {
    let op = this.undoStack.pop();
    if (op !== undefined) {
      console.log('Undo', op[0]);
      let inv = this.runIntern(op[1]);
      if (inv !== undefined) {
        this.redoStack.push([op[0], inv]);
      }
    }
  }
  public redo() {
    let op = this.redoStack.pop();
    if (op !== undefined) {
      console.log('Redo', op[0]);
      let inv = this.runIntern(op[1]);
      if (inv !== undefined) {
        this.undoStack.push([op[1].describe(), inv]);
      }
    }
  }
  public isEmpty() {
    return this.start == null && Object.keys(this.concepts).length === 0;
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
      concept.codesTag = getCodesTag(concept, this.codes);
    }
    // cleanup: drop non-custom codes that are not referred to by any concepts
    for (const [vocId, codes] of Object.entries(this.codes)) {
      for (const codeId of Object.keys(codes)) {
        if (
          this.conceptsByCode[vocId]?.[codeId] == undefined &&
          !this.codes[vocId]?.[codeId]?.custom
        ) {
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
  getConceptsByCode(vocId: VocabularyId, codeId: CodeId): ConceptId[] {
    return Array.from(this.conceptsByCode[vocId]?.[codeId] ?? []);
  }
  setCodeConcept(vocId: VocabularyId, codeId: CodeId, conceptIds: ConceptId[]) {
    for (const id of this.getConceptsByCode(vocId, codeId)) {
      this.concepts[id].codes[vocId].delete(codeId);
    }
    for (const id of conceptIds) {
      this.concepts[id].codes[vocId] ??= new Set();
      this.concepts[id].codes[vocId].add(codeId);
    }
  }

  static importJSON(json0: JSONValue, info: ServerInfo): Mapping {
    let json = json0 as JSONObject;
    let start: Start = null;
    if (json['start']) {
      let start0 = json['start'] as JSONObject;
      if (!start0['type']) {
        if (
          ['text', 'spans', 'concepts', 'selected'].every((s) =>
            start0.hasOwnProperty(s)
          )
        ) {
          start0['type'] = StartType.Indexing;
        }
        if (['csvContent'].every((s) => start0.hasOwnProperty(s))) {
          start0['type'] = StartType.CsvImport;
        }
      }
      start = start0 as unknown as Start;
    }

    let vocabularies: Vocabularies = {};
    for (const vocJson0 of Object.values(json['vocabularies'] as JSONObject)) {
      let vocJson = vocJson0 as JSONObject;
      let id = vocJson['id'] as VocabularyId;
      let name = vocJson['name'] as string;
      let version = vocJson['version'] as string | null;
      let custom = vocJson['custom'] as boolean;
      let voc = new Vocabulary(id, name, version, custom);
      vocabularies[voc.id] = voc;
    }
    let concepts: Concepts = {};
    let conceptTags: { [key: VocabularyId]: { [key: CodeId]: Set<string> } } =
      {};
    for (const conceptJson0 of Object.values(json['concepts'] as JSONObject)) {
      let conceptJson = conceptJson0 as JSONObject;
      let id = conceptJson['id'] as ConceptId;
      let name = conceptJson['name'] as string;
      let definition = conceptJson['definition'] as string;
      let conceptTag = getTag(conceptJson);
      let codes: { [key: VocabularyId]: Set<CodeId> } = {};
      for (let [vocId, codeIds0] of Object.entries(
        conceptJson['codes'] as JSONObject
      )) {
        codes[vocId] = new Set();
        for (let codeId0 of codeIds0 as JSONArray) {
          let codeId = codeId0 as string;
          if (conceptTag != null) {
            conceptTags[vocId] ??= {};
            conceptTags[vocId][codeId] ??= new Set();
            conceptTags[vocId][codeId].add(conceptTag);
          }
          codes[vocId].add(codeId);
        }
      }
      let concept = new Concept(id, name, definition, codes);
      concepts[concept.id] = concept;
    }

    let codes: Codes = {};
    for (let [vocId, codesJson] of Object.entries(
      json['codes'] as JSONObject
    )) {
      codes[vocId] = {};
      for (let codeJson0 of Object.values(codesJson as JSONObject)) {
        let codeJson = codeJson0 as JSONObject;
        let id = codeJson['id'] as CodeId;
        let term = codeJson['term'] as string;
        let custom = codeJson['custom'] as boolean;
        let enabled = codeJson['enabled'] as boolean;
        let tag = formatTag(getTag(codeJson), conceptTags[vocId]?.[id]);
        let code = new Code(id, term, custom, enabled, tag);
        codes[vocId][code.id] = code;
      }
    }

    let meta;
    if (json['meta']) {
      meta = json['meta'] as unknown as DataMeta;
      if (meta.formatVersion !== MappingFormat.version) {
        throw new Error(
          `Mapping data is in version ${meta.formatVersion}, expected version ${MappingFormat.version}`
        );
      }
      if (meta['ignoreTermTypes'] === undefined) {
        meta.ignoreTermTypes = [...info.defaultIgnoreTermTypes];
      }
      meta.ignoreTermTypes.sort();
      if (meta['ignoreSemanticTypes'] === undefined) {
        meta.ignoreSemanticTypes = [...info.defaultIgnoreSemanticTypes];
      }
      if (meta['includeDescendants'] === undefined) {
        meta.includeDescendants = DEFAULT_INCLUDE_DESCENDANTS;
      }
    } else {
      let umlsVersion = json['umlsVersion'] as string;
      if (umlsVersion === undefined) {
        throw new Error('umls version missing in mapping JSON, assume current');
      }
      meta = {
        formatVersion: MappingFormat.version,
        umlsVersion,
        allowedTags: info.defaultAllowedTags,
        ignoreTermTypes: [...info.defaultIgnoreTermTypes],
        ignoreSemanticTypes: [...info.defaultIgnoreSemanticTypes],
        includeDescendants: DEFAULT_INCLUDE_DESCENDANTS,
      };
    }

    let res = new Mapping(meta, start, vocabularies, concepts, codes);
    console.log('Import mapping', json0, res);
    return res;
  }

  static importLegacyJSON(v0: JSONValue, serverInfo: ServerInfo): Mapping {
    let v = v0 as JSONObject;
    let vocabularies: { [key: VocabularyId]: Vocabulary } = {};
    for (const id0 of v['codingSystems'] as JSONArray) {
      let id = id0 as string;
      vocabularies[id] = new Vocabulary(
        id,
        'unknown (imported mapping)',
        'unknown (imported mapping)',
        false
      );
    }
    let concepts: { [key: ConceptId]: Concept } = {};
    let codes: { [key: VocabularyId]: { [key: CodeId]: Code } } = {};
    let tags: { [key: VocabularyId]: { [key: CodeId]: Set<string> } } = {};
    for (const concept0 of (v['mapping'] as JSONObject)[
      'concepts'
    ] as JSONArray) {
      let conceptJson = concept0 as JSONObject;
      let tag = conceptJson['tag'] as string | null;
      let concept = new Concept(
        conceptJson['cui'] as string,
        conceptJson['preferredName'] as string,
        conceptJson['definition'] as string,
        {}
      );
      concepts[concept.id] = concept;
      for (let sourceConcept0 of conceptJson['sourceConcepts'] as JSONArray) {
        let sourceConcept = sourceConcept0 as JSONObject;
        let vocabularyId = sourceConcept['codingSystem'] as string;
        let codeId = sourceConcept['id'] as string;
        let code = new Code(
          codeId,
          sourceConcept['preferredTerm'] as string,
          false,
          sourceConcept['selected'] as boolean,
          null
        );
        concept.codes[vocabularyId] ??= new Set();
        concept.codes[vocabularyId].add(code.id);
        codes[vocabularyId] ??= {};
        codes[vocabularyId][code.id] = code;
        if (tag != null) {
          tags[vocabularyId] ??= {};
          tags[vocabularyId][codeId] ??= new Set();
          tags[vocabularyId][codeId].add(tag);
        }
      }
    }
    for (let vocId of Object.keys(tags)) {
      for (let codeId of Object.keys(tags[vocId])) {
        let tag = formatTag(null, tags[vocId][codeId]);
        codes[vocId][codeId].tag = tag;
      }
    }
    let indexing = v['indexing'] as JSONObject;
    let text = indexing['caseDefinition'] as string;
    let spans = (indexing['spans'] as JSONArray).map((s0) => {
      let s = s0 as JSONObject;
      let id = s['id'] as string;
      let label = s['label'] as string;
      let start = s['start'] as number;
      let end = s['end'] as number;
      return { id, label, start, end };
    });
    let selected = Object.entries(v['cuiAssignment'] as JSONObject)
      .filter(([cui, state]) => (state as string) == 'include')
      .map(([cui, state]) => cui as string);
    let startConcepts = Object.values(indexing['concepts'] as JSONObject).map(
      (c0) => {
        let c = c0 as JSONObject;
        let id = c['cui'] as string;
        let name = c['preferredName'] as string;
        return new Concept(id, name, '');
      }
    );
    let start: Start = {
      type: StartType.Indexing,
      text,
      spans,
      concepts: startConcepts,
      selected,
    };
    let info = {
      formatVersion: MappingFormat.version,
      umlsVersion: null,
      allowedTags: serverInfo.defaultAllowedTags,
      ignoreTermTypes: serverInfo.defaultIgnoreTermTypes,
      ignoreSemanticTypes: serverInfo.defaultIgnoreSemanticTypes,
      includeDescendants: DEFAULT_INCLUDE_DESCENDANTS,
    };
    let res = new Mapping(info, start, vocabularies, concepts, codes);
    console.log('Import mapping v1', v0, res);
    return res;
  }

  addConceptsCodes(concepts: Concepts, codes: Codes) {
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

function getTag(json: any) {
  if ('tag' in json) {
    return json['tag'] as string | null;
  } else if ('tags' in json) {
    let tags: string[] = (json['tags'] as JSONArray).map((v) => v as string);
    if (tags.length == 0) {
      return null;
    } else {
      if (tags.length > 1) {
        console.warn('Taking only the first tag', tags);
      }
      return tags[0];
    }
  } else {
    return null;
  }
}

function formatTag(
  tag: string | null,
  tags: Set<string> | undefined
): string | null {
  let tags0 = new Set(tags ?? new Set<string>());
  if (tag != null) tags0.add(tag);
  let tags1 = Array.from(tags0);
  if (tags1.length == 0) return null;
  else if (tags1.length == 1) return tags1[0];
  else return formatMultipleTags(tags1);
}

function formatMultipleTags(tags: string[]): string {
  return 'multiple:' + tags.join('+');
}

function normalizeTag(tag: string | null, tags: string[]) {
  if (tag && !tags.includes(tag)) {
    let tag0 = tags.find((tag0) => tag0.toLowerCase() == tag!.toLowerCase());
    if (tag0 !== undefined) {
      console.log(`normalize tag ${tag} to ${tag0}`);
      return tag0;
    }
  }
  return tag;
}

export class Vocabulary {
  constructor(
    readonly id: VocabularyId,
    readonly name: string,
    readonly version: string | null,
    readonly custom: boolean
  ) {}
  static compare(v1: Vocabulary, v2: Vocabulary): number {
    return v1.id.localeCompare(v2.id);
  }
}

export class Concept {
  codesTag: Tag | null = null;
  constructor(
    readonly id: ConceptId,
    readonly name: string,
    readonly definition: string,
    public codes: { [key: VocabularyId]: Set<CodeId> } = {}
  ) {}
}

function getCodesTag(concept: Concept, codes: Codes): Tag | null {
  let tag: Tag | null = null;
  let first = true;
  for (let vocId of Object.keys(concept.codes)) {
    for (let codeId of concept.codes[vocId]) {
      let code = codes[vocId][codeId];
      if (!code.enabled) continue;
      if (first) {
        tag = code.tag;
        first = false;
      } else if (tag != code.tag) {
        return null;
      }
    }
  }
  return tag;
}

export function filterConcepts(
  concepts: Concepts,
  removeCuis: ConceptId[]
): Concepts {
  let res: Concepts = {};
  for (let cui in concepts) {
    if (!removeCuis.includes(cui)) {
      res[cui] = concepts[cui];
    }
  }
  return res;
}

export class Code {
  constructor(
    readonly id: CodeId,
    readonly term: string,
    readonly custom: boolean,
    public enabled: boolean,
    public tag: Tag | null = null
  ) {}
  static custom(id: CodeId, term: string): Code {
    return new Code(id, term, true, true, null);
  }
  static empty(custom: boolean) {
    return new Code('', '', custom, true, null);
  }
  public sameAs(other: Code): boolean {
    return (
      this.id == other.id &&
      this.term == other.term &&
      this.custom == other.custom
    );
  }
}

export function tagsInCodes(codes: Code[]): Tag[] {
  let tags = new Set<Tag>();
  for (let code of codes) {
    if (code.tag != null) {
      tags.add(code.tag);
    }
  }
  return Array.from(tags);
}

/// Server version info
export interface ServerInfo {
  contactEmail: string;
  projectVersion: string;
  umlsVersion: string;
  url: string;
  defaultVocabularies: string[];
  defaultAllowedTags: string[];
  defaultIgnoreTermTypes: string[];
  defaultIgnoreSemanticTypes: string[];
}

export const EMPTY_SERVER_INFO: ServerInfo = {
  contactEmail: '',
  projectVersion: '',
  umlsVersion: '',
  url: '',
  defaultAllowedTags: [],
  defaultIgnoreTermTypes: [],
  defaultIgnoreSemanticTypes: [],
  defaultVocabularies: [],
};

export function cuiOfId(id: string): string {
  return 'C' + Array(8 - id.length).join('0') + id;
}
