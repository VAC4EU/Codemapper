from collections import OrderedDict, defaultdict
import pandas as pd
from itertools import chain
import requests
import pickle
import sys
import re
import os
import yaml
import pymysql


def construct_OrderedDict(loader, node):
    loader.flatten_mapping(node)
    return OrderedDict(loader.construct_pairs(node))
yaml.loader.Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_OrderedDict)


def represent_OrderedDict(dumper, data):
    return dumper.represent_dict(list(data.items()))
yaml.add_representer(OrderedDict, represent_OrderedDict, yaml.dumper.Dumper)


COMAP_API_URL = 'http://localhost:8080/AdvanceCodeMapper/rest'
COMAP_COOKIES_FILE = '.comap-cookies'


def get_cookies():
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        url = COMAP_API_URL + '/authentification/user'
        r = requests.post(url, cookies=cookies)
        if not r.json():
            raise
        return cookies
    except:
        url = COMAP_API_URL + '/authentification/login'
        data = dict(username='b.becker', password='Codemapper2015')
        r = requests.post(url, data=data)
        with open(COMAP_COOKIES_FILE, 'wb') as f:
            pickle.dump(r.cookies, f)
        return r.cookies


def cui_of_id(id):
    return "C{:0>7s}".format(id)


def peregrine_index(text, peregrine_api_url):
    r = requests.get(peregrine_api_url + '/index', params=dict(text=text))
    return r.json()['spans']


