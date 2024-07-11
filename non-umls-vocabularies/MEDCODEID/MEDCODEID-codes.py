import sys
import pandas as pd

AURUM_MEDICAL_FILENAME = "../resources/CPRD Gold and Aurum/CPRD_CodeBrowser_202309_Aurum/CPRD_CodeBrowser_202309_Aurum/CPRDAurumMedical.txt"

[_, out_filename] = sys.argv

aurum_medical = pd.read_csv(AURUM_MEDICAL_FILENAME, sep='\t')

cols = {
    'MedCodeId': 'code',
    'SnomedCTConceptId': 'umls_code',
    'Term': 'term',
}

res = (
    aurum_medical
    .rename(cols, axis=1)
    [cols.values()]
    .assign(umls_sab='SNOMEDCT_US', rel='EQ')
)

res.to_csv(out_filename, index=False)
