# Parameters
# - `codes`: mapping from non-umls codes to umls codes (CSV with columns `code,term,umls_code,umls_sab,rel`)
# - `umls_codes`: subset of UMLS MRCONSO (CSV with columns `code,sab,cui`)
# - `output`: CSV with columns `code,term,cui,rel`

import pandas as pd
import sys

[_, codes_filename, mrconso_filename, output_filename] = sys.argv

codes = (
    pd.read_csv(codes_filename, dtype=str)
    [["code", "term", "rel", "umls_code", "umls_sab"]]
)

mrconso = (
    pd.read_csv(mrconso_filename, dtype=str)
    [["sab", "code", "cui"]]
    .drop_duplicates()
)

print(codes.head().to_string(index=False))

res = pd.merge(
    codes,
    mrconso.rename(columns={"code": "umls_code", "sab": "umls_sab"}),
    on=("umls_code", "umls_sab"),
    how='left',
    indicator=True,
).drop_duplicates(["code", "term", "rel", "cui"])

unmapped = (res['_merge'] == 'left_only') | ~res['rel'].isin(['EQ', 'RN'])

print(len(res), "codes in total.")

if unmapped.any():
    unmapped_res = (
        res[unmapped]
        [["code", "term", "cui", "rel", "umls_code", "umls_sab"]]
        .drop_duplicates()
    )
    filename = output_filename.replace('.csv', '-unmapped.csv')
    unmapped_res.to_csv(filename, index=False)
    print(len(unmapped_res), "unmapped codes, written to", filename, "!!!")


no_term = ~unmapped & ((res['term'] == '') | res['term'].isna())

if no_term.any():
    print(no_term.sum(), "missing terms, using 'NO TERM' instead !!!")
    print(res[no_term].head(100).to_string(index=False))
    res['term'] = res.term.where(~no_term, 'NO TERM')

(res[~unmapped]
 [['code', 'term', 'rel', 'umls_code', 'umls_sab', 'cui']]
 .drop_duplicates()
 .to_csv(output_filename, index=False))
