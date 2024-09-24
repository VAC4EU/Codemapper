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

KEY_COLUMNS = ['coding_system', 'code', 'code_name', 'concept', 'concept_name']

IGNORE_TTYS = set("AA AD AM AS AT CE EP ES ETAL ETCF ETCLIN ET EX GT IS IT LLTJKN1 LLTJKN LLT LO MP MTH_ET MTH_IS MTH_LLT MTH_LO MTH_OAF MTH_OAP MTH_OAS MTH_OET MTH_OET MTH_OF MTH_OL MTH_OL MTH_OPN MTH_OP OAF OAM OAM OAP OAS OA OET OET OF OLC OLG OLJKN1 OLJKN1 OLJKN OLJKN OL OL OM OM ONP OOSN OPN OP PCE PEP PHENO_ET PQ PXQ PXQ SCALE TQ XQ".split())

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

def code_norm(code, coding_system):
    if coding_system == 'SNOMEDCT_US' or coding_system == 'SCTSPA':
        if len(code) == 17 and code.endswith("00"):
            return code[:-1] + '0'
    return code.strip('0').rstrip('.')

def code_match(code1, code2, coding_system):
    match = code_norm(code1, coding_system) == code_norm(code2, coding_system)
    if match:
        return True
    if coding_system == 'SNOMEDCT_US' or coding_system == 'SCTSPA':
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
# def names_by_codes(cursor, sab, code):
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

class Categorization:

    def __init__(self):
        self.result = None
        self.row = None
        self.direct = None
        self.names_by_code = None
        self.codes_by_name = None
        self.synonyms = None
        self.comment = None

    def __str__(self):
        return self.result

