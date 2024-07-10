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

import { MappingData, Code, Concept, ConceptsCodes, Concepts, Codes, ConceptId, Mapping, Tag, Vocabulary, VocabularyId, CodeId, Indexing, emptyIndexing } from './data';
import { ApiService } from './api.service';
import * as comp from './data-compatibility';

export const CUSTOM_CUI = "C0000000";

export class OpError extends Error {
}

function expect(ok : boolean, message : string = "", ...rest : any) {
  if (!ok) {
    console.error("UNEXPECTED", message, ...rest);
    throw new OpError(message || "unexpected");
  }
}

function objectKeysEq(o1 : any, o2 : any) : boolean {
  return setEq(new Set(Object.keys(o1)), new Set(Object.keys(o2)));
}

function arraySetEq<T>(a1 : T[], a2 : T[]) : boolean {
  return setEq(new Set(a1), new Set(a2));
}

function setEq<T>(a1 : Set<T>, a2 : Set<T>) : boolean {
  if (a1.size != a2.size) {
    return false;
  }
  for (const x1 of a1) {
    if (!a2.has(x1)) {
      return false;
    }
  }
  return true;
}

export abstract class Operation {
  // run the operation, return the inverse operation if anything was changed,
  // and it can be undone, and raise Error if the operation could not be applied
  public abstract run(mapping : Mapping) : Operation | undefined;
  public abstract describe() : string;
  saveRequired : boolean = false;
  afterRunCallback : () => void = () => { };
  public withAfterRunCallback(callback : () => void) {
    this.afterRunCallback = callback;
    return this;
  }
}

export class AddConcept extends Operation {

  constructor(
    readonly concept : Concept,
    readonly codes : { [key : VocabularyId] : { [key : CodeId] : Code } },
  ) {
    super();
    expect(arraySetEq(Object.keys(this.codes), Object.keys(this.concept.codes)));
    for (const [vocId, codes] of Object.entries(this.codes)) {
      expect(setEq(new Set(Object.keys(codes)), this.concept.codes[vocId]));
    }
  }

  override describe() : string {
    return `Add concept ${this.concept.id}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let original = mapping.concepts[this.concept.id];
    if (original !== undefined) {
      throw new Error("Concept already added");
    }
    mapping.concepts = { [this.concept.id]: this.concept, ...mapping.concepts }
    for (const [vocId, codes] of Object.entries(this.codes)) {
      for (const [codeId, code] of Object.entries(codes)) {
        let original = mapping.codes[vocId]?.[codeId];
        if (original === undefined) {
          mapping.codes[vocId][codeId] = code;
        } else {
          expect(code.sameAs(original));
        }
      }
    }
    return new RemoveConcept(this.concept.id);
  }
}

export class RemoveConcept extends Operation {

  constructor(
    readonly conceptId : ConceptId,
  ) {
    super();
  }

  override describe() : string {
    return `Remove concept ${this.conceptId}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let concept = mapping.concepts[this.conceptId];
    expect(concept !== undefined);
    delete mapping.concepts[this.conceptId];
    mapping.concepts = { ...mapping.concepts };
    let codes : { [key : VocabularyId] : { [key : CodeId] : Code } } = {};
    for (const [vocId, codeIds] of Object.entries(concept.codes)) {
      codes[vocId] = {};
      for (const codeId of codeIds) {
        codes[vocId][codeId] = mapping.codes[vocId][codeId];
      }
    }
    return new AddConcept(concept, codes);
  }
}

export class SetStartIndexing extends Operation {
  constructor(
    readonly indexing : Indexing,
    readonly concepts : Concepts,
    readonly codes : Codes,
  ) {
    super();
    this.saveRequired = true;
  }
  override describe() : string {
    return `Set start to ${this.indexing.selected.join(", ")}`
  }
  override run(mapping : Mapping) : Operation | undefined {
    expect(mapping.isEmpty(), "mapping must be empty to set start");
    mapping.start = this.indexing;
    mapping.addConceptsCodes(this.concepts, this.codes);
    return new ResetStart();
  }
}

export class ResetStart extends Operation {
  constructor() {
    super();
  }
  override describe() : string {
    return `Reset start`
  }
  override run(mapping : Mapping) : Operation | undefined {
    mapping.start = null;
    mapping.codes = {};
    mapping.concepts = {};
    return;
  }
}

export class AddConcepts extends Operation {
  constructor(
    readonly concepts : Concepts,
    readonly codes : Codes,
  ) {
    super();
  }

  override describe() : string {
    let ids = Object.keys(this.concepts);
    return `Add concepts ${ids.join(", ")}`
  }
  override run(mapping : Mapping) : Operation | undefined {
    console.log("ADD CONCEPTS", this.concepts, this.codes);
    let ids = Object.keys(this.concepts)
      .filter(id => id in mapping.concepts);
    mapping.addConceptsCodes(this.concepts, this.codes);
    return new RemoveConcepts(ids);
  }
}

