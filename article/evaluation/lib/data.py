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

from collections import defaultdict, OrderedDict
import pandas as pd
from normalize import get_normalizer

class Concepts:

    def __init__(self, by_cuis=None):
        self._by_cuis = by_cuis or {}

    def to_data(self):
        return {
            cui: {
                'codes': self._by_cuis[cui]['codes'].to_data(),
                'types': list(self._by_cuis[cui]['types']),
            }
            for cui in self._by_cuis
        }

    @classmethod
    def of_data(cls, data):
        return Concepts({
            cui: {
                'codes': CodesByCodingSystems.of_data(data[cui]['codes']),
                'types': set(data[cui]['types']),
            }
            for cui in data
        })

    @classmethod
    def of_raw_data_and_normalize(cls, data, coding_systems):
        return Concepts({
            concept['cui']: {
                'codes': CodesByCodingSystems.of_raw_data(concept['sourceConcepts']),
                'types': set(concept['semanticTypes']),
            }
            for concept in data
        }).normalize(coding_systems)

    def filter_codes_in_dbs(self, codes_in_dbs):
        return Concepts({
            cui: {
                'codes': datum['codes'].filter_codes_in_dbs(codes_in_dbs),
                'types': datum['types'],
            } for cui, datum in self._by_cuis.items()
        })

    def filter_by_semantic_types(self, semantic_types):
        semantic_types = set(semantic_types)
        return Concepts({
            cui: datum
            for cui, datum in self._by_cuis.items()
            if semantic_types & datum['types']
        })

    def add(self, cui, codes, types):
        assert cui not in self._by_cuis
        self._by_cuis[cui] = {
            'codes': codes,
            'types': types,
        }

    def cuis(self):
        return list(self._by_cuis.keys())

    def codes_by_coding_systems(self, cui): # def cui (was only in_selected_sts)
        """ Returns a CodesByCodingSystems """
        return self._by_cuis[cui]['codes']

    def codes(self, coding_system):
        codes = set()
        for cui in self._by_cuis:
            codes.update(self._by_cuis[cui]['codes'].codes(coding_system))
        return codes

    def types(self, cui):
        return self._by_cuis[cui]['types']

    def normalize(self, coding_systems):
        result = Concepts()
        for cui in self.cuis():
            datum = self._by_cuis[cui]
            codes_by_coding_system = CodesByCodingSystems()
            for coding_system in coding_systems:
                normalizer = get_normalizer(coding_system)
                codes = set(normalizer(datum['codes'].codes(coding_system)))
                codes_by_coding_system.add(coding_system, codes)
            result.add(cui, codes_by_coding_system, datum['types'])
        return result


class CodesByCodingSystems:

    def __init__(self, by_coding_systems=None):
        self._by_coding_systems = by_coding_systems or {}

    @classmethod
    def of_data(cls, data):
        return CodesByCodingSystems({
            coding_system: set(data[coding_system])
            for coding_system in data
        })

    def to_data(self):
        return {
            coding_system: list(self._by_coding_systems[coding_system])
            for coding_system in self._by_coding_systems
        }

    @classmethod
    def of_raw_data(cls, source_concepts):
        by_coding_systems = {}
        for source_concept in source_concepts:
            coding_system = source_concept['codingSystem']
            if coding_system not in by_coding_systems:
                by_coding_systems[coding_system] = set()
            by_coding_systems[coding_system].add(source_concept['id'])
        return CodesByCodingSystems(by_coding_systems)

    def filter_codes_in_dbs(self, codes_in_dbs):
        def aux(voc, codes):
            codes_in_db = codes_in_dbs.get(voc)
            return {
                code for code in codes
                if codes_in_db.exists(code)
            }
        return CodesByCodingSystems({
            voc: aux(voc, self._by_coding_systems[voc])
            for voc in self._by_coding_systems
        })

    def add(self, coding_system, codes):
        assert coding_system not in self._by_coding_systems
        self._by_coding_systems[coding_system] = codes

    def codes(self, coding_system):
        """ Returns codes """
        return self._by_coding_systems.get(coding_system, set())

    def __iter__(self):
        return iter(self._by_coding_systems.keys())


