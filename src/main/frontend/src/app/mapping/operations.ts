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
  MappingData,
  Code,
  Concept,
  ConceptsCodes,
  Vocabularies,
  Concepts,
  Codes,
  ConceptId,
  Tag,
  Vocabulary,
  VocabularyId,
  CodeId,
  Indexing,
  emptyIndexing,
  JSONObject,
  codesEqualExceptTag,
} from './mapping-data';
import { Mapping, Caches } from './mapping';

export class OpError extends Error {}

function expect(ok: boolean, message: string = '', ...rest: any) {
  if (!ok) {
    console.error('UNEXPECTED', message, ...rest);
    throw new OpError(message || 'unexpected');
  }
}

function arraySetEq<T>(a1: T[], a2: T[]): boolean {
  return setEq(new Set(a1), new Set(a2));
}

function setEq<T>(a1: Set<T>, a2: Set<T>): boolean {
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

export interface Operand {
  mapping: Mapping;
  caches: Caches;
}

export abstract class Operation {
  // run the operation, return the inverse operation if anything was changed,
  // and it can be undone, and raise Error if the operation could not be applied
  public abstract run({ mapping, caches }: Operand): Operation;
  public abstract describe(): string;
  saveRequired: boolean;
  saveReviewRequired: boolean;
  noUndo: boolean;
  afterRunCallback: () => void = () => {};
  constructor(
    options: {
      noUndo?: boolean;
      saveRequired?: boolean;
      saveReviewRequired?: boolean;
    } = {}
  ) {
    this.noUndo = options.noUndo ?? false;
    this.saveRequired = options.saveRequired ?? false;
    this.saveReviewRequired = options.saveReviewRequired ?? false;
  }
  public withAfterRunCallback(callback: () => void) {
    this.afterRunCallback = callback;
    return this;
  }
  public static fromObject(obj: JSONObject): Operation {
    switch (obj['operation'] as string | undefined) {
      case 'setIncludeDescendants':
        let includeDescendants = obj['includeDescendants'];
        if (typeof includeDescendants == 'boolean') {
          return new SetIncludeDescendants(includeDescendants);
        }
        break;
    }
    throw new Error('Invalid operation: ' + obj['Operation']);
  }
  public toObject(): JSONObject {
    let obj = JSON.parse(JSON.stringify(this));
    obj['type'] = this.constructor.name;
    return obj;
  }
}

export class SetIncludeDescendants extends Operation {
  constructor(readonly includeDescendants: boolean) {
    super();
  }
  public override run({ mapping }: Operand): Operation {
    let includeDescendants = mapping.meta.includeDescendants;
    mapping.meta.includeDescendants = this.includeDescendants;
    return new SetIncludeDescendants(includeDescendants);
  }
  public override describe(): string {
    if (this.includeDescendants) {
      return 'Include descendant codes';
    } else {
      return 'Exclude descendant codes';
    }
  }
}

export class AddConcept extends Operation {
  constructor(
    readonly concept: Concept,
    readonly codes: { [key: VocabularyId]: { [key: CodeId]: Code } }
  ) {
    super();
    expect(
      arraySetEq(Object.keys(this.codes), Object.keys(this.concept.codes))
    );
    for (const [vocId, codes] of Object.entries(this.codes)) {
      expect(setEq(new Set(Object.keys(codes)), this.concept.codes[vocId]));
    }
  }

  override describe(): string {
    return `Add concept ${this.concept.id}`;
  }

  override run({ mapping }: Operand): Operation {
    let original = mapping.concepts[this.concept.id];
    if (original !== undefined) {
      throw new Error('Concept already added');
    }
    mapping.concepts = { [this.concept.id]: this.concept, ...mapping.concepts };
    for (const [vocId, codes] of Object.entries(this.codes)) {
      for (const [codeId, code] of Object.entries(codes)) {
        let original = mapping.codes[vocId]?.[codeId];
        if (original === undefined) {
          mapping.codes[vocId][codeId] = code;
        } else {
          expect(codesEqualExceptTag(code, original));
        }
      }
    }
    return new RemoveConcept(this.concept.id);
  }
}

export class RemoveConcept extends Operation {
  constructor(readonly conceptId: ConceptId) {
    super();
  }

  override describe(): string {
    return `Remove concept ${this.conceptId}`;
  }

  override run({ mapping }: Operand): Operation {
    let concept = mapping.concepts[this.conceptId];
    expect(concept !== undefined);
    delete mapping.concepts[this.conceptId];
    mapping.concepts = { ...mapping.concepts };
    let codes: { [key: VocabularyId]: { [key: CodeId]: Code } } = {};
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
    readonly indexing: Indexing,
    readonly concepts: Concepts,
    readonly codes: Codes
  ) {
    super({ saveRequired: true });
  }
  override describe(): string {
    return `Set start to ${this.indexing.selected.join(', ')}`;
  }
  override run({ mapping }: Operand): Operation {
    expect(mapping.isEmpty(), 'mapping must be empty to set start');
    mapping.start = this.indexing;
    mapping.addConceptsCodes(this.concepts, this.codes);
    return new ResetStart();
  }
}

export class ResetStart extends Operation {
  constructor() {
    super({ noUndo: true });
  }
  override describe(): string {
    return `Reset start`;
  }
  override run({ mapping }: Operand): Operation {
    mapping.start = null;
    mapping.codes = {};
    mapping.concepts = {};
    return new NoUndoInversion(this.describe());
  }
}

export class NoUndoInversion extends Operation {
  constructor(private description: string) {
    super({ noUndo: true });
  }
  public override run({}: Operand): Operation {
    throw new Error('Cannot invert non-undoable operation');
  }
  public override describe(): string {
    return this.description;
  }
}

export class AddConcepts extends Operation {
  constructor(readonly concepts: Concepts, readonly codes: Codes) {
    super();
  }

  override describe(): string {
    let ids = Object.keys(this.concepts);
    return `Add concepts ${ids.join(', ')}`;
  }
  override run({ mapping }: Operand): Operation {
    console.log('ADD CONCEPTS', this.concepts, this.codes);
    mapping.addConceptsCodes(this.concepts, this.codes);
    let ids = Object.keys(this.concepts).filter((id) => id in mapping.concepts);
    return new RemoveConcepts(ids);
  }
}

export class RemoveConcepts extends Operation {
  constructor(readonly ids: ConceptId[]) {
    super();
  }
  override describe(): string {
    return `Remove concepts ${this.ids.join(', ')}`;
  }
  override run({ mapping }: Operand): Operation {
    let concepts: Concepts = {};
    let codes: Codes = {};
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
    readonly vocId: VocabularyId,
    readonly codeId: CodeId,
    readonly enabled: boolean
  ) {
    super();
  }

  override describe(): string {
    return `Set code ${this.enabled ? 'enabled' : 'disabled'} ${this.vocId} ${
      this.codeId
    }`;
  }

  override run({ mapping }: Operand): Operation {
    let code = mapping.codes[this.vocId]?.[this.codeId];
    expect(code !== undefined, "unknown code", {vocId: this.vocId, codeId: this.codeId});
    let originalEnabled = code.enabled;
    code.enabled = this.enabled;
    return new SetCodeEnabled(this.vocId, this.codeId, originalEnabled);
  }
}

export class AddCustomCode extends Operation {
  constructor(
    readonly vocId: VocabularyId,
    readonly code: Code,
    readonly conceptId: ConceptId
  ) {
    super();
    expect(code.custom);
  }

  override describe(): string {
    return `Add custom code ${this.conceptId} ${this.vocId} ${this.code.term} ${this.code.id}`;
  }

  override run({ mapping }: Operand): Operation {
    console.log('ADD', this);
    let concept = mapping.concepts[this.conceptId];
    expect(
      concept !== undefined,
      'invalid CUI for custom code',
      this.conceptId
    );
    concept.codes[this.vocId] ??= new Set();
    concept.codes[this.vocId].add(this.code.id);
    mapping.codes[this.vocId] ??= {};
    expect(mapping.codes[this.vocId][this.code.id] === undefined);
    mapping.codes[this.vocId][this.code.id] = this.code;
    return new RemoveCustomCode(this.vocId, this.code.id);
  }
}

export class RemoveCustomCode extends Operation {
  constructor(readonly vocId: VocabularyId, readonly codeId: CodeId) {
    super();
  }

  override describe(): string {
    return `Remove custom code ${this.vocId} ${this.codeId}`;
  }

  override run({ mapping, caches }: Operand): Operation {
    let code = mapping.codes[this.vocId]?.[this.codeId];
    expect(code !== undefined && code.custom);
    let conceptIds = caches.getConceptsByCode(this.vocId, this.codeId);
    expect(
      conceptIds.length == 1,
      'custom code must be associated to one concept only'
    );
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
    readonly vocId: VocabularyId,
    readonly codeId: CodeId,
    readonly code: Code,
    readonly conceptId: ConceptId
  ) {
    super();
    expect(
      codeId == code.id,
      'edit code id must be edited code id',
      codeId,
      code.id
    );
  }

  override describe(): string {
    return `Edit custom code ${this.vocId} ${this.codeId}`;
  }

  override run({ mapping, caches }: Operand): Operation {
    let code = mapping.codes[this.vocId]?.[this.codeId];
    expect(code?.custom);
    let conceptIds = caches.getConceptsByCode(this.vocId, this.codeId);
    expect(conceptIds.length == 1, 'custom code must have one concept');
    mapping.codes[this.vocId][this.codeId] = this.code;
    mapping.setCodeConcept(this.vocId, this.codeId, [this.conceptId], caches);
    return new EditCustomCode(this.vocId, this.codeId, code, conceptIds[0]);
  }
}

export type CodeTags = { [key: VocabularyId]: { [key: CodeId]: Tag | null } };

export class CodesSetTag extends Operation {
  constructor(readonly codeTags: CodeTags) {
    super();
  }

  override describe(): string {
    let count = Object.values(this.codeTags)
      .map((o) => Object.keys(o).length)
      .reduce((x, y) => x + y, 0);
    let tags = Array.from(
      new Set(
        Object.values(this.codeTags)
          .map((o) => Object.values(o))
          .reduce((x, y) => x.concat(y))
      )
    );
    let tag = tags.length == 1 ? tags[0] : undefined;
    let tagStr =
      tag == undefined ? 'various tags' : tag == null ? 'NO TAG' : tag;
    return `Codes set tags of ${count} codes to ${tagStr}`;
  }

  override run({ mapping }: Operand): Operation {
    let oldCodes: CodeTags = {};
    for (let vocId of Object.keys(this.codeTags)) {
      for (let codeId of Object.keys(this.codeTags[vocId])) {
        let code = mapping.codes[vocId]?.[codeId];
        expect(code !== undefined);
        oldCodes[vocId] ??= {};
        oldCodes[vocId][codeId] = code.tag;
        code.tag = this.codeTags[vocId][codeId];
      }
    }
    return new CodesSetTag(oldCodes);
  }
}

export class AddVocabularies extends Operation {
  constructor(
    readonly vocs: Vocabulary[],
    readonly codes: { [key: VocabularyId]: Code[] },
    readonly conceptCodes: {
      [key: ConceptId]: { [key: VocabularyId]: CodeId[] };
    }
  ) {
    super();
  }

  override describe(): string {
    return `Add vocabularies ${this.vocs.map((v) => v.id)}`;
  }

  override run({ mapping }: Operand): Operation {
    for (let voc of this.vocs) {
      expect(
        mapping.vocabularies[voc.id] === undefined,
        'Added vocabulary must not exist',
        voc.id
      );
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
    return new DeleteVocabularies(this.vocs.map((v) => v.id));
  }
}

export class DeleteVocabularies extends Operation {
  constructor(readonly vocIds: VocabularyId[]) {
    super();
  }

  override describe(): string {
    return `Remove vocabulary ${this.vocIds.join(', ')}`;
  }

  override run({ mapping }: Operand): Operation {
    let vocs: Vocabulary[] = this.vocIds.map((id) => mapping.vocabularies[id]);
    let codes: { [key: VocabularyId]: Code[] } = {};
    for (let vocId of this.vocIds) {
      codes[vocId] = Object.values(mapping.codes[vocId]);
      delete mapping.codes[vocId];
    }
    mapping.codes = { ...mapping.codes };
    for (let vocId of this.vocIds) {
      delete mapping.vocabularies[vocId];
    }
    mapping.vocabularies = { ...mapping.vocabularies };
    let conceptCodes: { [key: ConceptId]: { [key: VocabularyId]: CodeId[] } } =
      {};
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
    private umlsVersion: string,
    private conceptsCodes: ConceptsCodes,
    private vocabularies: Vocabularies
  ) {
    super({ saveRequired: true, noUndo: true });
  }
  override describe(): string {
    return 'Remap concept codes';
  }
  override run({ mapping, caches }: Operand): Operation {
    mapping.remap(
      this.umlsVersion,
      this.conceptsCodes.concepts,
      this.conceptsCodes.codes,
      this.vocabularies,
      caches
    );
    return new NoUndoInversion(this.describe());
  }
}

export class ImportMapping extends Operation {
  constructor(private mapping: MappingData) {
    super({ noUndo: true, saveRequired: true, saveReviewRequired: true });
  }
  override describe(): string {
    return 'Import initial mapping';
  }
  override run({ mapping, caches }: Operand): Operation {
    if (!mapping.isEmpty()) {
      throw new Error('Cannot import, the mapping is not empty');
    }
    mapping.start = emptyIndexing('<not used>');
    mapping.vocabularies = this.mapping.vocabularies;
    mapping.concepts = this.mapping.concepts;
    mapping.codes = this.mapping.codes;
    mapping.meta = this.mapping.meta;
    return new NoUndoInversion(this.describe());
  }
}

export class AddMapping extends Operation {
  constructor(private mapping: MappingData) {
    super({ noUndo: true, saveRequired: true });
  }
  override describe(): string {
    return 'Import mapping';
  }
  override run({ mapping }: Operand): Operation {
    mapping.addMapping(this.mapping);
    return new NoUndoInversion(this.describe());
  }
}
