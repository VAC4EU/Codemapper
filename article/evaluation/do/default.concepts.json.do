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
import json, yaml
from pathlib import Path
import comap
import redo
from data import Concepts, Databases
import utils


logger = utils.get_logger(__name__)


def get_concepts(index, databases):
    cuis = [s['cui'] for s in index['spans']]
    data = comap.get_client().umls_concepts(cuis, databases.coding_systems())
    concepts = Concepts.of_raw_data_and_normalize(data, databases.coding_systems())
    return concepts


if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)

    with redo.ifchange('{}.{}.index.json'.format(project, event)) as f:
        index = json.load(f)

    concepts = get_concepts(index, databases)

    with redo.output() as f:
        json.dump(concepts.to_data(), f)
