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
from collections import defaultdict, OrderedDict
import json, yaml
import redo
from pathlib import Path
from data import Databases, Mappings, Concepts


def is_concept_relevant(codes_by_coding_systems, mapping, databases):
    for database in databases.databases():
        coding_system = databases.coding_system(database)
        reference = mapping.codes(database)
        generated = codes_by_coding_systems.codes(coding_system)
        if reference is not None:
            generated = codes_by_coding_systems.codes(coding_system)
            if set(reference) & set(generated):
                return True
    return False


def get_pos_neg_codes(codes_by_coding_systems, mapping, databases):
    pos, neg = [], []
    for database in databases.databases():
        coding_system = databases.coding_system(database)
        reference = mapping.codes(database)
        generated = codes_by_coding_systems.codes(coding_system)
        if reference is not None:
            pos += generated & reference
            neg += generated - reference
    return pos, neg


def get_types_distr(concepts, mapping, semantic_types, databases):
    types_distr = defaultdict(lambda: OrderedDict([
        ('pos-concepts', []),
        ('neg-concepts', []),
        ('pos-codes', []),
        ('neg-codes', []),
    ]))
    for cui in concepts.cuis():
        codes_by_coding_systems = concepts.codes_by_coding_systems(cui)
        relevant = is_concept_relevant(codes_by_coding_systems, mapping, databases)
        pos_codes, neg_codes = get_pos_neg_codes(codes_by_coding_systems, mapping, databases)
        for st in concepts.types(cui):
            types_distr[st]['pos-concepts' if relevant else 'neg-concepts'].append(cui)
            types_distr[st]['pos-codes'] += pos_codes
            types_distr[st]['neg-codes'] += neg_codes
    return dict(types_distr)


if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        semantic_types = config['semantic-types']
        events = config['events']

    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))
        mapping = mappings.get(event)

    with redo.ifchange('{}.{}.concepts.json'.format(project, event)) as f:
        concepts = Concepts.of_data(json.load(f))

    types_distr = get_types_distr(concepts, mapping, semantic_types, databases)

    with redo.output() as f:
        json.dump(types_distr, f)
