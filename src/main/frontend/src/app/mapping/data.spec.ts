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

import { TestBed } from '@angular/core/testing';

import { Mapping, Concept, Concepts, Code, Codes } from './data';

describe('mapping', () => {
  it('should detect lost', () => {
    let concepts : Concepts = {
      'C1': new Concept('C1', '', '', {
        'V1': new Set(['x1', 'x2', 'x3']),
        'V2': new Set(['y1', 'y2']),
      }, null),
      'C2': new Concept('C2', '', '', {
        'V1': new Set(['x1']),
        'V3': new Set(['z1']),
      }, null),
      'C3': new Concept('C3', '', '', {
        'V1': new Set(['x2']),
      }, null),
    };
    let codes : Codes = {
      'V1': {
        'x1': new Code('x1', '', false, true, null),
        'x2': new Code('x2', '', false, true, null),
        'x3': new Code('x3', '', false, true, null),
      },
      'V2': {
        'y1': new Code('y1', '', false, true, null),
        'y2': new Code('y2', '', false, true, null),
      },
      'V3': {
        'z1': new Code('z1', '', false, true, null),
      }
    };
    let mapping = new Mapping(null, {}, concepts, codes, null);
    let remapConcepts : Concepts = {
      'C1': new Concept('C1', '', '', {
        'V1': new Set(['x1']),
        'V2': new Set(['y1', 'y2']),
      }, null),
      'C3': new Concept('C3', '', '', {
        'V1': new Set(['x2']),
      }, null),
    };
    let remapCodes : Codes = {
      'V1': {
        'x1': new Code('x1', '', false, true, null),
        'x2': new Code('x2', '', false, true, null),
      },
      'V2': {
        'y1': new Code('y1', '', false, true, null),
        'y2': new Code('y2', '', false, true, null),
      },
    };
    let lost = mapping.getLost(remapConcepts, remapCodes);
    let lostConcepts : Concepts = {
      'C1': new Concept('C1', '', '', {
        'V1': new Set(['x2', 'x3']),
      }, null),
      'C2': new Concept('C2', '', '', {
        'V1': new Set(['x1']),
        'V3': new Set(['z1']),
      }, null),
    };
    let lostCodes : Codes = {
      'V1': {
        'x3': new Code('x3', '', true, true, null),
      },
      'V3': {
        'z1': new Code('z1', '', true, true, null),
      },
    };
    expect(lost.concepts).toEqual(lostConcepts);
    expect(lost.codes).toEqual(lostCodes);
    let mapping2 = new Mapping(null, {}, remapConcepts, remapCodes, null);
    mapping2.setLost(lost);
    expect(mapping2.concepts).toEqual(mapping.concepts);
    expect(Object.keys(mapping2.codes)).toEqual(Object.keys(mapping.codes));
    for (let voc of Object.keys(mapping.codes)) {
      expect(Object.keys(mapping2.codes[voc])).toEqual(Object.keys(mapping.codes[voc]));
      for (let [id, code] of Object.entries(mapping2.codes[voc])) {
        expect(code.custom).toEqual(
          (voc == 'V1' && id == 'x3') ||
          (voc == 'V3' && id == 'z1'));
      }
    }
  });
});
