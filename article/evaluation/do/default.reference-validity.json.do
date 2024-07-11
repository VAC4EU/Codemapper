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
import yaml, json
import numpy as np
import redo
from data import Databases, Mappings, CodesInDbs

all_databases = ['BIFAB', 'Medicare', 'IPCI', 'Lombardy', 'unknown', 'CPRD', 'Puglia', 'GePaRD', 'PHARMO']

def create(mappings, events, codes_in_dbs, databases):
    result = {}
    for database in all_databases:
        coding_system = databases.coding_system(database)
        all_codes = set()
        for event in events:
            mapping = mappings.get(event)
            if database in mapping.keys():
                codes = mapping.codes(database)
                if codes:
                    all_codes.update(codes)
        codes_in_db = codes_in_dbs.get(coding_system)
        filtered = { code for code in all_codes if codes_in_db.exists(code) }
        if all_codes:
            r = len(filtered) / len(all_codes)
        else:
            r = np.nan
        result["{} ({})".format(database, coding_system)] = r
            # 'codes': sorted(all_codes),
            # 'filtered': sorted(filtered),
    return result

if redo.running():
    project, = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        events = config['events']
    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))
    with redo.ifchange('codes-in-dbs.json') as f:
        codes_in_dbs = CodesInDbs.of_data(json.load(f))

    res = create(mappings, events, codes_in_dbs, databases)
    with redo.output() as f:
       json.dump(res, f)