export class RemoveConcepts extends Operation {
  constructor(
    readonly ids : ConceptId[],
  ) {
    super();
  }
  override describe() : string {
    return `Remove concepts ${this.ids.join(", ")}`
  }
  override run(mapping : Mapping) : Operation | undefined {
    let concepts : Concepts = {};
    let codes : Codes = {};
    for (let id of this.ids) {
      let concept = mapping.concepts[id];
      expect(concept !== undefined);
      concepts[id] = concept;
      delete mapping.concepts[id];
      for (const [vocId, codeIds] of Object.entries(concept.codes)) {
        codes[vocId] ??= {};
        for (const codeId of codeIds) {
          codes[vocId][codeId] = mapping.codes[vocId][codeId];
        }

      }
    }
    mapping.concepts = { ...mapping.concepts };
    return new AddConcepts(concepts, codes);
  }
}

export class SetCodeEnabled extends Operation {

  constructor(
    readonly vocId : VocabularyId,
    readonly codeId : CodeId,
    readonly enabled : boolean,
  ) {
    super();
  }

  override describe() : string {
    return `Set code ${this.enabled ? "enabled" : "disabled"} ${this.vocId} ${this.codeId}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let code = mapping.codes[this.vocId]?.[this.codeId];
    expect(code !== undefined);
    let originalEnabled = code.enabled;
    if (originalEnabled !== this.enabled) {
      code.enabled = this.enabled;
      // mapping.codes = {...mapping.codes};
      return new SetCodeEnabled(this.vocId, this.codeId, originalEnabled);
    }
    return;
  }
}

export class AddCustomCode extends Operation {

  constructor(
    readonly vocId : VocabularyId,
    readonly code : Code,
    readonly conceptId : ConceptId,
  ) {
    super();
    expect(code.custom);
  }

  override describe() : string {
    return `Add custom code ${this.conceptId} ${this.vocId} ${this.code.term} ${this.code.id}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    console.log("ADD", this);
    let concept = mapping.concepts[this.conceptId];
    expect(concept !== undefined, "invalid CUI for custom code", this.conceptId);
    concept.codes[this.vocId] ??= new Set();
    concept.codes[this.vocId].add(this.code.id);
    mapping.codes[this.vocId] ??= {};
    expect(mapping.codes[this.vocId][this.code.id] === undefined);
    mapping.codes[this.vocId][this.code.id] = this.code;
    return new RemoveCustomCode(this.vocId, this.code.id);
  }
}

export class RemoveCustomCode extends Operation {

  constructor(
    readonly vocId : VocabularyId,
    readonly codeId : CodeId,
  ) {
    super();
  }

  override describe() : string {
    return `Remove custom code ${this.vocId} ${this.codeId}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let code = mapping.codes[this.vocId]?.[this.codeId];
    expect(code !== undefined && code.custom);
    let conceptIds = mapping.getConceptsByCode(this.vocId, this.codeId);
    expect(conceptIds.length == 1, "custom code must be associated to one concept only");
    let conceptId = conceptIds[0];
    let concept = mapping.concepts[conceptId];
    expect(concept !== undefined);
    expect(concept.codes[this.vocId] !== undefined);
    delete mapping.codes[this.vocId][this.codeId];
    concept.codes[this.vocId].delete(this.codeId);
    return new AddCustomCode(this.vocId, code, conceptId);
  }
}

export class EditCustomCode extends Operation {

  constructor(
    readonly vocId : VocabularyId,
    readonly codeId : CodeId,
    readonly code : Code,
    readonly conceptId : ConceptId,
  ) {
    super();
    expect(codeId == code.id, "edit code id must be edited code id", codeId, code.id);
  }

  override describe() : string {
    return `Edit custom code ${this.vocId} ${this.codeId}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let code = mapping.codes[this.vocId]?.[this.codeId];
    expect(code?.custom);
    let conceptIds = mapping.getConceptsByCode(this.vocId, this.codeId);
    expect(conceptIds.length == 1, "custom code must have one concept");
    mapping.codes[this.vocId][this.codeId] = this.code;
    mapping.setCodeConcept(this.vocId, this.codeId, [this.conceptId]);
    return new EditCustomCode(this.vocId, this.codeId, code, conceptIds[0]);
  }
}

export class CodesSetTag extends Operation {

  constructor(
    readonly vocId : VocabularyId,
    readonly codeIdsTags : { [key : string/*CodeId*/] : Tag | null },
  ) {
    super();
  }

  override describe() : string {
    let info = Object.entries(this.codeIdsTags)
      .map(([id, tag]) => `of ${id} to ${tag ?? "<DELETE TAG>"}`)
      .join(" and ");
    return `Codes set tags ${this.vocId} ${info}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let newCodeIdsTags : { [key : string] : Tag | null } = {};
    for (let [codeId, tag] of Object.entries(this.codeIdsTags)) {
      let code = mapping.codes[this.vocId]?.[codeId];
      expect(code !== undefined);
      newCodeIdsTags[code.id] = code.tag;
      code.tag = tag;
    }
    return new CodesSetTag(this.vocId, newCodeIdsTags);
  }
}

export class ConceptsSetTag extends Operation {

  constructor(
    readonly conceptIdsTags : { [key : string/*ConceptId*/] : Tag | null },
  ) {
    super();
  }

  override describe() : string {
    let info = Object.entries(this.conceptIdsTags)
      .map(([id, tag]) => `of ${id} to ${tag ?? "<DELETE TAG>"}`)
      .join(" and ");
    return `Concepts set tags ${info}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let newConceptsIdsTags : { [key : string] : Tag | null } = {};
    for (let [conceptId, tag] of Object.entries(this.conceptIdsTags)) {
      let concept = mapping.concepts[conceptId];
      expect(concept !== undefined, "invalid concept ID", conceptId);
      newConceptsIdsTags[concept.id] = concept.tag;
      concept.tag = tag;
    }
    return new ConceptsSetTag(newConceptsIdsTags);
  }
}

