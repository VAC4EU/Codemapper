import pandas as pd
import sys

RCTCTV3MAP = '../resources/nhs_datamigration/Mapping Tables/Updated/Clinically Assured/rctctv3map_uk_20200401000001.txt'
RCTERMS = "../resources/nhs_datamigration/Mapping Tables/Updated/Not Clinically Assured/rctermsctmap_uk_20200401000001.txt"

outfile = sys.argv[1]

rctctv3 = pd.read_csv(RCTCTV3MAP, sep='\t', dtype=str, na_filter=False)
rcterms = pd.read_csv(RCTERMS, sep='\t', dtype=str, na_filter=False)

columns = {
    "V2_CONCEPTID": "code",
    "Term": "term",
    "CTV3_CONCEPTID": "umls_code",
}

df = (
    pd.merge(rctctv3, rcterms, how='left', left_on='V2_CONCEPTID', right_on='ReadCode')
    .rename(columns=columns)[columns.values()]
    .assign(umls_sab = "RCD", rel = "EQ")
    .drop_duplicates(["code", "umls_code"])
)

df.to_csv(outfile, index=False)

unmapped = df.umls_code.isna()
if unmapped.any():
    print("!!! There are", unmapped.sum(), "unmapped codes !!!")
