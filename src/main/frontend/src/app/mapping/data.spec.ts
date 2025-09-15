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
  Mapping,
  Concept,
  Concepts,
  Code,
  Codes,
  EMPTY_DATA_META,
  Vocabulary,
  MappingData,
  CodeId,
  VocabularyId,
} from './data';

function makeMapping(): Mapping {
  return new Mapping(
    { ...EMPTY_DATA_META, umlsVersion: '2025AA' },
    null,
    {
      V1: new Vocabulary('V1', '', '1', false),
      V2: new Vocabulary('V2', '', '1', false),
      W: new Vocabulary('W', '', '1', true),
    },
    {
      C1: new Concept('C1', '', '', {
        V1: new Set(['x0', 'x1']),
      }),
      C2: new Concept('C2', '', '', {
        V1: new Set(['x2', 'x3']),
        W: new Set(['w1']),
      }),
    },
    {
      V1: {
        x0: new Code('x0', '', false, true, null),
        x1: new Code('x1', '', false, true, null),
        x2: new Code('x2', '', false, true, 'broader'),
        x3: new Code('x3', '', false, false, null),
      },
      W: {
        w1: new Code('w1', '', true, true, null),
      },
    }
  );
}

function makeMappingData(): MappingData {
  return {
    meta: { ...EMPTY_DATA_META, umlsVersion: '2025AA' },
    vocabularies: {
      V1: new Vocabulary('V1', '', '1', false),
      W: new Vocabulary('W', '', '1', true),
    },
    concepts: {
      C1: new Concept('C1', '', '', {
        V1: new Set(['x1']),
      }),
      C2: new Concept('C2', '', '', {
        V1: new Set(['x2', 'x3']),
        W: new Set(['w2']),
      }),
    },
    codes: {
      V1: {
        x1: new Code('x1', '', false, true, 'narrower'),
        x2: new Code('x2', '', false, true, 'narrower'),
        x3: new Code('x3', '', false, true, null),
      },
      W: {
        w2: new Code('w2', '', true, true, null),
      },
    },
    umlsVersion: '',
  };
}

