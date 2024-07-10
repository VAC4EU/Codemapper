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
import json, yaml
import redo
from data import Databases, Evaluations, Mappings, Dnf, ErrorAnalysis, ErrorAnalyses
from utils import get_logger
import comap
from comap import cui_names, translation_read_2to3


logger = get_logger(__name__)


def create_error_analyses(events, databases, mappings, dnfs,
                          evaluations,
                          residuals_info):
    error_analyses_fn = defaultdict(dict)
    error_analyses_fp = defaultdict(dict)
    for event in events:
        mapping = mappings.get(event)
        for database in databases.databases():
            evaluation = evaluations[event][database]
            if evaluation:
                error_analysis_fn = create_error_analysis_fn(event,
                                                             database,
                                                             databases,
                                                             dnfs[event],
                                                             evaluation,
                                                             mapping.exclusion_codes(database),
                                                             residuals_info[database][event],
                                                             mapping)
                error_analysis_fp = create_error_analysis_fp(event,
                                                             database,
                                                             databases,
                                                             dnfs[event],
                                                             evaluation,
                                                             mapping)
            else:
                error_analysis_fn, error_analysis_fp = None, None
            error_analyses_fn[database][event] = error_analysis_fn
            error_analyses_fp[database][event] = error_analysis_fp
    return ErrorAnalyses(error_analyses_fn, error_analyses_fp)


def create_error_analysis_fp(event, database, databases, dnf, evaluation, mapping):
    coding_system = databases.coding_system(database)
    tp, fp, fn = evaluation.tp, evaluation.fp, evaluation.fn
    dnf_codes = dnf.codes(coding_system)

    def categorize(code):
        if code in dnf_codes:
            return 'in-dnf'
        else:
            return 'other-fp'

    code_categories, unassigned = dict(), set()
    for code in fp:
        category = categorize(code)
        if category:
            code_categories[code] = category
        else:
            unassigned.add(code)
    if unassigned:
        logger.warn("Unassigned codes for %s: %s", coding_system, ', '.join(unassigned))
    return ErrorAnalysis(code_categories, unassigned)


def database_specific(code, database, databases, dnf, mapping):
    """Checks if all cosynonyms of `code` are false positive for the
    mapping.
    """
    voc = databases.coding_system(database)
    return all(
        not (generated & reference)
        # All CUI sets that have `code`
        for cuis in dnf.cui_sets() if code in dnf.get(cuis).get(voc, set())
        # All *other* databases
        for database1 in databases.databases() if database1 != database
        for generated in [dnf.get(cuis).get(databases.coding_system(database1), set())]
        for reference in [mapping.codes(database1) or set()]
    )


def get_relateds(cuis, databases):
    # {cui: {rel: [sourceConcept]}}
    relateds0 = comap.get_client().related(cuis, ['RN', 'CHD', 'RB', 'PAR'], databases.coding_systems())
    # {cui: {cui}}
    return {
        cui: {sourceConcept['cui'] for sourceConcept in sourceConcepts}
        for cui in relateds0
        for sourceConcepts in relateds0[cui].values()
    }


def get_cuis(codes, coding_system, dnf):
    return {cui
            for cuis, for_cuis in dnf.disjunction().items()
            if codes & for_cuis.get(coding_system, set())
            for cui in cuis}


def create_error_analysis_fn(event, database, databases, dnf, evaluation,
                             exclusion_codes, residuals_info, mapping):
    coding_system = databases.coding_system(database)
    fn = evaluation.fn
    known_fn = comap.get_client().known_codes(fn, coding_system)
    fn_cuis = get_cuis(fn, coding_system, dnf)
    dnf_codes = dnf.codes(coding_system)
    relateds = get_relateds(fn_cuis, databases)

    def categorize_fn(code):
        # if code in residuals_info:
        #     return residuals_info[code]['category']
        if code not in dnf_codes:
            return 'not-in-dnf'
        if code not in known_fn:
            return 'not-in-umls'
        if not any(relateds.get(cui) for cui in dnf.cuis(code, coding_system)):
            return 'isolated'
        if any(evaluation.cuis & relateds.get(cui, set()) for cui in fn_cuis):
            return 'next-expansion'
        if exclusion_codes and code in exclusion_codes:
            return 'exclusion'
        if database_specific(code, database, databases, dnf, mapping):
            return 'database-specific'
        return None

    code_categories, unassigned = dict(), set()
    for code in fn:
        category = categorize_fn(code)
        if category:
            code_categories[code] = category
        else:
            unassigned.add(code)

    if unassigned:
        logger.warn("Unassigned codes for %s: %s", coding_system, ", ".join(unassigned))
        if coding_system == 'RCD2':
            t = translation_read_2to3(unassigned)
        names = cui_names(fn_cuis)
        def for_code(code):
            cuis = dnf.cuis(code, coding_system)
            res = OrderedDict([
                ('cuis', {
                    cui: OrderedDict([
                        ('name', names.get(cui, '?')),
                        ('relateds', ' '.join(relateds.get(cui, []))),
                    ])
                    for cui in cuis
                }),
            ])
            if coding_system == 'RCD2':
                res['RCD'] = list(t[code])
            return res
        unassigned = {
            code: for_code(code)
            for code in unassigned
        }

    return ErrorAnalysis(code_categories, unassigned)


if redo.running():
    project = redo.snippets[0]
    variation_id = '.'.join(redo.snippets[1:])
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        events = config['events']

    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))

    with redo.ifchange(project_path / 'residuals-info.yaml') as f:
        data = yaml.load(f)
        residuals_info = {
            database: {
                event: dict(data.get(database, {}).get(event, {}))
                for event in events
            }
            for database in databases.databases()
        }

    with redo.ifchange({
            event: '{}.{}.dnf.json'.format(project, event)
            for event in events
    }) as files:
        dnfs = {
            event: Dnf.of_data(json.load(files[event]))
            for event in events
        }

    with redo.ifchange('{}.evaluations.json'.format(project)) as f:
        evaluations = Evaluations.of_data(json.load(f))\
            .for_variation(variation_id, events, databases.databases())


    error_analyses = create_error_analyses(events, databases,
                                           mappings, dnfs,
                                           evaluations,
                                           residuals_info)

    with redo.output() as f:
        yaml.dump(error_analyses.to_data(), f, default_flow_style=False)
