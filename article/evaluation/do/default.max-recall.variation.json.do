# Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
# 
# This program shall be referenced as “Codemapper”.
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

#!/usr/bin/env python3
from collections import defaultdict
import os
import json
import yaml
import redo
import comap
from data import Databases, Variation, Mappings, Concepts, Dnf
import utils

logger = utils.get_logger(__name__)

def max_recall_cuis(cosynonyms, mapping, coding_systems, min_codes=None):

    """
    The CUIs such that their codes capture the mapping with minimal codes
    outside the mapping, i.e.

        ⋃_{v ∈ V_DB} \{
           argmin_{cui ∈ UMLS}
             | m_v ∩ codes(cui) |
        \}

    The implementation below selects the concepts only locally. This
    might be sub-optimal, but the optimal selection is NP-complete
    problem: finding the cheapest binding for a DNF formula over CUIS
    with the number of irrevant codes as costs for each CUI.

    >>> coding_systems = {'D1': 'V1', 'D2': 'V2'}
    >>> mapping = {
    ...    'D1': {1,2},
    ...    'D2': {3,4},
    ... }
    >>> cosynonyms = {
    ...    'A': {'V1': {1}, 'V2': {3}},
    ...    'B': {'V1': {2}},
    ...    'C': {'V2': {4, 6}},
    ...    'D': {'V2': {4, 6, 7}},
    ...    'E': {'V1': {1}, 'V2': {5}},
    ... }
    >>> max_recall_cuis_aux(cosynonyms, mapping, coding_systems) ==\
         { 'A', 'B', 'C' }
    True
    >>> max_recall_cuis_aux(cosynonyms, mapping, coding_systems, min_codes=2) ==\
         {'A'}
    True
    """

    cosynonyms = defaultdict(lambda: defaultdict(set), {
        key: defaultdict(set, {
            key1: set(value1)
            for key1, value1 in value.items()
        })
        for key, value in cosynonyms.items()
    })

    # Include only cuis that have more than `min_codes` in `mapping`
    if min_codes is not None:
        for cui in list(cosynonyms):
            num_tp = 0
            for database_id, codes in mapping.items():
                if codes is not None:
                    generated = cosynonyms[cui][coding_systems[database_id]]
                    num_tp += len(set(codes) & generated)
            if num_tp < min_codes:
                del cosynonyms[cui]

    cuis = set()
    for database, reference in mapping.items():
        coding_system = coding_systems[database]
        if reference is not None:
            for code in reference:
                # Find the `cui` that implicates `code` with the least
                # number of irrelevant codes.
                candidates = set()
                for cui in cosynonyms.keys():
                    if code in cosynonyms[cui][coding_system]:
                        num_fn = 0
                        for database0, reference0 in mapping.items():
                            if reference0 is not None:
                                coding_system0 = coding_systems[database0]
                                generated0 = cosynonyms[cui][coding_system0]
                                num_fn += len(generated0 - set(reference0))
                        candidates.add((cui, num_fn))
                candidates = sorted(candidates, key=lambda x: x[1])
                if candidates:
                    cuis.add(candidates[0][0])
    return cuis


if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        events = config['events']
    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))
        mapping = mappings.get(event)
    with redo.ifchange('{}.{}.dnf.json'.format(project, event)) as f:
        dnf = Dnf.of_data(json.load(f))

    cosynonyms = dnf.to_cosynonyms()
    coding_systems = {
        database: databases.coding_system(database)
        for database in databases.databases()
    }
    cuis = max_recall_cuis(cosynonyms.to_data(), mapping.to_data()['inclusion'], coding_systems)
    concepts_raw_data = comap.get_client().umls_concepts(cuis, databases.coding_systems())
    concepts = Concepts.of_raw_data_and_normalize(concepts_raw_data, databases.coding_systems())

    variation = Variation(concepts, mapping)

    with redo.output() as f:
        json.dump(variation.to_data(), f)


if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(report=True)
