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
from pathlib import Path
import pandas as pd
import json, yaml
import redo
from data import Databases, Mappings


def get_types_distr(types_distrs, st_name):
    res = defaultdict(lambda: { 'pos': 0, 'neg': 0 })
    for distr in types_distrs.values():
        for st in distr:
            res[st]['pos'] += len(distr[st]['pos-concepts'])
            res[st]['neg'] += len(distr[st]['neg-concepts'])
    return {
        st: OrderedDict([
            ('name', st_name.ix[st].Description),
            ('group', st_name.ix[st].Group),
            ('pos', res[st]['pos']),
            ('neg', res[st]['neg']),
        ])
        for st in res
    }


if redo.running():
    project, = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        semantic_types = config['semantic-types']
        events = config['events']

    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))

    with redo.ifchange({
            event: '{}.{}.types-distr.json'.format(project, event)
            for event in events
    }) as fs:
        types_distrs = {
            event: json.load(fs[event])
            for event in events
        }

    st_name = pd.read_csv('../../src/main/resources/semantic_types.csv', index_col=0)

    types_distr = get_types_distr(types_distrs, st_name)

    with redo.output() as f:
        json.dump(types_distr, f)
