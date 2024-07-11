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
import json
import redo
from normalize import get_normalizer

codes_in_dbs = {}

freq_names = {
    'ICD10': 'ICD10-AUH',
    'ICPC': 'ICPC-IPCI',
    'RCD2': 'READ-THIN',
}
for db in freq_names:
    with redo.ifchange("frequencies/{}.csv".format(freq_names[db])) as f:
        df = pd.read_csv(f)
        normalizer = get_normalizer(db)
        codes = df.astype(str).Code
        codes_in_dbs[db] = sorted(set(normalizer(codes)))

with redo.ifchange("frequencies/ICD9-ARS-ratios.csv") as f:
    df = pd.read_csv(f, sep='\t')
    codes = df.PAT.tolist()
    normalizer = get_normalizer('ICD9')
    codes_in_dbs['ICD9'] = sorted(set(normalizer(codes)))

try:
    with redo.output() as f:
        json.dump(codes_in_dbs, f)
except redo.NoRedoProcess:
    pass
