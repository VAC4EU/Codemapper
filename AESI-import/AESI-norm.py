import sys
import os
from os import path
import pandas as pd
from glob import glob
from collections import namedtuple

# Also in AESI-final.py, AESI-import.py
REVIEW_COLUMNS = ("review%_author", "review%_timestamp", "review%_content")

REVIEW_PATTERNS = [
    ("edited by",   "date",           "comment"),           
    ("edited by",   "date edited",    "review comment"),    
    ("clin rev %",  "date %",         "rev %"),             
    ("reviewer %",  "date review %",  "clinical review %"), 
    ("name",        "date",           "clin rev %"),        
    ("reviewer %",  "date rev %",     "clin review %"),     
]

COLUMN_MAPPING = (
    ["coding system",  "code",  "code name",  "concept",  "concept name",  "tags"], 
    ["sab",            "code",  "str",        "cui",      "concept_name",  "tags"], 
)

INPUT_COLUMNS = ["Coding system", "Code", "Code name", "Concept", "Concept name"]

SAB_MAPPING = {
    "e": "SNOMEDCT_US",
    "p": "MEDCODEID",
}

def get_mapping(filename):
    xls = pd.ExcelFile(filename)
    sheets = pd.read_excel(filename, dtype=str, sheet_name=None)
    res = None
    for (sheet_name, df) in sheets.items():
        df.rename(lambda s: s.strip(), axis=1, inplace=True)
        try:
            col0 = df.columns[0]
        except IndexError:
            continue
        if col0 == 'Coding system' and all(c in df.columns for c in INPUT_COLUMNS):
            if res is None:
                res = sheet_name, df
            else:
                print("*** Two sheets with coding systems in file", filename + ": ", data.mapping_sheet_name, ' and ', sheet_name)
                exit(1)
    if res is None:
        print("*** Mapping sheet not found in", filename, "***")
    return res

def preprocess(name, df):
    def f(row):
        if row['sab'] == 'ICD10DA' and len(row['code']) > 3 and row['code'][3] == '.':
            return row['code'][:3] + row['code'][4:]
        if not pd.isna(row['code']) and 'E+' in row['code']:
            return '{:.0f}'.format(float(row['code']))
        return row['code']
    df = (
        df
        .rename(lambda s: s.lower(), axis=1)
        .rename(dict(zip(*COLUMN_MAPPING)), axis=1)
        .apply(lambda s: s.str.strip())
        .pipe(lambda df: df[df.code != '-'])
        .assign(tags=lambda df: df.tags.str.lower())
        .assign(code=lambda df: df.apply(f, axis=1))
        .assign(sab=lambda df: df.sab.replace(SAB_MAPPING))
    )

    multi_tags = (
        df
        .assign(tags=df.tags.replace("", "NONE"))
        .groupby(["sab", "code"])
        .tags.agg(set).reset_index()
        .pipe(lambda df: df[df.tags.map(len) > 1])
    )
    if len(multi_tags):
        print()
        print(f"*** multiple tags in {name}")
        print(multi_tags.assign(tags=multi_tags.tags.map(lambda s: 'multiple:' + '+'.join(s))).to_string(index=False))
    df = (
        pd.merge(df, multi_tags, on=["sab", "code"], how='outer', indicator=True, suffixes=["", "_multi"])
        .assign(tags=lambda df: df.tags.where(df._merge == 'left_only', df.tags_multi.map(lambda s: "never" if pd.isna(s) else "multiple:" + '+'.join(s))))
        .drop(["tags_multi", "_merge"], axis=1)
    )
    
    i_comments = 1
    review_renames = {}
    for col_pats in REVIEW_PATTERNS:
        for i in (str(i) for i in range(5)):
            cols = [c.replace('%', i) for c in col_pats]
            if all(c in df.columns for c in cols):
                i = str(i_comments)
                i_comments += 1
                cols_norm = [c.replace('%', i) for c in REVIEW_COLUMNS]
                renames = dict(zip(cols, cols_norm))
                df = df.rename(renames, axis=1)
                review_renames.update(renames)
    for col in COLUMN_MAPPING[1]:
        if col not in df.columns:
            df[col] = ''
    known_columns = COLUMN_MAPPING[1] + list(review_renames.values())
    df = df.fillna('')[known_columns]
    unknown_cols = set(df.columns) - set(COLUMN_MAPPING[1]) - set(review_renames.values())
    if unknown_cols:
        print(name, "*** unknown columns:", unknown_cols)
    n_reviews = len(review_renames) / 3
    renames = ';'.join(f'{n1}:{n2}' for n1, n2 in review_renames.items())
    return df, n_reviews, renames, unknown_cols

def get_sheets(indir, outdir, max):
    index_rows = []
    for i, filename in enumerate(sorted(glob(f'{indir}/*/*.xlsx'))):
        if max and i >= max:
            break
        name = path.basename(path.dirname(filename))
        sheet_name, df = get_mapping(filename)
        df, num_reviews, cols_norms, unknown_cols = preprocess(name, df)
        outfilename = f"{outdir}/{name}.csv"
        df.to_csv(outfilename, index=False)
        index_rows.append([name, filename, sheet_name, num_reviews, cols_norms, ', '.join(unknown_cols)])
    filename = f"{outdir}/index.csv"
    columns = ["name", "subdir", "sheet_name", "num_reviews", "review_renames", "unknown_columns"]
    index = pd.DataFrame(index_rows, columns=columns).fillna('')
    index.to_csv(filename, index=False)

if __name__ == "__main__":
    try:
        max = int(os.environ['MAX'])
        print("max", max)
    except:
        max = None
    get_sheets(sys.argv[1], sys.argv[2], max)
