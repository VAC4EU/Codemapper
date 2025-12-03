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
  CodeId,
  CodeIds,
  Codes,
  ConceptCodeIds,
  ConceptId,
  Concepts,
  ConceptsCodes,
  DataMeta,
  formatMultipleTags,
  MappingData,
  normalizeTag,
  Start,
  Tags,
  Vocabularies,
  VocabularyId,
} from './mapping-data';
import {
  DowngradedMessage,
  UpgradedMessage,
  Message,
  Messages,
} from './messages';
import { CacheConceptsByCode, Caches } from './caches';

export const CUSTOM_CUI = 'C0000000';

type CustomCodes = { codes: Codes; conceptCodeIds: ConceptCodeIds };

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
            throw new Error(
              `code ${vocId}/${codeId} is new in concept ${concept.id} but not marked as custom`
            );
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
            concept0.codes[vocId] ??= new Set();
            concept0.codes[vocId].add(id);
          }
        }
      }
    }
  }

  remap(
    umlsVersion: string,
    remap: ConceptsCodes,
    vocabularies: Vocabularies,
    caches: Caches,
    messages: Messages // output
  ) {
    // collect details from this mapping that are not in the remap object
    let customCodes = Mapping.getCustomCodes(this.codes, caches);
    let customVocabularies = Mapping.getCustomVocabularies(this.vocabularies);
    let disabled = Mapping.getCodesDisabled(this.codes);
    let tags = Mapping.getTags(this.codes);
    let customConcept = this.concepts[CUSTOM_CUI];
    let downgraded = Mapping.getDowngraded(this, remap);

    // write the details to the remap object
    Object.assign(vocabularies, customVocabularies);
    if (customConcept) remap.concepts[customConcept.id] = customConcept;
    let upgraded = Mapping.setCustomCodes(remap, customCodes);
    Mapping.setCodesDisabled(remap.codes, disabled);
    Mapping.setDowngraded(remap, downgraded);
    Mapping.setTags(remap.codes, tags);

    // make the updated remap object this mapping
    this.meta.umlsVersion = umlsVersion;
    this.vocabularies = vocabularies;
    this.concepts = remap.concepts;
    this.codes = remap.codes;

    messages.addNonEmpty(new DowngradedMessage(downgraded.codes));
    messages.addNonEmpty(new UpgradedMessage(upgraded));
  }

  public static getTags(codes: Codes): Tags {
    let tags: Tags = {};
    for (let vocId of Object.keys(codes)) {
      for (let code of Object.values(codes[vocId])) {
        if (code.tag === null) continue;
        (tags[vocId] ??= {})[code.id] = code.tag;
      }
    }
    return tags;
  }

  public static setTags(codes: Codes, tags: Tags) {
    for (let vocId of Object.keys(tags)) {
      let codes1 = codes[vocId];
      if (codes1 === undefined) continue;
      for (let codeId of Object.keys(tags[vocId])) {
        let code = codes1[codeId];
        if (code === undefined) continue;
        code.tag = tags[vocId][codeId];
      }
    }
  }

  static getCustomCodes(codes: Codes, caches: Caches): CustomCodes {
    let res: CustomCodes = { codes: {}, conceptCodeIds: {} };
    for (let vocId of Object.keys(codes)) {
      for (let code of Object.values(codes[vocId])) {
        if (!code.custom) continue;
        (res.codes[vocId] ??= {})[code.id] = code;
        for (let conceptId of caches.getConceptsByCode(vocId, code.id)) {
          ((res.conceptCodeIds[conceptId] ??= {})[vocId] ??= []).push(code.id);
        }
      }
    }
    return res;
  }

  static setCustomCodes(
    conceptsCodes: ConceptsCodes,
    custom: CustomCodes
  ): Upgraded {
    let upgraded: Upgraded = {};
    // Insert custom codes or copy properties to new existing codes
    for (let vocId of Object.keys(custom.codes)) {
      let codes = (conceptsCodes.codes[vocId] ??= {});
      for (let code of Object.values(custom.codes[vocId])) {
        let code0 = codes[code.id];
        if (code0 === undefined) {
          codes[code.id] = structuredClone(code);
        } else {
          (upgraded[vocId] ??= {})[code.id] = null;
          code0.tag = code.tag;
          code0.enabled = code.enabled;
        }
      }
    }
    // link remaining custom codes to new concepts, and record upgrade codes that were moved
    let conceptsCache = CacheConceptsByCode.create(conceptsCodes.concepts);
    for (let conceptId of Object.keys(custom.conceptCodeIds)) {
      if (conceptsCodes.concepts[conceptId] === undefined) {
        throw new Error(`Custom code with unavailable concept ${conceptId}`);
      }
      for (let vocId of Object.keys(custom.conceptCodeIds[conceptId])) {
        for (let codeId of custom.conceptCodeIds[conceptId][vocId]) {
          if (upgraded?.[vocId]?.[codeId] !== undefined) {
            let conceptIds = conceptsCache.get(vocId, codeId);
            if (!conceptIds.has(conceptId)) {
              upgraded[vocId][codeId] = [conceptId, conceptIds];
            }
          } else {
            (conceptsCodes.concepts[conceptId].codes[vocId] ??= new Set()).add(
              codeId
            );
          }
        }
      }
    }
    return upgraded;
  }

  static getCustomVocabularies(vocabularies: Vocabularies): Vocabularies {
    let res: Vocabularies = {};
    for (let [vocId, voc] of Object.entries(vocabularies)) {
      if (voc.custom) {
        res[vocId] = voc;
      }
    }
    return res;
  }

  static getCodesDisabled(codes: Codes): CodeIds {
    let res: CodeIds = {};
    for (let vocId of Object.keys(codes)) {
      let codeIds = (res[vocId] ??= new Set());
      for (let code of Object.values(codes[vocId])) {
        if (code.enabled) continue;
        codeIds.add(code.id);
      }
    }
    return res;
  }

  static setCodesDisabled(codes: Codes, disabled: CodeIds) {
    for (let vocId of Object.keys(disabled)) {
      for (let codeId of disabled[vocId]) {
        let code = codes[vocId]?.[codeId];
        if (code === undefined) {
          console.warn("[remap] disabled code not found", vocId, codeId);
          continue;
        };
        code.enabled = false;
      }
    }
  }

  /** Find regular codes in that are not available in the remapped codes (and have to become custom codes)  */
  public static getDowngraded(
    current: ConceptsCodes,
    remap: ConceptsCodes
  ): ConceptsCodes {
    let downgraded: ConceptsCodes = {
      concepts: {},
      codes: {},
    };
    for (let cui of Object.keys(current.concepts)) {
      let codeIds: CodeIds = {};
      for (let vocId of Object.keys(current.concepts[cui].codes)) {
        for (let codeId of current.concepts[cui].codes[vocId]) {
          if (remap.concepts[cui]?.codes[vocId]?.has(codeId)) continue; // code in remap
          (codeIds[vocId] ??= new Set()).add(codeId);
          if (remap.codes[vocId]?.[codeId]) continue; // code in other concepts in remap
          let code = structuredClone(current.codes[vocId][codeId]);
          if (code.custom) continue; // already captured in custom codes
          code.custom = true;
          downgraded.codes[vocId] ??= {};
          downgraded.codes[vocId][codeId] = code;
        }
      }
      if (Object.keys(codeIds).length > 0) {
        let concept = structuredClone(current.concepts[cui]);
        concept.codes = codeIds;
        downgraded.concepts[cui] = concept;
      }
    }
    return downgraded;
  }

  public static setDowngraded(conceptsCodes: ConceptsCodes, downgraded: ConceptsCodes) {
    for (let vocId of Object.keys(downgraded.codes)) {
      let codes = conceptsCodes.codes[vocId] ??= {};
      for (let codeId of Object.keys(downgraded.codes[vocId])) {
        let code = downgraded.codes[vocId][codeId];
        if (codes[codeId] !== undefined) continue;
        codes[codeId] = code;
      }
    }
    for (let cui of Object.keys(downgraded.concepts)) {
      let concept = conceptsCodes.concepts[cui];
      if (concept === undefined) {
        conceptsCodes.concepts[cui] = downgraded.concepts[cui];
      } else {
        for (let vocId of Object.keys(downgraded.concepts[cui].codes)) {
          for (let codeId of downgraded.concepts[cui].codes[vocId]) {
            (concept.codes[vocId] ??= new Set()).add(codeId);
          }
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
    return Caches.create(this.concepts, this.codes);
  }

  cleanupCheck(caches: Caches) {
    for (const vocId of Object.keys(this.vocabularies)) {
      this.codes[vocId] ??= {};
    }
    // cleanup: drop non-custom codes that are not referred to by any concepts
    for (const [vocId, codes] of Object.entries(this.codes)) {
      for (const codeId of Object.keys(codes)) {
        if (
          caches.getConceptsByCode(vocId, codeId).size == 0 &&
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

  setCodeConcept(
    vocId: VocabularyId,
    codeId: CodeId,
    conceptIds: ConceptId[],
    caches: Caches
  ) {
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
        let original = this.codes[vocId][id];
        if (original === undefined) {
          this.codes[vocId][id] = code;
        } else {
          if (code.tag) {
            original.tag = code.tag;
          }
          if (code.enabled) {
            original.enabled = true;
          }
        }
      }
    }
  }
}

export type Upgraded = {
  [key: VocabularyId]: { [key: CodeId]: [ConceptId, Set<ConceptId>] | null };
};
