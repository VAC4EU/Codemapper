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

import { assignConceptsTags } from './operations';
import {
  Code,
  Concept,
  ConceptsCodes,
  Tag,
} from './mapping-data';

describe('assignConceptsTags', () => {
  // Helper functions to create test data
  function mkCode(
    id: string,
    options: {
      custom?: boolean;
      enabled?: boolean;
      tag?: Tag | null;
    } = {},
  ): Code {
    return {
      id,
      term: `Code ${id}`,
      custom: options.custom ?? false,
      enabled: options.enabled ?? true,
      tag: options.tag ?? null,
    };
  }

  function mkConcept(
    id: string,
    codes: { [key: string]: Set<string> },
  ): Concept {
    return {
      id,
      codes,
      name: `Concept ${id}`,
      definition: '',
    };
  }

  // Test: Assign tag to single selected concept
  it('should assign tag to codes of selected concept', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1', 'code2']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1'),
          code2: mkCode('code2'),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'broader',
        code2: 'broader',
      },
    });
    expect(result.conflicts).toEqual({});
  });

  // Test: Multiple selected concepts
  it('should assign tag to codes of multiple selected concepts', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1', 'code2']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code3']),
          V2: new Set(['code4']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1'),
          code2: mkCode('code2'),
          code3: mkCode('code3'),
        },
        V2: {
          code4: mkCode('code4'),
        },
      },
    };

    const result = assignConceptsTags(['C1', 'C2'], conceptsCodes, 'narrower');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'narrower',
        code2: 'narrower',
        code3: 'narrower',
      },
      V2: {
        code4: 'narrower',
      },
    });
    expect(result.conflicts).toEqual({});
  });

  // Test: Non-selected concepts not tagged
  it('should not assign tag to codes of non-selected concepts', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code2']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1'),
          code2: mkCode('code2'),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'broader',
      },
    });
    expect(result.conflicts).toEqual({});
  });

  // Test: Detect conflicts when same code is in multiple concepts with different tags
  it('should detect conflict when code is in selected and non-selected concept with different tag', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code1']), // Same code in both concepts
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: 'narrower' }), // Already has tag from C2
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'broader',
      },
    });
    expect(result.conflicts).toEqual({
      V1: {
        code1: 'narrower', // Conflict: code1 would get 'broader' from C1 but has 'narrower' in C2
      },
    });
  });

  // Test: No conflict when same code in multiple concepts but tags match
  it('should not report conflict when code in multiple concepts but existing tag matches new tag', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code1']), // Same code in both concepts
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: 'broader' }), // Same tag as what we're assigning
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'broader',
      },
    });
    expect(result.conflicts).toEqual({}); // No conflict because tags match
  });

  // Test: No conflict when code in multiple concepts with no existing tag
  it('should not report conflict when code in multiple concepts has no tag', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code1']), // Same code in both concepts
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: null }), // No existing tag
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'broader',
      },
    });
    expect(result.conflicts).toEqual({}); // No conflict because code has no existing tag
  });

  // Test: Assign null tag
  it('should assign null tag to selected concepts', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1', 'code2']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: 'broader' }),
          code2: mkCode('code2', { tag: 'narrower' }),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, null);

    expect(result.codeTags).toEqual({
      V1: {
        code1: null,
        code2: null,
      },
    });
    expect(result.conflicts).toEqual({});
  });

  // Test: Conflict with null tag assignment
  it('should detect conflict when assigning null tag to non-selected with existing tag', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code1']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: 'broader' }),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, null);

    expect(result.codeTags).toEqual({
      V1: {
        code1: null,
      },
    });
    expect(result.conflicts).toEqual({
      V1: {
        code1: 'broader',
      },
    });
  });

  // Test: Multiple vocabularies with conflicts
  it('should handle conflicts across multiple vocabularies', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
          V2: new Set(['code2']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code1']), // Same code1 in both C1 and C2
          V2: new Set(['code2']), // Same code2 in both C1 and C2
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: 'narrower' }),
        },
        V2: {
          code2: mkCode('code2', { tag: 'broader' }),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'equivalent');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'equivalent',
      },
      V2: {
        code2: 'equivalent',
      },
    });
    expect(result.conflicts).toEqual({
      V1: {
        code1: 'narrower',
      },
      V2: {
        code2: 'broader',
      },
    });
  });

  // Test: Empty selection
  it('should return no tags and no conflicts when no concepts are selected', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1'),
        },
      },
    };

    const result = assignConceptsTags([], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({});
    expect(result.conflicts).toEqual({});
  });

  // Test: Empty concepts
  it('should return empty result when no concepts exist', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {},
      codes: {},
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'broader');

    expect(result.codeTags).toEqual({});
    expect(result.conflicts).toEqual({});
  });

  // Test: Complex scenario with multiple selected and conflicts
  it('should handle complex scenario with multiple selections and conflicts', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['c1', 'c2']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['c2', 'c3']), // c2 shared with C1
          V2: new Set(['c4']),
        }),
        C3: mkConcept('C3', {
          V1: new Set(['c3']), // c3 shared with C2
          V2: new Set(['c4']), // c4 shared with C2
        }),
      },
      codes: {
        V1: {
          c1: mkCode('c1'),
          c2: mkCode('c2', { tag: 'narrower' }), // In both C1 and C2
          c3: mkCode('c3', { tag: 'narrower' }), // In both C2 and C3
        },
        V2: {
          c4: mkCode('c4', { tag: 'broader' }), // In both C2 and C3
        },
      },
    };

    const result = assignConceptsTags(
      ['C1', 'C2'],
      conceptsCodes,
      'equivalent',
    );

    expect(result.codeTags).toEqual({
      V1: {
        c1: 'equivalent',
        c2: 'equivalent',
        c3: 'equivalent',
      },
      V2: {
        c4: 'equivalent',
      },
    });
    expect(result.conflicts).toEqual({
      V1: {
        c3: 'narrower', // c3 would get 'equivalent' from C1/C2 but has 'narrower' in C3
      },
      V2: {
        c4: 'broader', // c4 would get 'equivalent' from C1/C2 but has 'broader' in C3
      },
    });
  });

  // Test: Single concept with multiple codes in one vocabulary
  it('should assign tag to all codes of selected concept in single vocabulary', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1', 'code2', 'code3', 'code4']),
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1'),
          code2: mkCode('code2'),
          code3: mkCode('code3'),
          code4: mkCode('code4'),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'related');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'related',
        code2: 'related',
        code3: 'related',
        code4: 'related',
      },
    });
    expect(result.conflicts).toEqual({});
  });

  // Test: Concept with codes in multiple vocabularies, all selected
  it('should assign tag to codes across all vocabularies when selected', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['a']),
          V2: new Set(['b']),
          V3: new Set(['c']),
        }),
      },
      codes: {
        V1: {
          a: mkCode('a'),
        },
        V2: {
          b: mkCode('b'),
        },
        V3: {
          c: mkCode('c'),
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'test');

    expect(result.codeTags).toEqual({
      V1: { a: 'test' },
      V2: { b: 'test' },
      V3: { c: 'test' },
    });
    expect(result.conflicts).toEqual({});
  });

  // Test: Verify only actual conflicts are reported
  it('should only report conflicts for codes shared between selected and non-selected concepts', () => {
    const conceptsCodes: ConceptsCodes = {
      concepts: {
        C1: mkConcept('C1', {
          V1: new Set(['code1', 'code2']),
        }),
        C2: mkConcept('C2', {
          V1: new Set(['code1']), // code1 is shared with C1
        }),
        C3: mkConcept('C3', {
          V1: new Set(['code3']), // code3 is NOT in any selected concept
        }),
      },
      codes: {
        V1: {
          code1: mkCode('code1', { tag: 'narrower' }), // Conflict: in both C1 (selected) and C2 (not selected)
          code2: mkCode('code2', { tag: 'broader' }), // No conflict: only in C1 (selected)
          code3: mkCode('code3', { tag: 'broader' }), // No conflict: not in any selected concept
        },
      },
    };

    const result = assignConceptsTags(['C1'], conceptsCodes, 'exclude');

    expect(result.codeTags).toEqual({
      V1: {
        code1: 'exclude',
        code2: 'exclude',
      },
    });
    expect(result.conflicts).toEqual({
      V1: {
        code1: 'narrower', // Only code1 is a conflict
      },
      // C3 is not in conflicts because code3 is not in any selected concept
    });
  });
});
