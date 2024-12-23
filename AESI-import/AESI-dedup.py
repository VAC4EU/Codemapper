import sys
import os
import functools
from collections import defaultdict
import shutil
from os import path
import pandas as pd
import psycopg2
import psycopg2.extras
import pickle
import multiprocessing as mp
from collections import namedtuple
from unidecode import unidecode
from glob import glob
from nltk import edit_distance
from nltk.tokenize import word_tokenize

SEP = "-',/"

IGNORE_TTYS = set("AA AD AM AS AT CE EP ES ETAL ETCF ETCLIN ET EX GT IS IT LLTJKN1 LLTJKN LLT LO MP MTH_ET MTH_IS MTH_LLT MTH_LO MTH_OAF MTH_OAP MTH_OAS MTH_OET MTH_OET MTH_OF MTH_OL MTH_OL MTH_OPN MTH_OP OAF OAM OAM OAP OAS OA OET OET OF OLC OLG OLJKN1 OLJKN1 OLJKN OLJKN OL OL OM OM ONP OOSN OPN OP PCE PEP PHENO_ET PQ PXQ PXQ SCALE TQ XQ".split())

def any_ignored_ttys(ttys):
    return not ttys.isdisjoint(IGNORE_TTYS)

def all_ignored_ttys(ttys):
    return ttys.issubset(IGNORE_TTYS)

# ./check.py:coding_systems
UMLS_CODING_SYSTEMS = set(['ICD10', 'ICD10CM', 'ICD9CM', 'ICPC', 'ICPC2EENG', 'ICPC2P', 'MTHICD9', 'RCD', 'SCTSPA', 'SNM', 'SNOMEDCT_US'])

NON_UMLS_CODING_SYSTEMS = set(["ICD10DA", "MEDCODEID", "RCD2"])

CODING_SYSTEMS = UMLS_CODING_SYSTEMS | NON_UMLS_CODING_SYSTEMS

def norm_str(str, wildcard):
    if wildcard:
        for s in SEP:
            str = str.replace(s, wildcard)
    return unidecode(str)

def term_norm(str):
    str = (str
           .replace("kidney", "KIDNEY")
           .replace("renal", "KIDNEY"))
    return norm_str(str, "_")

def term_match(str1, str2):
    dist = edit_distance(term_norm(str1), term_norm(str2))
    max_dist = (
        max(len(str1), len(str2)) - min(len(str1), len(str2))
        + min(len(str1), len(str2)) / 10
    )
    return dist <= max_dist

def tok_match(tok1, tok2):
    n1 = len(tok1)
    n2 = len(tok2)
    return (
        tok1 == tok2 or
        tok1.startswith(tok2) or
        tok2.startswith(tok1) or
        edit_distance(tok1, tok2) <= (max(n1, n2) - min(n1, n2))
    )

def abbr_prep(str):
    for s in SEP:
        str = str.replace(s, ' ')
    return str.lower()

def term_match_abbr(str1, str2):
    toks1 = [t for t in word_tokenize(abbr_prep(str1)) if t.isalpha()]
    toks2 = [t for t in word_tokenize(abbr_prep(str2)) if t.isalpha()]
    n1 = len(toks1)
    n2 = len(toks2)
    jumps = 0
    ix1 = 0
    ix2 = 0
    while True:
        end1 = ix1 == len(toks1)
        end2 = ix2 == len(toks2)
        if end1 or end2:
            # number of remaining tokens plus jumps less than threshold
            return (
                (len(toks1) - ix1) +
                (len(toks2) - ix2) +
                jumps < max(n1, n2) / 4
            )
        tok1 = toks1[ix1]
        tok2 = toks2[ix2]
        if tok_match(tok1, tok2):
            # print("Ok", tok1, tok2)
            ix1 +=1
            ix2 +=1
        else:
            if ix2+1 < len(toks2) and tok_match(tok1, toks2[ix2+1]):
                # jump over tok2
                # print("J2", tok1, tok2)
                jumps += 1
                ix2 += 1
            elif ix1+1 < len(toks1) and tok_match(toks1[ix1+1], tok2):
                # jump over tok1
                # print("J1", tok1, tok2)
                jumps += 1
                ix1 += 1
            else:
                # print("NO", tok1, tok2)
                return False
            ix1 += 1
            ix2 += 1

