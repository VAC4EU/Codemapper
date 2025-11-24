import {
  Concepts,
  Codes,
  VocabularyId,
  CodeId,
  ConceptId,
  Tag,
  getCodesTag,
} from './mapping-data';

export class Caches {
  constructor(
    public conceptsByCode: CacheConceptsByCode = new CacheConceptsByCode({}),
    public conceptTags: CacheConceptTags = new CacheConceptTags({})
  ) {}
  static create(concepts: Concepts, codes: Codes): Caches {
    let conceptsByCode = CacheConceptsByCode.create(concepts);
    let conceptTags = CacheConceptTags.create(concepts, codes);
    return new Caches(conceptsByCode, conceptTags);
  }
  getConceptsByCode(vocId: VocabularyId, codeId: CodeId): Set<ConceptId> {
    return this.conceptsByCode.get(vocId, codeId);
  }
  getConceptTags(conceptId: ConceptId): Tag | null {
    return this.conceptTags.get(conceptId);
  }
}

export class CacheConceptTags {
  inner: { [key: ConceptId]: Tag | null };
  constructor(inner: { [key: ConceptId]: Tag | null }) {
    this.inner = inner;
  }
  get(conceptId: ConceptId): Tag | null {
    return this.inner[conceptId] ?? null;
  }
  static create(concepts: Concepts, codes: Codes): CacheConceptTags {
    let inner: { [key: ConceptId]: Tag | null } = {};
    for (const concept of Object.values(concepts)) {
      inner[concept.id] = getCodesTag(concept, codes);
    }
    return new CacheConceptTags(inner);
  }
}

export class CacheConceptsByCode {
  inner: { [key: VocabularyId]: { [key: CodeId]: Set<ConceptId> } };
  constructor(inner: {
    [key: VocabularyId]: { [key: CodeId]: Set<ConceptId> };
  }) {
    this.inner = inner;
  }
  get(vocId: VocabularyId, codeId: CodeId): Set<ConceptId> {
    return this.inner[vocId]?.[codeId] ?? new Set();
  }
  static create(concepts: Concepts): CacheConceptsByCode {
    let inner: { [key: VocabularyId]: { [key: CodeId]: Set<ConceptId> } } = {};
    for (const concept of Object.values(concepts)) {
      for (const [vocId, codeIds] of Object.entries(concept.codes)) {
        let codes = (inner[vocId] ??= {});
        for (const codeId of codeIds) {
          let conceptIds = (codes[codeId] ??= new Set());
          conceptIds.add(concept.id);
        }
      }
    }
    return new CacheConceptsByCode(inner);
  }
}