class Mappings:

    def __init__(self, by_events=None):
        self._by_events = by_events or {}

    @classmethod
    def of_raw_data(cls, data, events, databases):
        return Mappings({
            event: Mapping.of_raw_data(data['by-event'][event], databases)
            for event in events
        })

    @classmethod
    def of_data(cls, data):
        return Mappings({
            e: Mapping.of_data(data[e])
            for e in data
        })

    def to_data(self):
        return {
            e: Mapping.to_data(self._by_events[e])
            for e in self._by_events
        }

    def describe(self, exclusions=False, with_exclusions=False):
        return pd.DataFrame({
            event: self._by_events[event].describe(exclusions, with_exclusions)
            for event in self._by_events.keys()
        })

    def add(self, event, mapping):
        assert event not in self._by_events
        self._by_events[event] = mapping

    def events(self):
        return self._by_events.keys()

    def get(self, event):
        return self._by_events[event]

    def all_codes(self, database):
        codes = set()
        for event in self._by_events:
            codes.update(self.get(event).codes(database) or [])
        return codes


class Mapping:

    def __init__(self, mapping=None, exclusion_mapping=None):
        self._mapping = mapping or {}
        self._exclusion_mapping = exclusion_mapping or {}

    @classmethod
    def of_data(cls, data):
        return Mapping({
            key: set(codes) if codes else None
            for key, codes in data['inclusion'].items()
        }, {
            key: set(codes) if codes else None
            for key, codes in data['exclusion'].items()
        })

    def to_data(self):
        return {
            'inclusion': {
                key: list(codes) if codes else None
                for key, codes in self._mapping.items()
            },
            'exclusion': {
                key: list(codes) if codes else None
                for key, codes in self._exclusion_mapping.items()
            }
        }

    def describe(self, exclusions=False, with_exclusions=False):
        res_m = pd.Series({
            key: None if codes is None else len(codes)
            for key, codes in self._mapping.items()
        })
        res_e = pd.Series({
            key: None if codes is None else len(codes)
            for key, codes in self._exclusion_mapping.items()
        })
        if exclusions:
            return res_e
        elif with_exclusions:
            return res_m + res_e
        else:
            return res_m

    @classmethod
    def of_raw_data(cls, for_event, databases):
        def codes(for_database):
            if 'inclusion' in for_database:
                return set(for_database['inclusion'])
            else:
                return None
        def exclusion_codes(for_database):
            if 'inclusion' in for_database:
                if 'exclusion' in for_database:
                    return set(for_database['exclusion'])
                else:
                    return set()
            else:
                return None
        return Mapping({
            database: codes(for_event['by-database'][database])
            for database in databases.databases()
        }, {
            database: exclusion_codes(for_event['by-database'][database])
            for database in databases.databases()
        })

    def filter_codes_in_dbs(self, codes_in_dbs, databases=None):
        def aux(key, codes):
            if databases is None:
                coding_system = key
            else:
                coding_system = databases.coding_system(key)
            available = codes_in_dbs.get(coding_system)
            return {
                code for code in codes
                if code in available
            }
        return Mapping({
            key: None if codes is None else aux(key, codes)
            for key, codes in self._mapping.items()
        })

    def add(self, key, codes):
        assert key not in self._mapping
        self._mapping[key] = codes

    def add_exclusion(self, key, exclusion_codes):
        assert key not in self._exclusion_mapping
        self._exclusion_mapping[key] = exclusion_codes

    def codes(self, key):
        return self._mapping[key]

    def exclusion_codes(self, key):
        return self._exclusion_mapping[key]

    def keys(self):
        return list(self._mapping.keys())


class Evaluations:

    def __init__(self, evaluations=None):
        self._evaluations = evaluations or defaultdict(lambda: defaultdict(dict))

    @classmethod
    def of_data(cls, data):
        return Evaluations({
            variation_id: {
                event: {
                    database: None if evaluation_data is None else Evaluation.of_data(evaluation_data)
                    for database, evaluation_data in data[variation_id][event].items()
                }
                for event in data[variation_id]
            }
            for variation_id in data
        })

    def to_data(self):
        return {
            variation_id: {
                event: {
                    database: None if evaluation is None else evaluation.to_data()
                    for database, evaluation in self._evaluations[variation_id][event].items()
                }
                for event in self._evaluations[variation_id]
            }
            for variation_id in self._evaluations
        }


    def add(self, variation_id, event, database, evaluation):
        assert database not in self._evaluations[variation_id][event]
        self._evaluations[variation_id][event][database] = evaluation

    def all(self):
        for variation_id in self._evaluations:
            for event in self._evaluations[variation_id]:
                for database, evaluation in self._evaluations[variation_id][event].items():
                    yield (variation_id, event, database), evaluation

    def get(self, variation_id, event, database):
        return self._evaluations[variation_id][event][database]

    def for_variation(self, variation_id, events, databases):
        return {
            event: {
                database: self.get(variation_id, event, database)
                for database in databases
            }
            for event in events
        }


