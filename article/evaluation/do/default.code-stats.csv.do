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
import pandas as pd
import yaml, json
import redo
from data import Databases, Mappings, Dnf, CodesInDbs

def make_code_stats(dnfs, mappings, databases):
    data = []
    for database, coding_system in databases:
        mapping_codes = mappings.all_codes(database)
        dnf_codes = {
            code
            for dnf in dnfs.values()
            for code in dnf.codes(coding_system) or set()
        }
        codes_in_db = codes_in_dbs.get(coding_system)
        for code in mapping_codes | dnf_codes:
            in_mapping = code in mapping_codes
            in_dnf = code in dnf_codes
            in_db = codes_in_db.exists(code)
            row = [database, code, in_mapping, in_dnf, in_db]
            data.append(row)
    columns = ["Database", "Code", "InMapping", "InDnf", "InDatabase"]
    return pd.DataFrame(data, columns=columns)

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
    with redo.ifchange({
            event: '{}.{}.dnf.json'.format(project, event)
            for event in events
    }) as files:
        dnfs = {}
        for event in events:
            dnfs[event] = Dnf.of_data(json.load(files[event]))

    df = make_code_stats(dnfs, mappings, databases)

    with redo.output() as f:
        df.to_csv(f, index=False)
