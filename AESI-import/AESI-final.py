import sys
from datetime import date
from os import path
from glob import glob
import pandas as pd

# Also in AESI-norm.py, AESI-import.puuy
REVIEW_COLUMNS = ("review_author_%", "review_date_%", "review_content_%")

YES_NO = {'N': 'No', 'Y': 'Yes'}

RESULT_DETAILS = {
    "DIRECT":                    "direct match",
    "BY_CODE_AND_NAME":          "code and code name match",
    "CODE_BY_NAME":              "code by code name",
    "CODE_BY_CUI":               "code by concept",
    "CODE_NAME_BY_CUI":          "code name by concept",
    "NAME_BY_CODE":              "code name by code",
    "NAME_BY_CODE_ABBR":         "abbr code name by code",
    "NONE":                      "nothing found",
    "NONE_CODING_SYSTEM":        "unknown coding system or free text",
    "NONE_NO_CODE":              "no code",
    "NONE_SAME_CUI":             "code concept and code name concept match but mismatch with concept",
    "NONE_SAME_CUI_NO_CONCEPT":  "code concept and code name concept match but no concept",
    "OTHER_CODING_SYSTEM":       "changed coding system",
}

def review_content(s):
    if s['dedup_result'].startswith('NONE'):
        res = "No matching code found."
    else:
        if s.dedup_changed == '-':
            res = "Confirmed."
        else:
            res = "Corrected."
    if s['dedup_changed'] != '-':
        res += f"\nChanged: {s['dedup_changed']}."
    if s['dedup_comment'] != '-':
        res += f"\nDetail: {s['dedup_comment']}."
    return res

def finalize(df0, name, num_reviews):
    print(name)
    ignore = df0.dedup_ignore == 'true'
    df = df0[~ignore]
    info = [len(df0), len(df), 1 + num_reviews]

    review_cols = [s.replace('%', str(num_reviews)) for s in REVIEW_COLUMNS]
    for i in (str(i) for i in range(num_reviews + 1)):
        author_col, date_col, content_col = (s.replace('%', str(i)) for s in REVIEW_COLUMNS)

    res = pd.DataFrame(index=df.index)
    def select(df, col1, col2):
        return df[col1].where(df[col1] != '-', df[col2])
    res['coding_system'] = select(df, 'dedup_coding_system', 'coding_system')
    res['code'] = select(df, 'dedup_code', 'code')
    res['term'] = select(df, 'dedup_code_name', 'code_name')
    res['concept'] = select(df, 'dedup_concept', 'concept')
    res['tag'] = df['tags'].str.lower()
    for col in df.columns:
        if col.startswith('review_'):
            res[col] = df[col]
    for col in review_cols:
        res[col] = ""

    if len(df) == 0:
        return res, info
    else:
        rev_auth, rev_date, rev_cont = review_cols
        res[rev_auth] = 'SharePoint import'
        res[rev_date] = date.today().isoformat()
        res[rev_cont] = df.apply(review_content, axis=1)
        return res, info

def finalize_dir(indexfile, indir, outdir):
    index = pd.read_csv(indexfile).set_index('name')
    info_rows = []
    for infile in sorted(glob(f"{indir}/*.csv")):
        name = path.splitext(path.basename(infile))[0]
        df = pd.read_csv(infile, dtype=str, na_filter=False)
        info = index.loc[name]
        df, info = finalize(df, info.name, int(info.num_reviews))
        info_rows.append(info)
        outfile = f"{outdir}/{name}.csv"
        df.to_csv(outfile, index=False)
    columns = ["original_code_count", "imported_code_count", "num_reviews"]
    info = pd.DataFrame(info_rows, columns=columns).fillna('')
    info.to_csv(f"{outdir}/index.csv", index=False)
    

if __name__ == "__main__":
    finalize_dir(sys.argv[1], sys.argv[2], sys.argv[3])
    
