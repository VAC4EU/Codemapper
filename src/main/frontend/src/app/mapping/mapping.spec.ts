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
  Concept,
  Concepts,
  Code,
  Codes,
  EMPTY_DATA_META,
  Vocabulary,
  Tag,
} from './mapping-data';
import { Mapping } from './mapping';

function mkVoc(
  id: string,
  version: string,
  custom: boolean = false
): Vocabulary {
  return { id, version, custom, name: '' };
}

function mkConcept(id: string, codes: { [key: string]: Set<string> }): Concept {
  return { id, codes, name: '', definition: '' };
}

function mkCode(
  id: string,
  options: {
    custom?: boolean;
    enabled?: boolean;
    tag?: Tag;
  } = {}
): Code {
  return {
    id,
    term: '',
    custom: options.custom ?? false,
    enabled: options.enabled ?? true,
    tag: options.tag ?? null,
  };
}

function mkMapping(): Mapping {
  return new Mapping(
    { ...EMPTY_DATA_META, umlsVersion: '2025AA' },
    null,
    {
      V1: mkVoc('V1', '1', false),
      V2: mkVoc('V2', '1', false),
      W: mkVoc('W', '1', true),
    },
    {
      C1: mkConcept('C1', {
        V1: new Set(['x0', 'x1']),
      }),
      C2: mkConcept('C2', {
        V1: new Set(['x2', 'x3']),
        W: new Set(['w1']),
      }),
    },
    {
      V1: {
        x0: mkCode('x0'),
        x1: mkCode('x1'),
        x2: mkCode('x2', { tag: 'broader' }),
        x3: mkCode('x3', { enabled: false }),
      },
      W: {
        w1: mkCode('w1', { custom: true }),
      },
    }
  );
}

function makeMappingData(): Mapping {
  return Mapping.fromData({
    start: null,
    meta: { ...EMPTY_DATA_META, umlsVersion: '2025AA' },
    vocabularies: {
      V1: mkVoc('V1', '1'),
      W: mkVoc('W', '1', true),
    },
    concepts: {
      C1: mkConcept('C1', {
        V1: new Set(['x1']),
      }),
      C2: mkConcept('C2', {
        V1: new Set(['x2', 'x3']),
        W: new Set(['w2']),
      }),
    },
    codes: {
      V1: {
        x1: mkCode('x1', { tag: 'narrower' }),
        x2: mkCode('x2', { tag: 'narrower' }),
        x3: mkCode('x3'),
      },
      W: {
        w2: mkCode('w2', { custom: true }),
      },
    },
  });
}

describe('adding mappings', () => {
  it('should work', () => {
    let mapping = mkMapping();
    mapping.addMapping(makeMappingData());
    expect(mapping.toData()).toEqual(
      new Mapping(
        { ...EMPTY_DATA_META, umlsVersion: '2025AA' },
        null,
        {
          V1: mkVoc('V1', '1'),
          V2: mkVoc('V2', '1'),
          W: mkVoc('W', '1', true),
        },
        {
          C1: mkConcept('C1', {
            V1: new Set(['x0', 'x1']),
          }),
          C2: mkConcept('C2', {
            V1: new Set(['x2', 'x3']),
            W: new Set(['w1', 'w2']),
          }),
        },
        {
          V1: {
            x0: mkCode('x0'),
            x1: mkCode('x1', { tag: 'narrower' }),
            x2: mkCode('x2', { tag: 'multiple:broader+narrower' }),
            x3: mkCode('x3'),
          },
          W: {
            w1: mkCode('w1', { custom: true }),
            w2: mkCode('w2', { custom: true }),
          },
        }
      ).toData()
    );
  });

  it('should fail on different UMLS version', () => {
    {
      let mappingData = makeMappingData();
      mappingData.meta.umlsVersion = '1999AA';
      let mapping = mkMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'the UMLS version does not match'
      );
    }
  });
  it('should fail on unknown vocabulary', () => {
    {
      let mappingData = makeMappingData();
      mappingData.vocabularies['V3'] = mkVoc('V3', '1');
      let mapping = mkMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'the vocabularies must already exist, but V3 does not'
      );
    }
  });

  it('should fail on different vocabulary version', () => {
    {
      let mappingData = makeMappingData();
      mappingData.vocabularies['V1'] = mkVoc('V1', '2');
      let mapping = mkMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'the vocabulary versions do not match'
      );
    }
  });
});

let nonCustomCodes = (codes0: Codes): Codes =>
  Object.fromEntries(
    Object.entries(codes0).map(([vocId, codes]) => [
      vocId,
      Object.fromEntries(
        Object.entries(codes).filter(([id, code]) => !code.custom)
      ),
    ])
  );

