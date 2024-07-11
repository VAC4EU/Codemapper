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
import redo
import yaml, json
import comap
from comap import get_umls_db, translation_read_2to3, translation_read_3to2
from data import Databases, Mappings, Cosynonyms
from utils import get_logger


logger = get_logger(__name__)


def cosynonym_codes(codes, coding_system, target_coding_systems):

    """Return a mapping from all CUIS that include the given `codes` of a
    `coding_system` to all codes in `target_coding_systems`.

    >>> cosynonym_codes(['C67.0'], 'ICD10CM', ['ICD10CM', 'RCD']) == {
    ...     'C0496826': {
    ...         'ICD10CM': {'C67.0'},
    ...         'RCD': {'X78ZS', 'B490.'}
    ...     }
    ... }
    True
    >>> cosynonym_codes(['G61z.'], 'RCD2', ['RCD2', 'ICD9CM' ]) == {
    ...     'C2937358': {
    ...       'ICD9CM': {'431'},
    ...       'RCD2': {'G6...', 'G61..', 'G61z.'}
    ...     }
    ... }
    True
    """
    cuis = comap.get_client().cuis_for_codes(codes, coding_system)
    concepts = comap.get_client().umls_concepts(cuis, target_coding_systems)
    res = {}
    for concept in concepts:
        codes_by_coding_systems = defaultdict(set)
        for source_concept in concept['sourceConcepts']:
            sab = source_concept['codingSystem']
            code = source_concept['id']
            codes_by_coding_systems[sab].add(code)
        if codes_by_coding_systems:
            res[concept['cui']] = dict(codes_by_coding_systems)
    return res

def all_cosynonyms(mapping, databases):

    res = defaultdict(lambda: defaultdict(set))

    for database, coding_system in databases:
        codes = mapping.codes(database)
        if codes is not None:
            cosynonyms = cosynonym_codes(codes, coding_system, databases.coding_systems())
            for cui in cosynonyms:
                for coding_system, synonyms in cosynonyms[cui].items():
                    if synonyms:
                        res[cui][coding_system].update(synonyms)

    return Cosynonyms(res)


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

    cosynonyms = all_cosynonyms(mapping, databases)

    with redo.output() as f:
        json.dump(cosynonyms.to_data(), f)