describe('adding mappings', () => {
  it('should work', () => {
    let mapping = makeMapping();
    mapping.addMapping(makeMappingData());
    expect(mapping.toObject()).toEqual(
      new Mapping(
        { ...EMPTY_DATA_META, umlsVersion: '2025AA' },
        null,
        {
          V1: new Vocabulary('V1', '', '1', false),
          V2: new Vocabulary('V2', '', '1', false),
          W: new Vocabulary('W', '', '1', true),
        },
        {
          C1: new Concept('C1', '', '', {
            V1: new Set(['x0', 'x1']),
          }),
          C2: new Concept('C2', '', '', {
            V1: new Set(['x2', 'x3']),
            W: new Set(['w1', 'w2']),
          }),
        },
        {
          V1: {
            x0: new Code('x0', '', false, true, null),
            x1: new Code('x1', '', false, true, 'narrower'),
            x2: new Code('x2', '', false, true, 'multiple:broader+narrower'),
            x3: new Code('x3', '', false, true, null),
          },
          W: {
            w1: new Code('w1', '', true, true, null),
            w2: new Code('w2', '', true, true, null),
          },
        }
      ).toObject()
    );
  });

  it('should fail on different UMLS version', () => {
    {
      let mappingData = makeMappingData();
      mappingData.meta.umlsVersion = '1999AA';
      let mapping = makeMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'the UMLS version does not match'
      );
    }
  });
  it('should fail on unknown vocabulary', () => {
    {
      let mappingData = makeMappingData();
      mappingData.vocabularies['V3'] = new Vocabulary('V3', '', '1', false);
      let mapping = makeMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'the vocabularies must already exist, but V3 does not'
      );
    }
  });

  it('should fail on different vocabulary version', () => {
    {
      let mappingData = makeMappingData();
      mappingData.vocabularies['V1'] = new Vocabulary('V1', '', '2', false);
      let mapping = makeMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'the vocabulary versions do not match'
      );
    }
  });

  it('should fail on unknown, non-custom code', () => {
    {
      let mappingData = makeMappingData();
      mappingData.codes['V1']['x4'] = new Code('x4', '', false, true);
      mappingData.concepts['C1'].codes['V1'].add('x4');
      let mapping = makeMapping();
      expect(() => mapping.addMapping(mappingData)).toThrowError(
        'code V1/x4 is not in the original mapping and not a custom code'
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
      return [
        cui,
        new Concept(concept.id, concept.name, concept.definition, codes1),
      ];
    })
  );

describe('remap mapping', () => {
  it('can be no-op', () => {
    let mapping = makeMapping();
    console.log(mapping.toObject());
    let codes = nonCustomCodes(mapping.codes);
    let concepts = nonCustomConcepts(mapping.concepts, mapping.codes);
    mapping.remap('2025AB', concepts, codes, mapping.vocabularies);
    expect(mapping.toObject()).toEqual(mapping.toObject());
  });
  it('can keep removed codes as custom', () => {
    let mapping = makeMapping();
    console.log(mapping.toObject());
    let codes = nonCustomCodes(mapping.codes);
    delete codes['V1']['x1'];
    let concepts = nonCustomConcepts(mapping.concepts, mapping.codes);
    concepts = Object.fromEntries(
      Object.entries(concepts)
      .map(([cui, concept]) => {
        let codes = concept.codes;
        codes['V1'].delete('x1')
        return [cui, new Concept(concept.id, concept.name, concept.definition, codes)];
      })
    );
    mapping.remap('2025AB', concepts, codes, mapping.vocabularies);
    expect(mapping.codes['V1']['x1'].custom).toBeTrue();
  });
});

describe('mappings get lost', () => {
  it('should detect lost portions', () => {
    let concepts: Concepts = {
      C1: new Concept('C1', '', '', {
        V1: new Set(['x1', 'x2', 'x3']),
        V2: new Set(['y1', 'y2']),
      }),
      C2: new Concept('C2', '', '', {
        V1: new Set(['x1']),
        V3: new Set(['z1']),
      }),
      C3: new Concept('C3', '', '', {
        V1: new Set(['x2']),
      }),
    };
    let codes: Codes = {
      V1: {
        x1: new Code('x1', '', false, true, null),
        x2: new Code('x2', '', false, true, null),
        x3: new Code('x3', '', false, true, null),
      },
      V2: {
        y1: new Code('y1', '', false, true, null),
        y2: new Code('y2', '', false, true, null),
      },
      V3: {
        z1: new Code('z1', '', false, true, null),
      },
    };
    let mapping = new Mapping(EMPTY_DATA_META, null, {}, concepts, codes);
    let remapConcepts: Concepts = {
      C1: new Concept('C1', '', '', {
        V1: new Set(['x1']),
        V2: new Set(['y1', 'y2']),
      }),
      C3: new Concept('C3', '', '', {
        V1: new Set(['x2']),
      }),
    };
    let remapCodes: Codes = {
      V1: {
        x1: new Code('x1', '', false, true, null),
        x2: new Code('x2', '', false, true, null),
      },
      V2: {
        y1: new Code('y1', '', false, true, null),
        y2: new Code('y2', '', false, true, null),
      },
    };
    let lost = mapping.getLost(remapConcepts, remapCodes);
    let lostConcepts: Concepts = {
      C1: new Concept('C1', '', '', {
        V1: new Set(['x2', 'x3']),
      }),
      C2: new Concept('C2', '', '', {
        V1: new Set(['x1']),
        V3: new Set(['z1']),
      }),
    };
    let lostCodes: Codes = {
      V1: {
        x3: new Code('x3', '', true, true, null),
      },
      V3: {
        z1: new Code('z1', '', true, true, null),
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