let nonCustomConcepts = (concepts0: Concepts, codes0: Codes): Concepts =>
  Object.fromEntries(
    Object.entries(concepts0).map(([cui, concept]) => {
      let codes1 = Object.fromEntries(
        Object.entries(concept.codes)
          .map(([vocId, ids]) => [
            vocId,
            new Set(
              Array.from(ids).filter((id) => codes0[vocId][id] !== undefined)
            ),
          ])
          .filter(([vocId, ids]) => ids)
      );
      return [cui, { ...concept, codes: codes1 }];
    })
  );

describe('remap mapping', () => {
  it('can be no-op', () => {
    let mapping = mkMapping();
    console.log(mapping.toData());
    let codes = nonCustomCodes(mapping.codes);
    let concepts = nonCustomConcepts(mapping.concepts, mapping.codes);
    let caches = mapping.caches();
    mapping.remap('2025AB', concepts, codes, mapping.vocabularies, caches);
    expect(mapping.toData()).toEqual(mapping.toData());
  });
  it('can keep removed codes as custom', () => {
    let mapping = mkMapping();
    console.log(mapping.toData());
    let codes = nonCustomCodes(mapping.codes);
    delete codes['V1']['x1'];
    let concepts = nonCustomConcepts(mapping.concepts, mapping.codes);
    concepts = Object.fromEntries(
      Object.entries(concepts).map(([cui, concept]) => {
        let codes = concept.codes;
        codes['V1'].delete('x1');
        return [cui, { ...concept, codes }];
      })
    );
    let caches = mapping.caches();
    mapping.remap('2025AB', concepts, codes, mapping.vocabularies, caches);
    expect(mapping.codes['V1']['x1'].custom).toBeTrue();
  });
});

describe('mappings get lost', () => {
  it('should detect lost portions', () => {
    let concepts: Concepts = {
      C1: mkConcept('C1', {
        V1: new Set(['x1', 'x2', 'x3']),
        V2: new Set(['y1', 'y2']),
      }),
      C2: mkConcept('C2', {
        V1: new Set(['x1']),
        V3: new Set(['z1']),
      }),
      C3: mkConcept('C3', {
        V1: new Set(['x2']),
      }),
    };
    let codes: Codes = {
      V1: {
        x1: mkCode('x1'),
        x2: mkCode('x2'),
        x3: mkCode('x3'),
      },
      V2: {
        y1: mkCode('y1'),
        y2: mkCode('y2'),
      },
      V3: {
        z1: mkCode('z1'),
      },
    };
    let mapping = new Mapping(EMPTY_DATA_META, null, {}, concepts, codes);
    let remapConcepts: Concepts = {
      C1: mkConcept('C1', {
        V1: new Set(['x1']),
        V2: new Set(['y1', 'y2']),
      }),
      C3: mkConcept('C3', {
        V1: new Set(['x2']),
      }),
    };
    let remapCodes: Codes = {
      V1: {
        x1: mkCode('x1'),
        x2: mkCode('x2'),
      },
      V2: {
        y1: mkCode('y1'),
        y2: mkCode('y2'),
      },
    };
    let lost = mapping.getLost(remapConcepts, remapCodes);
    let lostConcepts: Concepts = {
      C1: mkConcept('C1', {
        V1: new Set(['x2', 'x3']),
      }),
      C2: mkConcept('C2', {
        V1: new Set(['x1']),
        V3: new Set(['z1']),
      }),
    };
    let lostCodes: Codes = {
      V1: {
        x3: mkCode('x3', { custom: true }),
      },
      V3: {
        z1: mkCode('z1', { custom: true }),
      },
    };
    expect(lost.concepts).toEqual(lostConcepts);
    expect(lost.codes).toEqual(lostCodes);
    let mapping2 = new Mapping(
      EMPTY_DATA_META,
      null,
      {},
      remapConcepts,
      remapCodes
    );
    mapping2.setLost(lost);
    expect(mapping2.concepts).toEqual(mapping.concepts);
    expect(Object.keys(mapping2.codes)).toEqual(Object.keys(mapping.codes));
    for (let voc of Object.keys(mapping.codes)) {
      expect(Object.keys(mapping2.codes[voc])).toEqual(
        Object.keys(mapping.codes[voc])
      );
      for (let [id, code] of Object.entries(mapping2.codes[voc])) {
        expect(code.custom).toEqual(
          (voc == 'V1' && id == 'x3') || (voc == 'V3' && id == 'z1')
        );
      }
    }
  });
});