class Evaluation:

    def __init__(self, cuis, generated, reference, tp, fp, fn, recall, precision):
        for v in [cuis, generated, reference, tp, fp, fn]:
            assert type(v) == set, (type(v), v)
        self.cuis = cuis
        self.generated = generated
        self.reference = reference
        self.tp = tp
        self.fp = fp
        self.fn = fn
        self.recall = recall
        self.precision = precision

    @classmethod
    def of_data(cls, data):
        def for_value(key, value):
            if type(value) == list:
                return set(value)
            return value
        return Evaluation(**{
            key: for_value(key, value)
            for key, value in data.items()
        })

    def to_data(self):
        return OrderedDict([
            ('cuis', list(self.cuis)),
            ('generated', list(self.generated)),
            ('reference', list(self.reference)),
            ('tp', list(self.tp)),
            ('fp', list(self.fp)),
            ('fn', list(self.fn)),
            ('recall', self.recall),
            ('precision', self.precision),
        ])

class Variation:

    def __init__(self, concepts, mapping):
        self.concepts = concepts
        self.mapping = mapping

    @classmethod
    def of_data(cls, data):
        concepts = Concepts.of_data(data['concepts'])
        mapping = Mapping.of_data(data['mapping'])
        return Variation(concepts, mapping)

    def to_data(self):
        return {
            'concepts': self.concepts.to_data(),
            'mapping': self.mapping.to_data(),
        }


class Databases:

    def __init__(self, databases, coding_systems):
        self._databases = databases
        self._coding_systems = coding_systems

    @classmethod
    def of_config(cls, config):
        return Databases(config['databases'], config['coding-systems'])

    def databases(self):
        return self._databases

    def __iter__(self):
        for database in self._databases:
            yield database, self.coding_system(database)

    def coding_system(self, database):
        return self._coding_systems[database]

    def coding_systems(self):
        return sorted({
            self._coding_systems[database]
            for database in self._databases
        })


class CodesInDbs:

    def __init__(self, by_coding_systems):
        self._by_coding_systems = by_coding_systems

    @classmethod
    def of_data(cls, data):
        return CodesInDbs({
            coding_system: CodesInDb.of_data(codes)
            for coding_system, codes in data.items()
        })

    def get(self, coding_system):
        for coding_system0 in self._by_coding_systems:
            if coding_system.startswith(coding_system0):
                return self._by_coding_systems[coding_system0]

    def codes(self, coding_system):
        return self._by_coding_systems[coding_system].codes()

class CodesInDb:

    def __init__(self, codes):
        self._codes = codes

    @classmethod
    def of_data(cls, data):
        return CodesInDb(set(data))

    def exists(self, code):
        return code in self._codes

    def filter(self, codes):
        return { code for code in codes if self.exists(code) }

    def codes(self):
        return self._codes


class Cosynonyms:

    def __init__(self, cosynonyms):
        self._cosynonyms = cosynonyms

    @classmethod
    def of_data(self, data):
        return Cosynonyms({
            cui: {
                voc: set(codes)
                for voc, codes in data[cui].items()
            }
            for cui in data
        })

    def to_data(self):
        return {
            cui: {
                voc: list(codes)
                for voc, codes in self._cosynonyms[cui].items()
            }
            for cui in self._cosynonyms
        }

    def to_dnf(self):
        tmp = defaultdict(lambda: defaultdict(set))
        for cui in self._cosynonyms:
            for voc, codes in self._cosynonyms[cui].items():
                for code in codes:
                    tmp[voc][code].add(cui)

        res = defaultdict(lambda: defaultdict(set))
        for voc in tmp:
            for code, cuis in tmp[voc].items():
                res[frozenset(cuis)][voc].add(code)

        return Dnf(res)

    def contains_code(self, code, coding_system):
        """ Test if any CUI contains `code` in the given `coding_system`. """
        for cui in self._cosynonyms:
            if code in self._cosynonyms[cui].get(coding_system, []):
                return True
        return False

    def equals(self, other):
        return self._cosynonyms == other._cosynonyms