class Tables:

    def __init__(self, table, mrcui):
        self.table = table
        self.mrcui = mrcui
        print("tables:", len(self.table))
        self.by_sab = {
            sab: df
            for sab, df in self.table.groupby('sab')
        }
        print("by_sab:", len(self.by_sab))
        self.by_sab_code = {
            sab: {
                code: df1
                for code, df1 in df.groupby('code')
            }
            for sab, df in self.by_sab.items()
        }
        print("by_sab_code:", sum(len(d) for d in self.by_sab_code.values()))

    def retired(self, cui):
        return mrcui[self.mrcui.cui1 == cui].cui2.to_list()

    def codes_by_name(self, sab, str):
        # TODO? sab_test
        df = self.by_sab[sab]
        return df[ilike_test(df.str, str)].to_dict('records')

    def names_by_codes(self, sab, code):
        # TODO? sab_test
        df = self.by_sab_code[sab].get(code)
        if df is None:
            return []
        else:
            return df.to_dict('records')

    def any_coding_system(self, code, str):
        df = self.table
        df = df[df.code == code]
        df = df[df.str == str]
        return df.to_dict('records')

    def direct(self, sab, code, str, cuis):
        df = self.table
        df = df[df.sab == sab]
        df = df[df.code == code]
        if cuis:
            df = df[df.cui.isin(cuis)]
        if len(code) < 8:
            # Small codes are not rounded and we can search direct codes from
            # sab/code alone.
            pass
        else:
            # Large code could be rounded and may have to restore the code from
            # the term
            df = df[df.str == str]
        return df.to_dict('records')

    # row: {'coding_system': sab, 'code': str, 'code_name': str}
    @functools.cache
    def categorize(self, coding_system, code, code_name, concept):

        cat = Categorization()

        concepts = None
        concept_retired = False
        if concept:
            retired = self.retired(concept)
            if retired is not None:
                concept_retired = True
                concepts = retired
            else:
                concepts = [concept]

        if not code or code == '-':
            cat.result = "NONE_NO_CODE"
            return cat

        if pd.isna(coding_system) or coding_system.strip() not in CODING_SYSTEMS:
            cat.result = "NONE_CODING_SYSTEM"
            return cat

        cat.direct = self.direct(coding_system, code, code_name, concepts)
        rows_direct = (r for r in cat.direct)
        try:
            cat.row = next(rows_direct)
            cat.result = 'DIRECT'
            comments = []
            if next(rows_direct, None):
                comments.append("not unique")
            if concept_retired:
                comments.append("original concept was retired")
            if comments:
                cat.comment = ', '.join(comments)
            return cat
        except:
            pass

        cat.names_by_code = self.names_by_codes(coding_system, code)
        cat.codes_by_name = self.codes_by_name(coding_system, code_name)

        rows_name_by_code = (
            r for r in cat.names_by_code
            if term_match(r['str'], code_name)
        )

        rows_code_by_name = (
            r for r in cat.codes_by_name
            if code_match(r['code'], code, coding_system)
        )

        try:
            cat.row = next(rows_name_by_code)
            if next(rows_code_by_name, None):
                cat.result = "BY_CODE_AND_NAME"
            else:
                cat.result = "NAME_BY_CODE"
            if next(rows_name_by_code, None):
                cat.comment = "not unique"
            return cat
        except:
            pass

        try:
            cat.row = next(rows_code_by_name)
            cat.result = "CODE_BY_NAME"
            if next(rows_code_by_name, None):
                cat.comment = "not unique"
            return cat
        except:
            pass

        name_cuis = {r['cui'] for r in cat.codes_by_name}
        code_cuis = {r['cui'] for r in cat.names_by_code}

        if concept:
            rows = (r for r in cat.codes_by_name if r['cui'] == concept)
            try:
                cat.row = next(rows)
                cat.result = "CODE_BY_CUI"
                if next(rows, None):
                    cat.comment = "not unique"
                return cat
            except:
                pass

            try:
                rows = (r for r in cat.names_by_code if r['cui'] == concept)
                cat.row = next(rows)
                cat.result = "CODE_NAME_BY_CUI"
                if next(rows, None):
                    cat.comment = "not unique"
                return cat
            except:
                pass


        rows = (r for r in self.any_coding_system(code, code_name))
        try:
            cat.row = next(rows)
            if next(rows, None):
                cat.comment = "not unique"
            cat.result = "OTHER_CODING_SYSTEM"
            return cat
        except:
            pass

        rows = (r for r in cat.names_by_code if term_match_abbr(r['str'], code_name))
        try:
            cat.row = next(rows)
            cat.result = "NAME_BY_CODE_ABBR"
            if next(rows, None):
                cat.comment = "not unique"
            return cat
        except:
            pass

        if name_cuis and code_cuis:
            if concept:
                cat.result = "NONE_SAME_CUI"
            else:
                cat.result = "NONE_SAME_CUI_NO_CONCEPT"
            return cat

        cat.result = "NONE"
        return cat

    def dedup(self, df):
        df["dedup_result"] = "-"
        df["dedup_comment"] = "-"
        df["dedup_code"] = "-"
        df["dedup_code_name"] = "-"
        df["dedup_coding_system"] = "-"
        df["dedup_concept"] = "-"
        df["dedup_changed"] = "-"
        df["dedup_ttys"] = "-"
        df["dedup_ignore"] = "-"
        df["dedup_names_by_code"] = "-"
        df["dedup_codes_by_name"] = "-"
        df["dedup_original_code"] = df.code
        df["dedup_original_code_name"] = df.code_name

        hist = {}
        count = 0
        for i, row in df.iterrows():
            count += 1
            if count % 100 == 0:
                print(".", end="", flush=True)

            cat = self.categorize(row['coding_system'], row['code'], row['code_name'], row['concept'])
            if cat.result.startswith("NONE"):
                df.at[i, "dedup_result"]       = cat.result
            else:
                ttys = cat.row.get('ttys', None)
                ignore = '?'
                if ttys is not None:
                    ignore = str(all(t in IGNORE_TTYS for t in ttys)).lower()
                coding_system = cat.row["sab"] if "sab" in cat.row else row['coding_system']
                changed = []
                if cat.row['code'] != row['code']:
                    changed.append(f"code from {row['code']}")
                if cat.row['str'].lower() != row['code_name'].lower():
                    changed.append(f"code name from {row['code_name']}")
                if coding_system != row['coding_system']:
                    changed.append(f"coding system from {row['coding_system']}")
                if cat.row['cui'] != row.get('cwncept'):
                    changed.append(f"cui from {row.get('concept') or '-'}")
                df.at[i, "dedup_result"]        = cat.result
                df.at[i, "dedup_code"]          = cat.row["code"]
                df.at[i, "dedup_code_name"]     = cat.row["str"]
                df.at[i, "dedup_concept"]       = cat.row["cui"]
                df.at[i, "dedup_coding_system"] = coding_system
                if changed:
                    df.at[i, "dedup_changed"]   = 'changed ' + '|'.join(changed)
                df.at[i, "dedup_ttys"]          = ','.join(sorted(ttys))
                df.at[i, "dedup_ignore"]        = ignore

            if cat.names_by_code:
                df.at[i, 'dedup_names_by_code'] = '|'.join(
                    r['str'] # f"{r['code']}:{r['str']}"
                    for r in cat.names_by_code
                )

            if cat.codes_by_name:
                df.at[i, 'dedup_codes_by_name'] = '|'.join(
                    r['code'] # f"{r['code']}:{r['str']}"
                    for r in cat.codes_by_name
                )

            if cat.comment is not None:
                df.at[i, 'dedup_comment'] = cat.comment

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
            if path.exists(outfile):
                print("exists already.")
                continue
            df = pd.read_csv(infile, dtype=str, na_filter=False)
            print(len(df), end=' ', flush=True)
            df = self.dedup(df)
            print()
            df.to_csv(outfile, index=False)

if __name__ == "__main__":
    [_, indir, table_filename, mrcui_filename, outdir] = sys.argv
    dtype = defaultdict(lambda: str, {'sab': "category"})
    table = (
        pd.read_csv(table_filename, dtype=dtype)
        .assign(ttys=lambda df: df.ttys.str.split(',').apply(set))
    )
    names = ['cui1', 'ver', 'rel', 'rela', 'mapreason', 'cui2', 'mapin']
    mrcui = pd.read_csv(mrcui_filename, dtype=str, names=names)
    tables = Tables(table, mrcui)
    try:
        num = int(os.environ['DEDUP_NUM'])
    except:
        num = None
    print("num:", num)
    tables.dedup_dir(indir, outdir, num)

