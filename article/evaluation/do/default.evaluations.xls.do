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
from pathlib import Path
import pandas as pd
import json, yaml
import logging
import redo
from data import Databases

logger = logging.getLogger(__name__)

measures = ['recall'] # recall_in_umls,recall_without_exclusions,recall_without_exclusions_in_umlsprecision,precision_over_dnf

def average_and_format(df, variation_ids, events, databases):
    databases_with_coding_systems = {
        database: '{} ({})'.format(database, databases.coding_system(database))
        for database in databases.databases()
    }
    columns = pd.MultiIndex.from_tuples([('', 'variation'), ('', 'event'), ('Generated', 'cuis')] + [
        (databases_with_coding_systems[database], column)
        for database in databases.databases()
        for column in ['generated', 'reference', 'TP', 'FP', 'FN'] + measures
    ] + [('Average', m) for m in measures])

    def format_list(v):
        if v != v: # is nan
            return v
        else:
            assert type(v) == str
            li = json.loads(v)
            return len(li)

    result = pd.DataFrame(columns=columns)
    for variation in variation_ids:
        variation_data = []
        for event in events:
            cuis = df[(df['variation'] == variation) & (df['event'] == event)].iloc[0].cuis
            row = [variation, event, format_list(cuis)]
            measures_values = { m: [] for m in measures }
            for database in databases.databases():
                s = df[(df['variation'] == variation) & (df['event'] == event) & (df['database'] == database)].iloc[0]
                for m in measures:
                    measures_values[m].append(s[m])
                for col in ['generated', 'reference', 'tp', 'fp', 'fn']:
                    row.append(format_list(s[col]))
                row += [s[m] for m in measures]
            row += [pd.Series(measures_values[m]).mean() for m in measures]
            variation_data.append(row)
        for_variation = pd.DataFrame(data=variation_data, columns=columns)
        average_row = [variation, 'Average', '']
        for database in databases.databases():
            means = [for_variation[(databases_with_coding_systems[database], m)].mean() for m in measures]
            average_row += ['', '', '', '', ''] + means
        average_row += [
            for_variation[('Average', m)].mean()
            for m in measures
        ]
        for_variation.ix[len(for_variation)] = average_row
        # header_row = pd.DataFrame([[variation] + ([''] * (len(columns)-1))], columns=columns)
        # for_variation = pd.concat([header_row, for_variation])
        result = result.append(for_variation)
    return result.set_index([('', 'variation'), ('', 'event')])

if redo.running():

    project, = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        events = config['events']
        variation_ids = config['variations']

    with redo.ifchange('{}.evaluations.csv'.format(project)) as f:
        df = pd.read_csv(f)

    df = average_and_format(df, variation_ids, events, databases)

    df.to_excel(redo.temp) #float_format='%.2f'
