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
import yaml
import redo
from data import Databases, Variation, CodesInDbs
import utils

logger = utils.get_logger(__name__)

if redo.running():

    project, event = redo.snippets[:2]
    variation0_id = '.'.join(redo.snippets[2:])

    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        databases = Databases.of_config(yaml.load(f))
    with redo.ifchange('{}.{}.{}.variation.json'.format(project, event, variation0_id)) as f:
        variation0 = Variation.of_data(json.load(f))
    with redo.ifchange('codes-in-dbs.json') as f:
        codes_in_dbs = CodesInDbs.of_data(json.load(f))

    concepts = variation0.concepts.filter_codes_in_dbs(codes_in_dbs)
    mapping = variation0.mapping.filter_codes_in_dbs(codes_in_dbs, databases)
    variation = Variation(concepts, variation0.mapping)

    with redo.output() as f:
        json.dump(variation.to_data(), f)