def code_norm(code, sab):
    if sab in ['SNOMEDCT_US', 'SCTSPA'] and code.isnumeric() and len(code) > 15:
        return code[:15]
    if sab.startswith('ICD') and len(code) > 3 and code[3] == '.':
        code = code[:3] + code[4:]
    code = code.strip('0').rstrip('.')
    return code

def code_match(code1, code2, sab):
    match = code_norm(code1, sab) == code_norm(code2, sab)
    if match:
        return True
    if sab == 'SNOMEDCT_US' or sab == 'SCTSPA':
        if len(code2) == 17 and code2.endswith('00'):
            code2 = code2.rstrip('0')
            code1 = code1[:len(code2)]
        return code1 == code2
    return False

################################################################################

def ilike_test(strs, str):
    if '_' in str or '%' in str:
        pat = str.lower().replace('.', '\\.').replace('%', '.*').replace('_', '.')
        pat = '^' + pat + '$'
        return strs.str.lower().str.match(pat).fillna(False) 
    else:
        return strs.str.lower() == str.lower()

def sab_lang(sab):
    return "SPA" if sab == 'SCTSPA' else "ENG"

# def sab_test(sabs, sab, prefix=""):
#     if coding_system == 'SCTSPA':
#         return (sabs == sab) | (sabs == 'SNOMEDCT_US')
#     else:
#         return sabs == sab

# # CUI, STR, CODE, TTYS (on sab and str)
# def codes_by_name(cursor, sab, str):
#     query = f"""
#     select cui, str, code, string_agg(tty,',') as ttys
#     from mrconso
#     where {sab_test(sab)}
#     and str ilike %s
#     group by cui, str, code
#     """
#     cursor.execute(query, (sab, norm_str(str, '_')))
#     return [dict(r) for r in cursor.fetchall()]

# # CUI, STR, CODE, TTYS (on sab and codes)
# def by_codes(cursor, sab, code):
#     query = f"""
#     select cui, str, code, string_agg(tty,',') as ttys
#     from mrconso
#     where {sab_test(sab)}
#     and code = %s
#     group by cui, str, code
#     """
#     cursor.execute(query, (sab, code))
#     return [dict(r) for r in cursor.fetchall()]

# def any_coding_system(cursor, code, str):
#     query = """
#     select cui, sab, str, code, string_agg(tty,',') as ttys
#     from mrconso
#     where code = %s
#     and str = %s
#     group by cui, sab, str, code
#     """
#     cursor.execute(query, (code, str))
#     return [dict(r) for r in cursor.fetchall()]

class Validation:

    def __init__(self, result, cuis=[], row=None, comments=[]):
        self.result = result
        self.row = row
        self.cuis = cuis
        self.comments = comments
        self.obsolete = None

    def select(result, cuis, df, comments=None):
        rows = (r for r in df)
        try:
            row = next(rows)
            comments = [] if comments is None else comments
            if next(rows, None):
                comments.append('not unique')
            return Validation(result, cuis, row, comments)
        except:
            pass

    def __repr__(self):
        repr = self.result
        if self.row is not None:
            repr += f" - {self.row['cui']} - {self.row['code']} - {self.row['str']} - {self.row['sab']}"
        if self.cuis is not None:
            repr += f" - {','.join(self.cuis)}"
        if self.comments:
            repr += f" - ({', '.join(self.comments)})"
        return repr

def ttys_index(row):
    if 'PT' in row['ttys']:
        return 1
    elif row['all_ignored_ttys']:
        return 4
    else:
        if row['ttys'].issubset({'AA', 'AB', 'ACR', 'AM', 'CA2', 'CA3', 'CDA', 'CS', 'DEV', 'DS', 'DSV', 'ES', 'HS', 'ID', 'MTH_ACR', 'NS', 'OAM', 'OA', 'OSN', 'PS', 'QAP', 'QEV', 'RAB', 'SSN', 'SS', 'VAB'}):
            return 3
        else:
            return 2

import time

