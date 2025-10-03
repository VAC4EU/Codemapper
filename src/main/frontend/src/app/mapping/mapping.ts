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

import { CodeId, Codes, Concept, ConceptId, Concepts, ConceptsCodes, CustomCodes, DataMeta, formatMultipleTags, getCodesTag, JSONArray, MappingData, normalizeTag, Start, Tag, Tags, Vocabularies, VocabularyId } from './mapping-data';
import { Operation } from './operations';

export const CUSTOM_CUI = 'C0000000';

export class Mapping {
  constructor(
    public meta: DataMeta,
    public start: Start,
    public vocabularies: Vocabularies,
    public concepts: Concepts,
    public codes: Codes
  ) {}

  static fromData(data: MappingData) {
    return new Mapping(
      data.meta,
      data.start,
      data.vocabularies,
      data.concepts,
      data.codes
    );
  }

  toData(): MappingData {
    return this;
  }

  deepClone(): Mapping {
    return Mapping.fromData(structuredClone(this.toData()));
  }

  public isEmpty() {
    return this.start == null && Object.keys(this.concepts).length === 0;
  }

  numVocabularies(): number {
    return Object.keys(this.vocabularies).length;
  }

  addMapping(data: MappingData) {
    if (data.meta.umlsVersion != this.meta.umlsVersion) {
      let msg = 'the UMLS version does not match';
      console.error(msg, data.meta.umlsVersion, this.meta.umlsVersion);
      throw new Error(msg);
    }
    for (let [vocId, voc] of Object.entries(data.vocabularies)) {
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
    // check that only custom codes are added to existing concepts
    for (let concept of Object.values(data.concepts)) {
      let concept0 = this.concepts[concept.id];
      if (concept0 === undefined) continue;
      for (let vocId of Object.keys(concept.codes)) {
        let codes0 = concept0.codes[vocId];
        if (codes0 === undefined) continue;
        for (let codeId of concept.codes[vocId]) {
          if (!codes0.has(codeId) && !data.codes[vocId][codeId].custom) {
            throw new Error(`code ${vocId}/${codeId} is new in concept ${concept.id} but not marked as custom`)
          }
        }
      }
    }

    for (let vocId of Object.keys(data.codes)) {
      for (let [id, code] of Object.entries(data.codes[vocId])) {
        code.tag = normalizeTag(code.tag, this.meta.allowedTags);
        let code0 = this.codes[vocId][id];
        if (code0 === undefined) {
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
            } else if (code.tag && code0.tag != code.tag) {
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

    for (let [cui, concept] of Object.entries(data.concepts)) {
      if (Object.keys(concept.codes).length == 0) continue;
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
    vocabularies: Vocabularies,
    caches: Caches
  ) {
    let customCodes = this.getCustomCodes(caches);
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

  getCustomCodes(caches: Caches): CustomCodes {
    let res: CustomCodes = { codes: {}, conceptCodes: {} };
    for (let [vocId, codes] of Object.entries(this.codes)) {
      for (let [codeId, code] of Object.entries(codes)) {
        if (code.custom) {
          res.codes[vocId] ??= {};
          res.codes[vocId][codeId] = code;
          for (let conceptId of caches.getConceptsByCode(vocId, codeId)) {
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
      let concept1: Concept = {
        id: cui,
        name: concept.name,
        definition: concept.definition,
        codes: {},
      };
      for (let voc of Object.keys(concept.codes)) {
        for (let code of concept.codes[voc]) {
          if (!remapConcepts[cui]?.codes[voc]?.has(code)) {
            hasLostCode = true;
            concept1.codes[voc] ??= new Set();
            concept1.codes[voc].add(code);
            if (!remapCodes[voc]?.[code]) {
              lost.codes[voc] ??= {};
              let oldCode = this.codes[voc][code];
              lost.codes[voc][code] = {
                id: code,
                term: oldCode.term,
                custom: true,
                enabled: oldCode.enabled,
                tag: oldCode.tag,
              };
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

  caches(): Caches {
    // reset: conceptsByCode lookup
    let conceptsByCode: ConceptsByCode = {};
    let conceptTags: ConceptTags = {};
    for (const vocId of Object.keys(this.vocabularies)) {
      this.codes[vocId] ??= {};
    }
    for (const concept of Object.values(this.concepts)) {
      for (const [vocId, codeIds] of Object.entries(concept.codes)) {
        conceptsByCode[vocId] ??= {};
        for (const codeId of codeIds) {
          conceptsByCode[vocId][codeId] ??= new Set();
          conceptsByCode[vocId][codeId].add(concept.id);
        }
      }
      conceptTags[concept.id] = getCodesTag(concept, this.codes);
    }
    // cleanup: drop non-custom codes that are not referred to by any concepts
    for (const [vocId, codes] of Object.entries(this.codes)) {
      for (const codeId of Object.keys(codes)) {
        if (
          conceptsByCode[vocId]?.[codeId] == undefined &&
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
    return new Caches(conceptsByCode, conceptTags);
  }

  setCodeConcept(vocId: VocabularyId, codeId: CodeId, conceptIds: ConceptId[], caches: Caches) {
    for (const id of caches.getConceptsByCode(vocId, codeId)) {
      this.concepts[id].codes[vocId].delete(codeId);
    }
    for (const id of conceptIds) {
      this.concepts[id].codes[vocId] ??= new Set();
      this.concepts[id].codes[vocId].add(codeId);
    }
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

export type ConceptsByCode = {
  [key: VocabularyId]: { [key: CodeId]: Set<ConceptId> };
};
export type ConceptTags = { [key: VocabularyId]: Tag | null };

export class Caches {
  constructor(
    private conceptsByCode: ConceptsByCode,
    private conceptTags: ConceptTags
  ) {}
  getConceptsByCode(vocId: VocabularyId, codeId: CodeId): ConceptId[] {
    return Array.from(this.conceptsByCode[vocId]?.[codeId] ?? []);
  }
  getConceptTags(): ConceptTags {
    return this.conceptTags;
  }
}