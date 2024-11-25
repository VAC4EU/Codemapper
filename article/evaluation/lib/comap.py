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

from collections import defaultdict
import re
import requests
import pickle
import pymysql
import utils

import http.client
http.client.HTTPConnection.debuglevel = 0

logger = utils.get_logger(__name__)
logger.setLevel('WARN')

PEREGRINE_API_URL = 'http://localhost:8081/rest' # 'https://euadr.erasmusmc.nl/UMLS2014AB_ADVANCE/rest'
COMAP_API_URL = 'http://localhost:8080/CodeMapper/rest' # https://euadr.erasmusmc.nl/CodeMapper/rest
UMLS_DB_ACCESS = dict(db='umls', host='127.0.0.1', user='umls', password='umls', port=3308)
UMLS_EXT_DB_ACCESS = dict(db='umls_ext', host='127.0.0.1', user='umls', password='umls', port=3308)

COMAP_COOKIES_FILE = '.comap-cookies'

def get_cookies():
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        url = COMAP_API_URL + '/authentification/user'
        r = requests.get(url, cookies=cookies)
        if not r.ok or r.status_code != 200:
            cookies = login()
    except IOError:
        cookies = login()
    return cookies


def login():
    logger.debug("Login")
    url = COMAP_API_URL + '/authentification/login'
    data = dict(username='b.becker', password='cm')
    r = requests.post(url, data=data)
    with open(COMAP_COOKIES_FILE, 'wb') as f:
        pickle.dump(r.cookies, f)
    return r.cookies


def cui_of_id(id):
    return "C{:0>7s}".format(id)


def peregrine_index(text):
    logger.info('Indexing...')
    text = re.sub(r'\s', ' ', text)
    r = requests.get(PEREGRINE_API_URL + '/index', params=dict(text=text))
    return r.json()['spans']


class ComapClient(object):

    def __init__(self):
        self.cookies = get_cookies()

    def coding_systems(self):
        logger.info('Get coding systems...')
        url = COMAP_API_URL + '/code-mapper/coding-systems'
        r = requests.get(url, cookies=self.cookies)
        return r.json()

    def umls_concepts(self, cuis, coding_systems):
        logger.info('Get UMLS concepts for %d CUIs and %d coding systems', len(cuis), len(coding_systems))
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

    def cuis_for_codes(self, codes, coding_system):
        logger.info('Get CUIs for codes (%d)', len(codes))
        url = COMAP_API_URL + '/code-mapper/cuis-for-codes'
        data = {
            'codes': codes,
            'codingSystem': coding_system,
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve CUIs for codes")

    def known_codes(self, codes, coding_system):
        logger.info('Get known codes (%d)', len(codes))
        url = COMAP_API_URL + '/code-mapper/known-codes'
        data = {
            'codes': codes,
            'codingSystem': coding_system,
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve known codes")

    def hyponyms(self, cuis, coding_systems):
        logger.info('Get UMLS hyponyms for %d CUIs', len(cuis))
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
        logger.info("Get related of %s CUIs through %s", len(cuis), ', '.join(relations))
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


__comap_client = None
def get_client():
    global __comap_client
    if not __comap_client:
        __comap_client = ComapClient()
    return __comap_client

# READ2/3

_umls_db = None
def get_umls_db():
    global _umls_db
    if _umls_db is None:
        _umls_db = pymysql.connect(**UMLS_DB_ACCESS)
    return _umls_db

_umls_ext_db = None
def get_umls_ext_db():
    global _umls_ext_db
    if _umls_ext_db is None:
        _umls_ext_db = pymysql.connect(**UMLS_EXT_DB_ACCESS)
    return _umls_ext_db


def translation_read_2to3(codes):
    """ { read2_code: { read3_code } } """
    translation = defaultdict(set)
    if not codes:
        return translation
    with get_umls_ext_db().cursor() as cursor:
        query = """
            select distinct V2_CONCEPTID, CTV3_CONCEPTID
            from RCD_V3_to_V2
            where V2_CONCEPTID in %s
        """
        cursor.execute(query, [codes])
        for code2, code3 in cursor.fetchall():
            translation[code2].add(code3)
    return translation


def translation_read_3to2(codes):
    """ { read2_code: { read3_code } } """
    translation = defaultdict(set)
    if codes:
        with get_umls_ext_db().cursor() as cursor:
            query = """
                select distinct V2_CONCEPTID, CTV3_CONCEPTID
                from RCD_V3_to_V2
                where CTV3_CONCEPTID in %s
                and V2_CONCEPTID not in ('_DRUG', '_NONE')
            """
            cursor.execute(query, [codes])
            for code2, code3 in cursor.fetchall():
                translation[code3].add(code2)
    return translation


def code_names(codes, coding_system):
    if not codes:
        return {}

    original_coding_system = coding_system
    if coding_system == 'RCD2':
        coding_system = 'RCD'
        original_codes = codes
        t = translation_read_2to3(codes)
        codes = { code3 for code in codes for code3 in t[code] }

    query = """
    select distinct code, str from MRCONSO
    where ts = 'P' and stt = 'PF' and ispref = 'Y' and lat = 'ENG'
    and code in %s and sab = %s
    """
    with get_umls_db().cursor() as cursor:
        cursor.execute(query, [codes, coding_system])
        res = dict(cursor.fetchall())

    if original_coding_system == 'RCD2':
        def aux(code2):
            try:
                return next(filter(None, [res.get(code3) for code3 in t[code2]]))
            except StopIteration:
                return '?'
        res = {
            code2: aux(code2)
            for code2 in original_codes
        }

    return res

def cui_names(cuis):
    if not cuis:
        return {}
    query = """
    select distinct cui, str from MRCONSO
    where ts = 'P' and stt = 'PF' and ispref = 'Y' and lat = 'ENG'
    and cui in %s
    """
    with get_umls_db().cursor() as cursor:
        cursor.execute(query, [cuis])
        return dict(cursor.fetchall())

def codes_of_raw_concept(concept, coding_system):
    return {
        sourceConcept['id']
        for sourceConcept in concept['sourceConcepts']
        if sourceConcept['codingSystem'] == coding_system
    }