class Tables:

    def __init__(self, table, mrcui, by_sab):
        self.table = table # | sab | code | str | cui | ttys | all_ignored_ttys | any_ignored_ttys | ttys_index |
        self.mrcui = mrcui
        self.by_sab = by_sab # {sab: table}

    def from_tables(tables):
        return Tables(tables.table, tables.mrcui, tables.by_sab)

    def load(table_filename, mrcui_filename):
        t0 = time.time()
        table_parquet = table_filename + '.parquet'
        if os.path.isfile(table_parquet):
            print("Read cached table file", table_parquet)
            table = (
                pd.read_parquet(table_parquet)
                .assign(ttys=lambda df: df.ttys.map(lambda s: set(s.split(','))))
            )
        else:
            dtype = defaultdict(lambda: str, {'sab': "category"})
            print("Read table file", time.time() - t0)
            table = (
                pd.read_csv(table_filename, dtype=dtype)
                .assign(sab=lambda df: df.sab.astype("category"))
                .assign(code=lambda df: df.code.astype("category"))
                .assign(ttys=lambda df: df.ttys.str.split(',').apply(set))
                .assign(all_ignored_ttys=lambda df: df.ttys.map(all_ignored_ttys))
                .assign(any_ignored_ttys=lambda df: df.ttys.map(any_ignored_ttys))
                .assign(ttys_index=lambda df: df.apply(ttys_index, axis=1))
            )
            print("Write table cache file", table_parquet, time.time() - t0)
            table.assign(ttys=table.ttys.map(','.join)).to_parquet(table_parquet)
        print("tables:", len(table), time.time() - t0)
        names = ['cui1', 'ver', 'rel', 'rela', 'mapreason', 'cui2', 'mapin', 'dummy']
        mrcui = pd.read_csv(mrcui_filename, dtype=str, names=names, sep='|')
        print("mrcui:", len(mrcui), time.time() - t0)
        by_sab = {
            sab: df
            for sab, df in table.groupby('sab', observed=True)
        }
        print("by_sab:", len(by_sab), time.time() - t0)
        return Tables(table, mrcui, by_sab)

    @functools.cache
    def by_sab_code(self, sab, code):
        df = self.by_sab[sab]
        return df[df.code == code]

    def retired(self, cui):
        return self.mrcui[self.mrcui.cui1 == cui].cui2.to_list()

    # exact code and matching str
    def by_code(self, sab, code):
        df = self.by_sab_code(sab, code)
        return df.to_dict('records')

    # ilike str and matching code
    def by_name(self, sab, str):
        df = self.by_sab[sab]
        df = df[ilike_test(df.str, str)]
        return df.to_dict('records')

    def any_coding_system(self, code, str):
        df = self.table
        df = df[df.code == code]
        df = df[df.str == str]
        return df.sort_values('ttys_index').to_dict('records')

    def exact(self, sab, code, str, cuis):
        df = self.table
        df = df[df.sab == sab]
        df = df[df.code == code]
        if cuis:
            df = df[df.cui.isin(cuis)]
        df = df[df.str == str]
        return df.sort_values('ttys_index').to_dict('records')

    def unignore(self, sab, code, cuis):
        df = self.by_sab_code(sab, code)
        if df is None:
            return []
        df = df[~df.all_ignored_ttys]
        return (
            df.assign(not_cui=False if cuis is None else ~df.cui.isin(cuis))
            .sort_values(['not_cui', 'ttys_index'])
            .drop('not_cui', axis=1)
            .to_dict('records')
        )

    def categorize(self, row):
        return self.categorize_inner(row['sab'], row['code'], row['str'], row['cui'])

    @functools.cache
    def categorize_inner(self, sab, code, str, cui):
        val = self.validate(sab, code, str, cui)
        if val.row is not None and val.row['all_ignored_ttys']:
            rows = self.unignore(val.row['sab'], val.row['code'], val.cuis)
            if len(rows) > 0:
                val.row, val.obsolete = rows[0], val.row
        return val

    def validate(self, sab, code, str, cui):
        cuis = None
        comments = []
        if cui:
            retired = self.retired(cui)
            if retired:
                cuis = retired
                comments.append("updated retired concept")
            else:
                cuis = [cui]

        if code is None or not code or code == '-':
            return Validation('NONE_NO_CODE', cuis, comments=comments)

        if sab is None or pd.isna(sab) or sab.strip() not in CODING_SYSTEMS or sab == '-':
            return Validation('NONE_NO_CODING_SYSTEM', cuis, comments=comments)

        rows = self.exact(sab, code, str, cuis)
        val = Validation.select('EXACT', cuis, rows)
        if val is not None:
            return val
        
        by_code = self.by_code(sab, code)
        for row in by_code:
            if term_match(row['str'], str):
                return Validation('BY_CODE', cuis, row)

        by_name = self.by_name(sab, str)
        for row in by_name:
            if code_match(row['code'], code, sab):
                return Validation('BY_NAME', cuis, row)

        for row in by_code:
            df = self.table
            df = df[df.cui == row['cui']]
            df = df[df.str == row['str']]
            for _, row1 in df.iterrows():
                return Validation('BY_CODE_EQUIV', cuis, row, comments=comments)

        if cuis:
            rows = (r for r in by_name if r['cui'] in cuis)
            val = Validation.select('CODE_BY_CUI', cuis, rows, comments=comments)
            if val is not None:
                return val

            rows = (r for r in by_code if r['cui'] in cuis)
            val = Validation.select('CODE_NAME_BY_CUI', cuis, rows, comments=comments)
            if val is not None:
                return val

        # # don't change coding system: better represent as custom code than lose
        # # the code in another coding system
        # rows = self.any_coding_system(code, str)
        # val = Validation.select('CHANGE_CODING_SYSTEM', cuis, rows, comments=comments)
        # if val is not None:
        #     return val

        for row in by_code:
            if term_match_abbr(row['str'], str):
                return Validation('NAME_BY_CODE_ABBR', cuis, row, comments=comments)

        if len(code) > 15 and code[-2:] == '00':
            df = self.table
            df = df[df.sab == sab]
            df = df[df.code.str.startswith(code[:-2])]
            # str does not match, use a code that matches the first 15 digits
            # uniquely
            if len(df.cui.drop_duplicates()) == 1:
                return Validation('ROUNDING', cuis, df.iloc[0], comments=comments)

        return Validation('NONE', cuis)

    def dedup(self, df):
        df["dedup_result"] = "-"
        df["dedup_comments"] = "-"
        df["dedup_code"] = "-"
        df["dedup_str"] = "-"
        df["dedup_sab"] = "-"
        df["dedup_cui"] = "-"
        df["dedup_ttys"] = "-"
        df["dedup_ignore"] = "-"

        hist = {}
        count = 0
        for i, row in df.iterrows():
            count += 1
            if count % 100 == 0:
                print(".", end="", flush=True)

            val = self.categorize(row)
            df.at[i, "dedup_result"]       = val.result
            if not val.result.startswith("NONE"):
                df.at[i, "dedup_result"] = val.result
                df.at[i, "dedup_code"]   = val.row["code"]
                df.at[i, "dedup_str"]    = val.row["str"]
                df.at[i, "dedup_cui"]    = val.row["cui"]
                df.at[i, "dedup_sab"]    = val.row['sab']
                df.at[i, "dedup_ttys"]   = ','.join(sorted(val.row['ttys']))
                df.at[i, "dedup_ignore"] = str(val.row['all_ignored_ttys']).lower()
            if val.comments:
                df.at[i, 'dedup_comments'] = '\n'.join(val.comments)

        return df

    def dedup_dir(self, indir, outdir, count=None):
        for ix, infile in enumerate(sorted(glob(f"{indir}/*.csv"))):
            if ix == count:
                break
            if infile == f"{indir}/index.csv":
                continue
            name = path.basename(infile).replace('.csv', '')
            print(name, end=' ', flush=True)
            outfile = f"{outdir}/{name}.csv"
            # if path.exists(outfile):
            #     print("exists already.")
            #     continue
            df = pd.read_csv(infile, dtype=str, na_filter=False)
            print(len(df), end=' ', flush=True)
            df = self.dedup(df)
            print()
            df.to_csv(outfile, index=False)