export class AddVocabularies extends Operation {
  constructor(
    readonly vocs : Vocabulary[],
    readonly codes : { [key : VocabularyId] : Code[] },
    readonly conceptCodes : { [key : ConceptId] : { [key : VocabularyId] : CodeId[] } }) {
    super();
  }

  override describe() : string {
    return `Add vocabularies ${this.vocs.map(v => v.id)}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    for (let voc of this.vocs) {
      expect(mapping.vocabularies[voc.id] === undefined,
        "Added vocabulary must not exist", voc.id);
    }
    for (let voc of this.vocs) {
      mapping.vocabularies[voc.id] = voc;
    }
    mapping.vocabularies = { ...mapping.vocabularies };
    for (let [vocId, codes] of Object.entries(this.codes)) {
      mapping.codes[vocId] = {};
      for (let code of codes) {
        mapping.codes[vocId][code.id] = code;
      }
    }
    mapping.codes = { ...mapping.codes };
    for (let [cui, byVoc] of Object.entries(this.conceptCodes)) {
      for (let [vocId, codeIds] of Object.entries(byVoc)) {
        mapping.concepts[cui].codes[vocId] = new Set(codeIds);
      }
    }
    mapping.concepts = { ...mapping.concepts };
    return new DeleteVocabularies(this.vocs.map(v => v.id))
  }
}

export class DeleteVocabularies extends Operation {
  constructor(
    readonly vocIds : VocabularyId[]
  ) {
    super();
  }

  override describe() : string {
    return `Remove vocabulary ${this.vocIds.join(", ")}`
  }

  override run(mapping : Mapping) : Operation | undefined {
    let vocs : Vocabulary[] = this.vocIds.map(id => mapping.vocabularies[id]);
    let codes : { [key : VocabularyId] : Code[] } = {};
    for (let vocId of this.vocIds) {
      codes[vocId] = Object.values(mapping.codes[vocId]);
      delete mapping.codes[vocId];
    }
    mapping.codes = { ...mapping.codes };
    for (let vocId of this.vocIds) {
      delete mapping.vocabularies[vocId];
    }
    mapping.vocabularies = { ...mapping.vocabularies };
    let conceptCodes : { [key : ConceptId] : { [key : VocabularyId] : CodeId[] } } = {};
    for (let concept of Object.values(mapping.concepts)) {
      for (let vocId of this.vocIds) {
        if (concept.codes[vocId]) {
          conceptCodes[concept.id] ??= {};
          conceptCodes[concept.id][vocId] ??= [];
          for (let codeId of concept.codes[vocId]) {
            conceptCodes[concept.id][vocId].push(codeId);
          }
          delete concept.codes[vocId];
        }
      }
    }
    mapping.concepts = { ...mapping.concepts };
    return new AddVocabularies(vocs, codes, conceptCodes);
  }
}

export class Remap extends Operation {
  constructor(
    private umlsVersion : string,
    private conceptsCodes : ConceptsCodes
  ) {
    super();
    this.saveRequired = true;
  }
  override describe() : string {
    return "Remap concept codes";
  }
  override run(mapping : Mapping) : Operation | undefined {
    let customCodes = mapping.getCustomCodes();
    let disabled = mapping.getCodesDisabled();
    let tags = mapping.getTags();
    let customConcept = mapping.concepts[CUSTOM_CUI];
    mapping.umlsVersion = this.umlsVersion;
    mapping.concepts = this.conceptsCodes.concepts;
    mapping.codes = this.conceptsCodes.codes;
    mapping.setCustomCodes(customCodes);
    mapping.setCodesDisabled(disabled);
    mapping.setTags(tags);
    if (customConcept) {
      mapping.concepts[customConcept.id] = customConcept;
    }
    return;
  }
}

export class ImportMapping extends Operation {
  constructor(
    private mapping : MappingData
  ) {
    super();
    this.saveRequired = true;
  }
  override describe() : string {
    return "Import initial mapping";
  }
  override run(mapping : Mapping) : Operation | undefined {
    if (!mapping.isEmpty()) {
      throw new Error("Cannot import, the mapping is not empty");
    }
    mapping.start = emptyIndexing("<not used>");
    mapping.vocabularies = this.mapping.vocabularies;
    mapping.concepts = this.mapping.concepts;
    mapping.codes = this.mapping.codes;
    mapping.umlsVersion = this.mapping.umlsVersion;
    return;
  }
}