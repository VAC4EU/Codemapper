import sys
import pandas as pd
from collections import defaultdict

NAMES = ['cui', 'sab', 'code', 'str', 'tty']
NON_UMLS_COLUMN_NAMES = {
    'cui': 'cui',
    'voc_abbr': 'sab',
    'code': 'code',
    'term': 'str',
}

IGNORE_TTYS = set("AA AD AM AS AT CE EP ES ETAL ETCF ETCLIN ET EX GT IS IT LLTJKN1 LLTJKN LLT LO MP MTH_ET MTH_IS MTH_LLT MTH_LO MTH_OAF MTH_OAP MTH_OAS MTH_OET MTH_OET MTH_OF MTH_OL MTH_OL MTH_OPN MTH_OP OAF OAM OAM OAP OAS OA OET OET OF OLC OLG OLJKN1 OLJKN1 OLJKN OLJKN OL OL OM OM ONP OOSN OPN OP PCE PEP PHENO_ET PQ PXQ PXQ SCALE TQ XQ".split())

def any_ignored_ttys(ttys):
    return not ttys.isdisjoint(IGNORE_TTYS)

def all_ignored_ttys(ttys):
    return ttys.issubset(IGNORE_TTYS)

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

def make_table(mrconso_filename, non_umls_filename):
    dtype = defaultdict(lambda: str, sab="category", voc_abbr="category")
    mrconso = pd.read_csv(mrconso_filename, dtype=dtype)[NAMES]
    print("mrconso", len(mrconso))
    non_umls = (
        pd.read_csv(non_umls_filename, dtype=dtype)
        .rename(columns=NON_UMLS_COLUMN_NAMES)
        [NON_UMLS_COLUMN_NAMES.values()]
        .assign(tty='unknown')
        [NAMES]
    )
    print("non_umls", len(non_umls))
    return (
        pd.concat([mrconso, non_umls])
        .groupby(['cui', 'sab', 'code', 'str'])
        .tty
        .agg(lambda s: ','.join(s.unique()))
        .reset_index()
        .rename({'tty': 'ttys'}, axis=1)
    )

def process(table):
    return (
        table
        .assign(sab=lambda df: df.sab.astype("category"))
        .assign(code=lambda df: df.code.astype("category"))
        .assign(ttys=lambda df: df.ttys.str.split(',').apply(set))
        .assign(all_ignored_ttys=lambda df: df.ttys.map(all_ignored_ttys))
        .assign(any_ignored_ttys=lambda df: df.ttys.map(any_ignored_ttys))
        .assign(ttys_index=lambda df: df.apply(ttys_index, axis=1))
        .assign(ttys=table.ttys.map(','.join))
    )
    

[_, mrconso_filename, non_umls_filename, out_filename] = sys.argv

table = make_table(mrconso_filename, non_umls_filename)
table.to_csv(out_filename, index=False)
print("Written:", out_filename)

processed = process(table)
parquet_filename = out_filename + ".parquet"
print("Written:", parquet_filename)
processed.to_parquet(parquet_filename)
