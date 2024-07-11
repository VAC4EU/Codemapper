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

def get_child_concepts(concepts, databases):
    client = comap.ComapClient()
    hyponyms_by_cui = client.hyponyms(concepts.cuis(), databases.coding_systems())
    return hyponyms_by_cui


if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)

    with redo.ifchange('{}.{}.concepts.json'.format(project, event)) as f:
        concepts = Concepts.of_data(json.load(f))

    coding_systems = sorted(set(config['coding-systems'].values()))
    concepts = get_child_concepts(concepts, databases)

    with redo.output() as f:
        json.dump(concepts, f)