class Dnf:

    def __init__(self, disjunction=None):
        self._disjunction = disjunction or {}

    def to_data(self):
        return [
            (tuple(cuis), {
                coding_system: list(codes)
                for coding_system, codes in self._disjunction[cuis].items()
            })
            for cuis in self._disjunction
        ]

    @classmethod
    def of_data(cls, data):
        return Dnf({
            frozenset(cuis): {
                coding_system: set(codes)
                for coding_system, codes in by_coding_systems.items()
            }
            for cuis, by_coding_systems in data
        })

    def add(self, cuis, coding_system, code):
        cuis = frozenset(cuis)
        if cuis not in self._disjunction:
            self._disjunction[cuis] = {}
        if coding_system not in self._disjunction[cuis]:
            self._disjunction[cuis][coding_system] = set()
        self._disjunction[cuis][coding_system].add(code)

    def disjunction(self):
        return {
            cuis: { voc: codes for voc, codes in self._disjunction[cuis].items() }
            for cuis in self._disjunction
        }

    def cui_sets(self):
        return list(self._disjunction.keys())

    def get(self, cuis):
        return self._disjunction[cuis]

    def codes(self, coding_system):
        res = set()
        for code_sets in self._disjunction.values():
            res.update(code_sets.get(coding_system) or [])
        return res

    def to_cosynonyms(self):
        # {cui: {voc: {code}}}
        res = defaultdict(lambda: defaultdict(set))
        for cuis in self._disjunction:
            for voc, codes in self._disjunction[cuis].items():
                for cui in cuis:
                    res[cui][voc].update(codes)
        return Cosynonyms(res)

    def cuis(self, code, coding_system):
        res = set()
        for cuis, codes in self._disjunction.items():
            if code in codes.get(coding_system, set()):
                res.update(cuis)
        return res

    def cui_sets_for_code(self, code, coding_system):
        return {
            cuis for cuis in self._disjunction
            if code in self._disjunction[cuis].get(coding_system, [])
        }

# class ErrorAnalysis:

#     keys = 'fp_in_dnf,fn_not_in_umls,fn_exclusions,fn_inclusions_in_umls,reference_inclusions_in_umls,'\
#            'recall_in_umls,recall_without_exclusions,recall_without_exclusions_in_umls,'\
#            'precision_over_dnf'.split(',')

#     def __init__(self, fp_in_dnf, fn_not_in_umls, fn_exclusions, fn_inclusions_in_umls, reference_inclusions_in_umls,
#                  recall_in_umls, recall_without_exclusions, recall_without_exclusions_in_umls,
#                  precision_over_dnf):
#         self.fp_in_dnf = fp_in_dnf
#         self.fn_not_in_umls = fn_not_in_umls
#         self.fn_exclusions = fn_exclusions
#         self.fn_inclusions_in_umls = fn_inclusions_in_umls
#         self.reference_inclusions_in_umls = reference_inclusions_in_umls
#         self.recall_in_umls = recall_in_umls
#         self.recall_without_exclusions = recall_without_exclusions
#         self.recall_without_exclusions_in_umls = recall_without_exclusions_in_umls
#         self.precision_over_dnf = precision_over_dnf

#     @classmethod
#     def of_data(cls, data):
#         def for_value(key, value):
#             if type(value) == list:
#                 return set(value)
#             if type(value) == float:
#                 return value
#         return ErrorAnalysis(**{
#             key: for_value(key, value)
#             for key, value in data.items()
#         })

#     def to_data(self):
#         def for_value(key, value):
#             if type(value) == set:
#                 return list(value)
#             if type(value) == float:
#                 return value
#         return OrderedDict([
#             (key, for_value(key, self.__dict__[key]))
#             for key in ErrorAnalysis.keys
#         ])


class ErrorAnalyses:

    def __init__(self, error_analyses_fn, error_analyses_fp):
        self.fn = error_analyses_fn
        self.fp = error_analyses_fp

    def to_data(self):
        return {
            'fn': {
                database: {
                    event: None if ea is None else ea.to_data()
                    for event, ea in for_database.items()
                }
                for database, for_database in self.fn.items()
            },
            'fp': {
                database: {
                    event: None if ea is None else ea.to_data()
                    for event, ea in for_database.items()
                }
                for database, for_database in self.fp.items()
            },
        }

    @classmethod
    def of_data(self, data):
        return ErrorAnalysis({
            database: {
                event: None if ea is None else ErrorAnalysis.of_data(ea)
                for event, ea in for_database.items()
            }
            for database, for_database in data['fn'].items()
        }, {
            database: {
                event: None if ea is None else ErrorAnalysis.of_data(ea)
                for event, ea in for_database.items()
            }
            for database, for_database in data['fp'].items()
        })


class ErrorAnalysis:

    def __init__(self, code_categories, unassigned):
        self.code_categories = code_categories
        self.unassigned = unassigned

    def to_data(self):
        res = OrderedDict([
            ('code-categories', self.code_categories),
        ])
        if self.unassigned:
            res['unassigned'] = self.unassigned
        return res

    @classmethod
    def of_data(cls, data):
        return ErrorAnalysis(data['code-categories'],
                             data.get('unassigned', {}))


