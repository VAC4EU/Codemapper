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

import * as data from './data';

var relevantSemanticTypes =
  ["T020", "T190", "T049", "T019", "T047", "T050", "T037", "T048",
    "T191", "T046", "T184", "T033", "T005", "T004", "T204", "T007"];

export interface SourceConcept {
  cui : string;
  codingSystem : string;
  id : string;
  preferredTerm : string;
}

export function importCode(c : SourceConcept) : data.Code {
  return new data.Code(c.id, c.preferredTerm, false, true, null)
}

export interface UmlsConcept {
  cui : string;
  preferredName : string;
  definition : string;
  sourceConcepts : SourceConcept[];
  semanticTypes : string[];
}

export function importConcept0(c : UmlsConcept) : data.Concept {
  return new data.Concept(c.cui, c.preferredName, c.definition, {}, null);
}

export function importConcept(c : UmlsConcept) :
  [data.Concept, { [key : data.VocabularyId] : { [key : data.CodeId] : data.Code } }] {
  let concept = importConcept0(c);
  let codes : { [key : string] : { [key : string] : data.Code } } = {};
  for (let code of c.sourceConcepts) {
    if (!concept.codes[code.codingSystem]) {
      concept.codes[code.codingSystem] = new Set();
    }
    concept.codes[code.codingSystem].add(code.id);
    codes[code.codingSystem] ??= {};
    codes[code.codingSystem][code.id] = importCode(code);
  }
  return [concept, codes]
}

function hasRelevantType(concept : UmlsConcept) : boolean {
  return concept.semanticTypes.some(t => relevantSemanticTypes.indexOf(t) != -1);
}

export function importConcepts(umlsConcepts : UmlsConcept[]) : data.ConceptsCodes {
  let concepts : data.Concepts = {};
  let codes : data.Codes = {};
  for (let [concept, codes1] of umlsConcepts.filter(hasRelevantType).map(importConcept)) {
    concepts[concept.id] = concept;
    for (let vocId in codes1) {
      codes[vocId] ??= {};
      for (let codeId in codes1[vocId]) {
        codes[vocId][codeId] = codes1[vocId][codeId];
      }
    }
  }
  return { concepts, codes };
}

export interface Vocabulary {
  abbreviation : string,
  name : string,
  version : string,
}

export function importVocabulary(voc : Vocabulary) : data.Vocabulary {
  return new data.Vocabulary(voc.abbreviation, voc.name, voc.version, false);
}
