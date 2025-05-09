import sys
from datetime import date
from os import path
from glob import glob
import pandas as pd

# Also in AESI-norm.py, AESI-import.py
REVIEW_COLUMNS = ("review%_author", "review%_timestamp", "review%_content")

YES_NO = {'N': 'No', 'Y': 'Yes'}

RESULT_DETAILS = {
    "EXACT":                      "exact match",
    "ROUNDING":                   "unrounded code with unique concept",
    "BY_CODE":                    "code name by code",
    "BY_CODE_EQUIV":              "code name by equivalent code",
    "BY_NAME":                    "code by code name",
    "CODE_BY_CUI":                "code by concept",
    "NONE":                       "no matching code found",
    "NONE_NO_CODING_SYSTEM":      "unknown coding system or free text",
    "NONE_NO_CODE":               "no code",
    "CHANGE_CODING_SYSTEM":       "changed coding system",
    # "EXACT_MATCH_OBS"          :           "exact match, replace obsolete code name",
    # "BY_CODE_AND_NAME"         :          "code and code name match",
    # "CODE_BY_NAME"             :              "code by code name",
    # "CODE_NAME_BY_CUI"         :          "code name by concept",
    # "CORRECTED_NAME_BY_CODE"   :    "corrected code name by code",
    # "CHANGED_NAME_BY_CODE"     :      "changed code name by code",
    # "NAME_BY_CODE_ABBR"        :         "abbr code name by code",
    # "NONE_SAME_CUI"            :             "code concept and code name concept match but mismatch with concept",
    # "NONE_SAME_CUI_NO_CONCEPT" :  "code concept and code name concept match but no concept",
}

def review_content(s):
    details = RESULT_DETAILS[s['dedup_result']]
    if s['dedup_result'] == 'EXACT':
        return ""
    elif s['dedup_result'].startswith('NONE'):
        result = f"Could not confirm/correct ({details})"
    else:
        if s.dedup_changes == '-':
            result = f"Confirmed ({details})"
        else:
            result = f"Corrected ({details})"
    contents = [result]
    if s['dedup_changes'] != '-':
        contents.append(f"changed {s['dedup_changes']}")
    if s['dedup_comments'] != '-':
        contents.append(f"details: {s['dedup_comments']}")
    return ', '.join(contents) + "."

def finalize(df0, name, num_reviews):
    print(name)
    ignore = df0.dedup_ignore == 'true'
    nocode = df0.code == ''

    df0['dedup_changes'] = '-'
    for i, row in df0.iterrows():
        if row['dedup_result'].startswith('NONE'):
            continue
        changes = []
        if row['dedup_sab'] != row['sab']:
            changes.append(f"coding system from {row['sab']}")
        if row['dedup_code'] != row['code']:
            changes.append(f"code from {row['code']}")
        if row['dedup_str'].lower() != row['str'].lower():
            changes.append(f"code name from \"{row['str']}\"")
        if row['dedup_cui'] != row['cui'] and row['cui'] not in {'', '-'}:
            changes.append(f"concept from {row['cui']}")
        if changes:
            df0.at[i, "dedup_changes"] = ', '.join(changes)

    df = df0[~nocode] # & ~ignore
    info = [len(df0), len(df), 1 + num_reviews]

    res = pd.DataFrame(index=df.index)
    def select(df, col1, col2):
        return df[col1].where(df[col1] != '-', df[col2])
    res['coding_system'] = select(df, 'dedup_sab', 'sab')
    res['code'] = select(df, 'dedup_code', 'code')
    res['code_name'] = select(df, 'dedup_str', 'str')
    res['concept'] = select(df, 'dedup_cui', 'cui')
    res['tags'] = df['tags'].str.lower()
    for i in range(1, num_reviews+1):
        prefix = f'review{i}_'
        for suffix in ['timestamp', 'author', 'content']:
            res[prefix + suffix] = df[prefix + suffix]

    dedup_review_cols = [s.replace('%', str(num_reviews + 1)) for s in REVIEW_COLUMNS]
    for col in dedup_review_cols:
        res[col] = ""
    if len(df) > 0:
        rev_auth, rev_date, rev_cont = dedup_review_cols
        res[rev_auth] = 'SharePoint import'
        res[rev_date] = date.today().isoformat()
        res[rev_cont] = df.apply(review_content, axis=1)
        has_cont = res[rev_cont] != ""
        res[rev_auth] = res[rev_auth].where(has_cont, "")
        res[rev_date] = res[rev_date].where(has_cont, "")
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
    
