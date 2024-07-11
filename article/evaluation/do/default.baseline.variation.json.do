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
import json
import json, yaml
import redo
from data import Variation, Mappings, Concepts, Databases
import utils

logger = utils.get_logger(__name__)


def filter_fp_concepts(variation, databases):
    for cui in variation.concepts.cuis():
        codes_by_voc = variation.concepts.codes_by_coding_systems(cui)
        if not any(variation.mapping.codes(db) & codes_by_voc.codes(voc)
                   for db, voc in databases
                   if variation.mapping.codes(db)):
            variation.concepts.remove(cui)


if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        semantic_types = config['semantic-types']
        events = config['events']

    with redo.ifchange('{}.{}.concepts.json'.format(project, event)) as f:
        concepts = Concepts.of_data(json.load(f))

    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))
        mapping = mappings.get(event)

    variation = Variation(concepts.filter_by_semantic_types(semantic_types), mapping)

    # filter_fp_concepts(variation, databases)

    with redo.output() as f:
        json.dump(variation.to_data(), f)

