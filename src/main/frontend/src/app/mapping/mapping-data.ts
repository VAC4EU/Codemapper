import { Mapping } from "./mapping";


export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export interface JSONArray extends Array<JSONValue> {}


export type VocabularyId = string;
export type ConceptId = string; // CUI
export type CodeId = string; // The actual code
export type Tag = string;

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
  start: Start;
  vocabularies: Vocabularies;
  concepts: Concepts;
  codes: Codes;
}

export function importMappingDataJSON(
  json0: JSONValue,
  info: ServerInfo
): MappingData {
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
    vocabularies[id] = { id, name, version, custom };
  }
  let concepts: Concepts = {};
  let conceptTags: { [key: VocabularyId]: { [key: CodeId]: Set<string> } } = {};
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
    concepts[id] = { id, name, definition, codes };
  }

  let codes: Codes = {};
  for (let [vocId, codesJson] of Object.entries(json['codes'] as JSONObject)) {
    codes[vocId] = {};
    for (let codeJson0 of Object.values(codesJson as JSONObject)) {
      let codeJson = codeJson0 as JSONObject;
      let id = codeJson['id'] as CodeId;
      let term = codeJson['term'] as string;
      let custom = codeJson['custom'] as boolean;
      let enabled = codeJson['enabled'] as boolean;
      let tag = formatTag(getTag(codeJson), conceptTags[vocId]?.[id]);
      codes[vocId][id] = { id, term, custom, enabled, tag };
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

  let res = { meta, start, vocabularies, concepts, codes };
  console.log('Import mapping', json0, res);
  return res;
}

function importMappingDataLegacyJSON(
  v0: JSONValue,
  serverInfo: ServerInfo
): MappingData {
  let v = v0 as JSONObject;
  let vocabularies: { [key: VocabularyId]: Vocabulary } = {};
  for (const id0 of v['codingSystems'] as JSONArray) {
    let id = id0 as string;
    vocabularies[id] = {
      id,
      name: 'unknown (imported mapping)',
      version: 'unknown (imported mapping)',
      custom: false,
    };
  }
  let concepts: { [key: ConceptId]: Concept } = {};
  let codes: { [key: VocabularyId]: { [key: CodeId]: Code } } = {};
  let tags: { [key: VocabularyId]: { [key: CodeId]: Set<string> } } = {};
  for (const concept0 of (v['mapping'] as JSONObject)[
    'concepts'
  ] as JSONArray) {
    let conceptJson = concept0 as JSONObject;
    let tag = conceptJson['tag'] as string | null;
    let concept: Concept = {
      id: conceptJson['cui'] as string,
      name: conceptJson['preferredName'] as string,
      definition: conceptJson['definition'] as string,
      codes: {},
    };
    concepts[concept.id] = concept;
    for (let sourceConcept0 of conceptJson['sourceConcepts'] as JSONArray) {
      let sourceConcept = sourceConcept0 as JSONObject;
      let vocabularyId = sourceConcept['codingSystem'] as string;
      let codeId = sourceConcept['id'] as string;
      let code = {
        id: codeId,
        term: sourceConcept['preferredTerm'] as string,
        custom: false,
        enabled: sourceConcept['selected'] as boolean,
        tag: null,
      };
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
      return {
        id,
        name,
        definition: '',
        enabled: true,
        custom: false,
        codes: {},
      };
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

export function getTag(json: any) {
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

export function formatTag(
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

export function formatMultipleTags(tags: string[]): string {
  return 'multiple:' + tags.join('+');
}

export function normalizeTag(tag: string | null, tags: string[]) {
  if (tag && !tags.includes(tag)) {
    let tag0 = tags.find((tag0) => tag0.toLowerCase() == tag!.toLowerCase());
    if (tag0 !== undefined) {
      console.log(`normalize tag ${tag} to ${tag0}`);
      return tag0;
    }
  }
  return tag;
}

export interface Vocabulary {
  readonly id: VocabularyId;
  readonly name: string;
  readonly version: string | null;
  readonly custom: boolean;
}

export function compareVocabularies(v1: Vocabulary, v2: Vocabulary): number {
  return v1.id.localeCompare(v2.id);
}

export interface Concept {
  readonly id: ConceptId;
  readonly name: string;
  readonly definition: string;
  codes: { [key: VocabularyId]: Set<CodeId> };
}

export function getCodesTag(concept: Concept, codes: Codes): Tag | null {
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

export interface Code {
  id: CodeId;
  term: string;
  custom: boolean;
  enabled: boolean;
  tag: Tag | null;
}

export function codesEqualExceptTag(code1: Code, code2: Code): boolean {
  return (
    code1.id == code2.id &&
    code1.term == code2.term &&
    code1.custom == code2.custom
  );
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

export function mappingJsonifyReplacer(_field: string, value: any): any {
  if (value instanceof Set) {
    return Array.from(value);
  }
  return value;
}