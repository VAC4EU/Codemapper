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
import numpy as np
import json, yaml
import redo
from data import Databases, Variation, Evaluation, Evaluations, Mappings, ErrorAnalysis
from utils import get_logger
import comap

logger = get_logger(__name__)

def evaluate(variations, databases, mappings):
    evaluations = Evaluations()
    for variation_id in variations:
        for event, variation in variations[variation_id].items():
            mapping = mappings.get(event)
            cuis = set(variation.concepts.cuis())
            for database in databases.databases():
                coding_system = databases.coding_system(database)
                generated = set(variation.concepts.codes(coding_system))
                reference = variation.mapping.codes(database)
                if reference is None:
                    evaluation = None
                else:
                    reference = set(reference)
                    tp = generated & reference
                    fp = generated - reference
                    fn = reference - generated
                    if generated:
                        precision = len(tp) / len(generated)
                    else:
                        precision = np.nan
                    if reference:
                        recall = len(tp) / len(reference)
                    else:
                        recall = np.nan
                    exclusion_codes = mapping.exclusion_codes(database)
                    max_recall_codes = variations['max-recall'][event].concepts.codes(coding_system)
                    evaluation = Evaluation(cuis, generated, reference, tp, fp, fn, recall, precision)
                evaluations.add(variation_id, event, database, evaluation)
    return evaluations


# def error_analysis(tp, fp, fn, coding_system, max_recall_codes, exclusion_codes):

#     generated = tp | fp
#     reference = tp | fn

#     # False negative codes that are not in UMLS
#     known_codes = comap.get_client().known_codes(fn, coding_system)
#     fn_not_in_umls = fn - known_codes

#     # False negative codes that are exclusion codes
#     fn_exclusions = fn & exclusion_codes

#     # False negative codes that are in UMLS and inclusion codes
#     fn_inclusions_in_umls = fn - exclusion_codes - fn_not_in_umls

#     # False positive codes that in the maximum recall
#     fp_in_dnf = fp & max_recall_codes

#     # The recall over codes that are in UMLS/RCD2
#     reference_in_umls = reference - fn_not_in_umls
#     if reference_in_umls:
#         recall_in_umls = len(tp) / len(reference_in_umls)
#     else:
#         recall_in_umls = float('nan')

#     # Recall over disregarding exclusion codes
#     reference_without_exclusions = reference - fn_exclusions
#     if reference_without_exclusions:
#         recall_without_exclusions = len(tp - exclusion_codes) / len(reference_without_exclusions)
#     else:
#         recall_without_exclusions = float('nan')

#     # Recall disregarding exclusion codes and only UMLS/RCD2
#     reference_inclusions_in_umls = reference - fn_not_in_umls - fn_exclusions
#     if reference_inclusions_in_umls:
#         recall_without_exclusions_in_umls = len(tp - exclusion_codes) / len(reference_inclusions_in_umls)
#     else:
#         recall_without_exclusions_in_umls = float('nan')

#     # Precision over DNF
#     if generated:
#         precision_over_dnf = len(generated & max_recall_codes) / len(generated)
#     else:
#         precision_over_dnf = float('nan')

#     return ErrorAnalysis(fp_in_dnf, fn_not_in_umls, fn_exclusions,
#                          fn_inclusions_in_umls,
#                          reference_inclusions_in_umls, recall_in_umls,
#                          recall_without_exclusions,
#                          recall_without_exclusions_in_umls,
#                          precision_over_dnf)

if redo.running():

    (project, ) = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        variation_ids = config['variations']
        events = config['events']

    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))

    variations = {}
    for variation_id in variation_ids:
        variations[variation_id] = {}
        for event in events:
            with redo.ifchange("{}.{}.{}.variation.json".format(project, event, variation_id)) as f:
                variation_data = json.load(f)
                variation = Variation.of_data(variation_data)
                variations[variation_id][event] = variation

    evaluations = evaluate(variations, databases, mappings)

    with redo.output() as f:
        json.dump(evaluations.to_data(), f)

