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
import redo
import json
import pandas as pd
from data import Evaluations

def evaluations_to_df(evaluations):
    data = []
    def f(s):
        return json.dumps(sorted(s))
    for (variation_id, event, database), evaluation in evaluations.all():
        row = [
            variation_id,
            event,
            database,
        ]
        if evaluation is None:
            row += [None] * 8
        else:
            row += [
                f(v) for v in [
                    evaluation.cuis,
                    evaluation.generated,
                    evaluation.reference,
                    evaluation.tp,
                    evaluation.fp,
                    evaluation.fn,
                ]
            ] + [
                evaluation.recall,
                evaluation.precision,
            ]
        data.append(row)
    columns = [ 'variation', 'event', 'database', 'cuis',
                'generated', 'reference', 'tp', 'fp', 'fn',
                'recall', 'precision',
    ]
    return pd.DataFrame(data=data, columns=columns)


if redo.running():

    (project, ) = redo.snippets

    with redo.ifchange('{}.evaluations.json'.format(project)) as f:
        evaluations = Evaluations.of_data(json.load(f))

    df = evaluations_to_df(evaluations)
    df.to_csv(redo.temp, index=False)