class ComapClient(object):

    def __init__(self):
        self.cookies = get_cookies()

    def coding_systems(self):
        url = COMAP_API_URL + '/code-mapper/coding-systems'
        r = requests.get(url, cookies=self.cookies)
        return r.json()

    def umls_concepts(self, cuis, coding_systems):
        url = COMAP_API_URL + '/code-mapper/umls-concepts'
        data = {
            'cuis': cuis,
            'codingSystems': coding_systems
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve umls concepts")

    def hyponyms(self, cuis, coding_systems):
        url = COMAP_API_URL + '/code-mapper/related/hyponyms'
        data = {
            'cuis': cuis,
            'codingSystems': coding_systems
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve hyponyms")

    def related(self, cuis, relations, coding_systems):
        url = COMAP_API_URL + '/code-mapper/related'
        data = {
            'cuis': cuis,
            'relations': relations,
            'codingSystems': coding_systems,
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve related concepts")


db_access = dict(host='127.0.0.1', user='root', password='root')
umls_db = pymysql.connect(db='UMLS2014AB_CoMap', **db_access)
umls_ext_db = pymysql.connect(db='UMLS_ext_mappings', **db_access)


def translation_read_2to3(codes):
    """ { read2_code: { read3_code } } """
    translation = defaultdict(set)
    if codes:
        with umls_ext_db.cursor() as cursor:
            query = """
                select distinct V2_CONCEPTID, CTV3_CONCEPTID
                from RCD_V3_to_V2
                where V2_CONCEPTID in ({})
            """.format(', '.join(['%s'] * len(codes)))
            cursor.execute(query, tuple(codes))
            for row in cursor.fetchall():
                code2, code3 = row
                translation[code2].add(code3)
    return translation


def translation_read_3to2(codes):
    """ { read2_code: { read3_code } } """
    translation = defaultdict(set)
    if codes:
        with umls_ext_db.cursor() as cursor:
            query = """
                select distinct V2_CONCEPTID, CTV3_CONCEPTID from RCD_V3_to_V2
                where CTV3_CONCEPTID in ({})
                and V2_CONCEPTID NOT IN ('_DRUG', '_NONE')
            """.format(', '.join(['%s'] * len(codes)))
            cursor.execute(query, tuple(codes))
            for row in cursor.fetchall():
                code2, code3 = row
                translation[code3].add(code2)
    return translation


def measures(generated=None, reference=None, codes=None):

    """
    >>> generated = [1,2,3,4]
    >>> reference = [1,2,5,6,7,8]
    >>> expected = {
    ...   'recall': 1/3,
    ...   'precision': 0.5,
    ... }
    >>> f = lambda v: round(v, 2)
    >>> dict(measures(generated=generated, reference=reference)) == expected
    True
    >>> generated = set(generated)
    >>> reference = set(reference)
    >>> codes = {
    ...   'TP': generated & reference,
    ...   'FP': generated - reference,
    ...   'FN': reference - generated,
    ... }
    >>> dict(measures(codes=codes)) == expected
    True
    """

    if codes is None:
        assert generated is not None and reference is not None, \
            "Provide either argument `generated` and `reference` or `code`."
        generated, reference = set(generated), set(reference)
    else:
        assert generated is None and reference is None, \
            "Provide either argument `generated` and `reference` or `code`."
        generated, reference = from_confusion_matrix(codes)

    TP = generated & reference

    recall = len(TP) / len(reference) \
        if len(reference) else None
    precision = len(TP) / len(generated) \
        if len(generated) else None

    return OrderedDict([
        ('recall', recall),
        ('precision', precision),
    ])


def confusion_matrix(generated, reference):
    generated = set(generated)
    reference = set(reference)
    return OrderedDict([
        ('TP', generated & reference),
        ('FN', reference - generated),
        ('FP', generated - reference),
    ])


def from_confusion_matrix(cm):
    TP = set(cm['TP'])
    FP = set(cm['FP'])
    FN = set(cm['FN'])
    return TP | FP, TP | FN


class Hierarchy(object):

    def related(self, codes1, codes2):
        "Subset of from `codes1` that are related to codes from `codes2`."
        raise NotImplementedError()


class ParentsHierarchy(Hierarchy):

    def parents(self, code):
        raise NotImplementedError()

    def is_sibling(self, code1, code2):
        """
        >>> h = RegexHierarchy('LDD')
        >>> h.is_sibling("K85.1", "K85.2")
        True
        >>> h.is_sibling("K85.1", "K85")
        False
        >>> h.is_sibling("K85.1", "K85.1")
        True
        >>> h.is_sibling("K85.1", "J85.1")
        False
        """
        parent1 = self.parents(code1)
        parent2 = self.parents(code2)
        return bool(parent1 and parent2 and parent1 & parent2)


    def related_parents(self, codes1, codes2):
        """ Finds the codes in `codes1` that are parents of codes in
        `codes2`. Returns a dictionary from parent codes in `codes1` to
        lists of child codes in `codes2.

        >>> h = RegexHierarchy('LDD')
        >>> codes1 = ['K50', 'K50.1', 'K51', 'K52']
        >>> codes2 = ['K50.2', 'K50.3', 'K52.1', 'K51.1', 'K53', 'K53.1']
        >>> expected = {
        ...     frozenset({'K50'}): {'K50.2', 'K50.3'},
        ...     frozenset({'K51'}): {'K51.1'},
        ...     frozenset({'K52'}): {'K52.1'},
        ... }
        >>> h.related_parents(codes1, codes2) == expected
        True
        """
        res = defaultdict(set)
        for code2 in codes2:
            parents_of_code2 = self.parents(code2) & set(codes1)
            if parents_of_code2:
                res[parents_of_code2].add(code2)
        return res


    def related_siblings(self, codes1, codes2):

        """ Finds all pairs of siblings from `codes1` and `codes2` that are siblings.

        >>> h = RegexHierarchy('LDD')
        >>> codes1 = ['K50', 'K50.1', 'K50.2', 'K51.1']
        >>> codes2 = ['K51', 'K50.3', 'K50.4']
        >>> expected = {(frozenset({'K50.1', 'K50.2'}), frozenset({'K50.3', 'K50.4'}))}
        >>> h.related_siblings(codes1, codes2) == expected
        True
        >>> codes1 = ['K50', 'K50.1', 'K50.2', 'K51.1', 'K51.2']
        >>> codes2 = ['K49', 'K50.2', 'K51.3', 'K51.4']
        >>> expected = {(frozenset({'K50.1', 'K50.2'}), frozenset({'K50.2'})),
        ...             (frozenset({'K51.1', 'K51.2'}), frozenset({'K51.3', 'K51.4'}))}
        >>> h.related_siblings(codes1, codes2) == expected
        True
        >>> codes1 = ['K50.1', 'K50.2']
        >>> codes2 = ['K51.1', 'K51.2']
        >>> h.related_siblings(codes1, codes2) == set()
        True
        """
        def sibling_sets(codes):
            codes = set(codes)
            res = list()
            while codes:
                code = codes.pop()
                siblings = [
                    code0 for code0 in codes
                    if self.is_sibling(code0, code)
                ]
                for sibling in siblings:
                    codes.discard(sibling)
                res.append(set([code] + siblings))
            return res
        sibling_sets1 = sibling_sets(codes1)
        sibling_sets2 = sibling_sets(codes2)
        return set([
            (frozenset(siblings1), frozenset(siblings2))
            for siblings1 in sibling_sets1
            for siblings2 in sibling_sets2
            if any(self.is_sibling(code1, code2)
                   for code1 in siblings1
                   for code2 in siblings2)
        ])


    def related(self, codes1, codes2):

        """
        >>> h = RegexHierarchy('LDD')
        >>> codes1 = [ 'A01', 'A02.1', 'A02.2', 'A03.1', 'A13.2', 'A04', 'A06.1' ]
        >>> codes2 = [ 'A01.1', 'A01.2', 'A02', 'A03.3', 'A13.4', 'A05', 'A07.1' ]
        >>> expected = {
        ...   'parents': set(['A01']),
        ...   'children': set(['A02.1', 'A02.2']),
        ...   'siblings': set(['A03.1', 'A13.2']),
        ... }
        >>> h.related(codes1, codes2) == expected
        True
        """

        codes1_parents = self.related_parents(codes1, codes2)
        codes2_parents = self.related_parents(codes2, codes1)
        codes1_siblings = self.related_siblings(codes1, codes2)
        flatten = lambda css: set(c for cs in css for c in cs)
        return {
            label: codes
            for label, codes in {
                'parents': flatten(codes1_parents.keys()),
                'children': flatten(codes2_parents.values()),
                'siblings': flatten(cs for cs, _ in codes1_siblings),
            }.items()
            if codes
        }

class DataHierarchy(Hierarchy):

    """
    >>> data = {
    ...   'A01': {'up': {'A01.1', 'A01.2'}},
    ...   'A02': {'up': {'A02.1', 'A02.2'}},
    ...   'A03.1': {'sib': {'A03.2'}},
    ...   'A03.2': {'sib': {'A03.1'}},
    ... }
    >>> h = DataHierarchy(['up', 'sib'], data)
    >>> codes1 = {'A01', 'A02.1', 'A02.2', 'A03.1'}
    >>> codes2 = {'A01.1', 'A01.2', 'A02', 'A03.2'}
    >>> h.related(codes1, codes2) == {'up': {'A01'}, 'sib': {'A03.1'}}
    True
    >>> h.related(codes2, codes1) == {'up': {'A02'}, 'sib': {'A03.2'}}
    True
    """

    def __init__(self, relations, relation_data):
        self.relations = relations
        self.relation_data = relation_data

    def related_by(self, codes1, codes2, relation):
        """The subset of `codes1` that are in `relation` with codes from
        `codes2`."""
        return set(
            code1 for code1 in codes1 & set(self.relation_data.keys())
            if len(codes2 & self.relation_data[code1].get(relation, set()))
        )

    def related(self, codes1, codes2):
        return {
            relation: self.related_by(codes1, codes2, relation)
            for relation in self.relations
        }


class Read2Hierarchy(ParentsHierarchy):

    HEAD_DOTS_RE = re.compile(r'^(?P<head>[A-Z0-9][A-Za-z0-9]*)(?P<dots>\.*)$')

    def parents(self, code):
        """
        >>> h = Read2Hierarchy()
        >>> set(h.parents("J01234"))
        {'J0123.'}
        >>> set(h.parents("J012.."))
        {'J01...'}
        >>> set(h.parents("J....."))
        set()
        """
        m = self.HEAD_DOTS_RE.match(code)
        assert m, code
        head, dots = m.group('head'), m.group('dots')
        if len(head) > 1:
            return frozenset([head[:-1] + '.' + dots])
        else:
            return frozenset()


class RegexHierarchy(ParentsHierarchy):

    TYPES = {
        # Letter Digit Digit
        'LDD': re.compile(r'(?P<parent>[A-Za-z]\d{2})\.(\d)'),
        # Digit Digit Digit
        'DDD': re.compile(r'(?P<parent>\d{3})\.(\d)'),
    }


    def __init__(self, regex_type):
        self.hierarchical_code_re = self.TYPES[regex_type]

    def parents(self, code):
        """
        >>> h = RegexHierarchy('LDD')
        >>> set(h.parents("K85.9"))
        {'K85'}
        >>> set(h.parents("K85"))
        set()
        >>> h = RegexHierarchy('DDD')
        >>> set(h.parents("185.9"))
        {'185'}
        """
        m = re.match(self.hierarchical_code_re, code)
        if m:
            return frozenset([m.group('parent')])
        else:
            return frozenset()


def include_related(hierarchy, codes):

    """Simulate the appropriate expansion of the generated codes to the
    reference codes in the confusion matrix `codes`. The false
    negatives are added to the generated if a closely related code is
    among the generated."""

    generated, reference = from_confusion_matrix(codes)
    TP, FP, FN = [set(codes[key]) for key in ('TP', 'FP', 'FN')]

    FN_related_to_generated_by_rel = hierarchy.related(FN, generated)
    FN_related_to_generated = \
        set(c for cs in FN_related_to_generated_by_rel.values() for c in cs)

    generated_with_related = generated | FN_related_to_generated

    generated_related_to_FN_by_rel = hierarchy.related(generated, FN)
    generated_related_to_FN = \
        set(c for cs in generated_related_to_FN_by_rel.values() for c in cs)

    related_codes = confusion_matrix(generated_with_related, reference)

    derivated_codes = OrderedDict([
        ('FN-related-to-generated', FN_related_to_generated)
    ])

    return related_codes, derivated_codes


def include_related_bidirect(hierarchy, codes):

    """Simulate the appropriate expansion of the generated codes to the
    reference codes (cf. `include_related()`) AND add false positives
    that are closely related to the reference to the reference."""

    TP, FP, FN = [set(codes[key]) for key in ('TP', 'FP', 'FN')]
    generated, reference = from_confusion_matrix(codes)

    FP_related_to_reference_by_rel = hierarchy.related(FP, reference)
    FP_related_to_reference = \
        set(c for cs in FP_related_to_reference_by_rel.values() for c in cs)
    FP_unrelated = FP - FP_related_to_reference

    FN_related_to_generated_by_rel = hierarchy.related(FN, generated)
    FN_related_to_generated = \
        set(c for cs in FN_related_to_generated_by_rel.values() for c in cs)
    FN_unrelated = FN - FN_related_to_generated

    generated_with_related_FN = generated | FN_related_to_generated
    reference_with_related_FP = reference | FP_related_to_reference

    TP_with_related = generated_with_related_FN & reference_with_related_FP

    assert FP_unrelated == generated_with_related_FN - TP_with_related
    assert FN_unrelated == reference_with_related_FP - TP_with_related

    related_codes = OrderedDict([
        ('TP', TP_with_related),
        ('FP', FP_unrelated),
        ('FN', FN_unrelated),
    ])

    derivated_codes = OrderedDict([
        ('FP-related-to-reference', FP_related_to_reference_by_rel),
        ('FN-related-to-generated', FN_related_to_generated_by_rel),
    ])

    return related_codes, derivated_codes


def mega_map(data, path, f, inplace=False):
    """
    >>> f = lambda x: x + 100
    >>> mega_map([0,1,2], [1], f) == [0, 101, 2]
    True
    >>> mega_map({'a': 1, 'b': 2}, ['a'], f) == {'a': 101, 'b': 2}
    True
    >>> mega_map({1,2,3}, [None], f) == {101, 102, 103}
    True
    >>> mega_map([0, {'a': 1}, 2], [1, 'a'], f) == [0, {'a': 101}, 2]
    True
    """
    def aux(data, ix):
        if ix == len(path):
            return f(data)
        selector = path[ix]
        if isinstance(data, dict):
            if not inplace:
                data = data.copy()
            for key, value in data.items():
                if selector == None or selector == key:
                    data[key] = aux(value, ix+1)
        elif type(data) == list:
            if not inplace:
                data = data.copy()
            for data_ix, value in enumerate(data):
                if selector == None or selector == data_ix:
                    data[data_ix] = aux(value, ix+1)
        elif type(data) == set:
            assert selector == None, "Cannot restrict on set"
            data = set(aux(value, ix+1) for value in data)
        else:
            raise Exception("Don't know how to map {} on path {}"\
                            .format(type(data), path[:ix+1]))
        return data
    return aux(data, 0)