def mkrow(sab=None, code=None, str=None, cui=None, row=None, **kwargs):
    if row is None:
        res = {}
    else:
        res = mkrow(row.get('sab'), row.get('code'), row.get('str'), row.get('cui'))
    if sab is not None:
        res['sab'] = sab
    if code is not None:
        res['code'] = code
    if str is not None:
        res['str'] = str
    if cui is not None:
        res['cui'] = cui
    return res

def tests(tables):

    row = mkrow(sab='-', code='D68.4', str='Deficiency of coagulation factor due to liver disease', cui='C0398604')
    val = tables.categorize(row)
    assert val.result == 'NONE_NO_CODING_SYSTEM', val.result

    row = mkrow(sab='ICD10CM', code='-', str='Deficiency of coagulation factor due to liver disease', cui='C0398604')
    val = tables.categorize(row)
    assert val.result == 'NONE_NO_CODE', val.result

    row = mkrow(sab='ICD10CM', code='D68.4', str='Acquired coagulation factor deficiency', cui='C0001169')
    val = tables.categorize(row)
    assert val.result == 'EXACT', val.result
    assert val.obsolete == None, val.obsolete
    assert mkrow(row=val.row) == row, val.row

    row = mkrow(sab='ICD10CM', code='D68.4', str='Deficiency of coagulation factor due to liver disease', cui='C0398604')
    val = tables.categorize(row)
    assert val.result == 'EXACT', val.result
    assert mkrow(row=val.obsolete) == row, val.obsolete
    assert val.row['str'] == 'Acquired coagulation factor deficiency', val.row['str']

    row = mkrow(sab='ICD10CM',code='I66',str='embolism of cerebral artery',cui='C0007780')
    val = tables.categorize(row)
    assert val.result == 'EXACT', val.result
    assert val.obsolete is not None
    assert mkrow(row=val.row) == mkrow(str='Occlusion and stenosis of cerebral arteries, not resulting in cerebral infarction', cui='C0348832', row=row), mkrow(row=val.row)

    row = mkrow(sab='ICD10CM', code='D68.4', str='XXquired coagulation factor deficiency', cui='C0001169')
    val = tables.categorize(row)
    assert val.result == 'BY_CODE', val.result
    assert val.obsolete == None, val.obsolete
    assert mkrow(row=val.row) == mkrow(str='Acquired coagulation factor deficiency', row=row), mkrow(val.row)

    row = mkrow(sab='ICD10', code='D68', str='Von Willebrand\'s disease', cui='C0042974')
    val = tables.categorize(row)
    assert val.result == 'BY_NAME', val.result
    assert val.obsolete == None, val.obsolete
    assert mkrow(row=val.row) == mkrow(code='D68.0', row=row), mkrow(val.row)

    row = mkrow(sab='SNOMEDCT_US', code='10752381000119100', str='Fetal thrombocytopenia', cui='C2349596')
    val = tables.categorize(row)
    assert val.result == 'BY_NAME', val.result
    assert val.obsolete == None, val.obsolete
    assert mkrow(row=val.row) == mkrow(code='10752381000119101', row=row), mkrow(val.row)

    row = mkrow(sab='SCTSPA', code='328381000119105', str='Pancytopenia caused by anticonvulsant', cui='C5547251')
    val = tables.categorize(row)
    assert val.result == 'BY_CODE_EQUIV', val.result
    assert val.obsolete == None, val.obsolete
    assert mkrow(row=val.row) == mkrow(str='pancitopenia causada por anticonvulsivante', row=row), val.row

    row = mkrow(sab='SCTSPA', code='10752381000119100', str='Fetal thrombocytopenia', cui='')
    val = tables.categorize(row)
    assert val.result == 'ROUNDING', val.result

    row = mkrow(sab='ICD10DA', code='D683', str='Blødningsforstyrrelse forårsaget af cirkulerende antikoagulantia', cui='C1399404')
    val = tables.categorize(row)
    assert val.result == 'BY_CODE', val.result
    assert mkrow(row=val.row) == mkrow(str="Blødningsforstyrrelse f.a. cirkulerende antikoagulantia", row=row), val.row

if __name__ == "__main__" and "INTERACTIVE" not in globals():
    [_, indir, table_filename, mrcui_filename, outdir] = sys.argv
    tables = Tables.load(table_filename, mrcui_filename)
    tests(tables)
    print("Tests succeeded!")
    try:
        num = int(os.environ['MAX'])
        print("num:", num)
    except:
        num = None
    tables.dedup_dir(indir, outdir, num)
