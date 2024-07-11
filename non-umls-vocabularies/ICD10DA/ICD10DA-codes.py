# Parameters
# - `SKSComplete.txt`
# - `mrconso.csv`
# - `manual_mapped`: manually mapped codes (CSV with columns `sourceCode, equivalence, conceptId`)
# - `manual_mapped_voc`: name of the UMLS vocabulary that is targeted by `conceptId` of `manual_mapped` 
# - `unmapped`: output of remaining unmapped codes
# - `output`: output of mapped codes (CSV with columns `Code, Term, Voc_Mapped, Code_Mapped`)
import pandas as pd
import sys

[_,
 skscomplete_filename,
 mrconso_filename,
 manual_mapped_filename,
 manual_mapped_concepts_filename,
 unmapped_filename,
 output_filename,
] = sys.argv

sks = (
    pd.read_fwf(skscomplete_filename, header=None, encoding="iso-8859-1")
    .assign(
        Prefix=lambda df: df[0].str[:4],
        Code=lambda df: df[0].str[4:],
        Term=lambda df: df[1].str[24:],
        StartDate=lambda df: pd.to_datetime(df[1].str[0:8], format="%Y%m%d"),
        # EndDate=lambda df: pd.to_datetime(df[1].str[16:24], format="%Y%m%d"),
        # Code=lambda df: col0[4:7].where(col0.len() <= 7, col0[4:7] + '.' + col0[7:]),
    )
    [["Prefix", "Code", "Term", "StartDate"]]
    .pipe(lambda df: df[
        (df.Code.str.len() > 1) &
        (df.Prefix == 'diaD') &         # only diagnostic codes
        ~df.Code.str.startswith('U')    # ignore custom codes
    ])
    .drop_duplicates(subset=["Code"], keep='last')
)

mrconso = pd.read_csv(mrconso_filename, dtype=str)
icd10 = (
    mrconso
    [mrconso["sab"] == "ICD10"]
    .rename({'code': 'Code', 'str': 'Code name'}, axis=1)
    [["Code", "Code name"]]
    .assign(CodeDA=lambda df: df.Code.str.replace(".", ""))
    .set_index("CodeDA")
    [["Code", "Code name"]]
    .to_dict()
)
icd10cm = (
    mrconso
    [mrconso["sab"] == "ICD10CM"]
    .rename({'code': 'Code', 'str': 'Code name'}, axis=1)
    [["Code", "Code name"]]
    .assign(CodeDA=lambda df: df.Code.str.replace(".", ""))
    .set_index("CodeDA")
    [["Code", "Code name"]]
    .to_dict()
)

# # https://cdn.who.int/media/docs/default-source/classification/icd/icd-10/icd-10-to-meddra-map---june-2023---codes-mapping.xlsx
# icd10meddra = (
#     pd.read_excel(
#         "icd-10-to-meddra-map---june-2023---codes-mapping.xlsx",
#         skiprows=1,
#         dtype=str,
#     )
#     .set_index("ICD-10 Code")
#     [["MedDRA LLT", "Map Attribute"]]
#     .to_dict()
# )

def merge_icd10(df, name, voc):
    [code_col, term_col, suffix_col] = [s + "_" + name for s in "Code Term Suffix".split()]
    df = (df
          .assign(**{code_col: pd.NA})
          .assign(**{term_col: pd.NA})
          .assign(**{suffix_col: pd.NA}))
    for i, row in df.iterrows():
        l = len(row.Code)
        for x in range(l):
            code0 = row.Code[:l-x]
            if len(code0) == 2:
                break
            if code0[-1] == '.':
                continue
            suffix = row.Code[l-x:]
            try:
                df.at[i, code_col] = voc["Code"][code0]
                df.at[i, term_col] = voc["Code name"][code0]
                df.at[i, suffix_col] = suffix
                break
            except KeyError:
                pass
    return df

# def merge_meddra(sks, voc):
#     sks["Code_MedDRA"] = pd.NA
#     sks["Suffix_MedDRA"] = pd.NA
#     for i, row in sks.iterrows():
#         l = len(row.Code)
#         for x in range(l):
#             code0 = row.Code[:l-x]
#             if len(code0) == 2:
#                 break
#             if code0[-1] == '.':
#                 continue
#             suffix = row.Code[l-x:]
#             try:
#                 sks.at[i, "Code_MedDRA"] = voc["MedDRA LLT"][code0]
#                 sks.at[i, "Suffix_MedDRA"] = suffix
#                 break
#             except KeyError:
#                 pass
#     return sks

def select(sks):
    sks['Code_Mapped'] = pd.NA
    sks['Term_Mapped'] = pd.NA
    sks['Suffix_Mapped'] = pd.NA
    sks['Voc_Mapped'] = pd.NA
    sks['Rel'] = pd.NA

    for i, row in sks.iterrows():
        if type(row.Code_ICD10) == str: 
            voc = "ICD10"
        elif type(row.Code_ICD10CM) == str:
            voc = "ICD10CM"
        elif type(row.get('Code_MedDRA')) == str:
            voc = "MedDRA"
        else:
            continue
        sks.at[i, "Code_Mapped"] = row["Code_"+voc]
        sks.at[i, "Term_Mapped"] = row.get("Term_"+voc)
        sks.at[i, "Suffix_Mapped"] = row["Suffix_"+voc]
        sks.at[i, "Voc_Mapped"] = voc
        sks.at[i, "Rel"] = 'RN' if row["Suffix_"+voc] else 'EQ'

    return sks

sks = merge_icd10(sks, "ICD10", icd10)
sks = merge_icd10(sks, "ICD10CM", icd10cm)
sks = select(sks)

num_mapped1 = sks.Code_Mapped.isna().value_counts()[False]
# print(f"Mapped before meddra: {num_mapped1}")
# sks = merge_meddra(sks, icd10meddra)
# sks = select(sks)

num_mapped = sks.Code_Mapped.isna().value_counts()[False]
num_mapped_icd10 = sks.Code_ICD10.isna().value_counts()[False]
num_mapped_icd10cm = sks.Code_ICD10CM.isna().value_counts()[False]
# num_mapped_only_meddra = (
#     (sks.Code_ICD10.isna() & sks.Code_ICD10CM.isna())
#     & ~sks.Code_MedDRA.isna()
# ).value_counts()[True]

summary = pd.DataFrame({
    "total": sks.groupby("Prefix").Code.count(),
    "unmapped": sks[sks.Code_Mapped.isna()].groupby("Prefix").Code.count(),
})
summary["percentage"] = summary.unmapped / summary.total
summary.style.format({
    'percentage': '{:,.2f}'.format,
})

print(summary)
print(f"SKS: {len(sks)}")
print(f"Mapped: {num_mapped}")
print(f"Mapped ICD10: {num_mapped_icd10}")
print(f"Mapped ICD10CM: {num_mapped_icd10cm}")
# print(f"Mapped only MedDRA: {num_mapped_only_meddra}")

manual_concepts = (
    pd.read_csv(manual_mapped_concepts_filename, delimiter='\t', dtype=str)
    [['concept_id', 'concept_code', 'vocabulary_id']]
    .drop_duplicates()
)

manual_mapped = (
    pd.read_csv(manual_mapped_filename, dtype=str)
    [['sourceCode', 'conceptId', 'equivalence']]
)
# )

manual_mapped_concepts = (
    pd.merge(
        manual_mapped,
        manual_concepts,
        left_on='conceptId',
        right_on='concept_id',
    )
    .rename({
        'sourceCode': 'Code',
        'equivalence': 'Rel',
        'concept_code': 'Code_Mapped',
        'vocabulary_id': 'Voc_Mapped',
    }, axis=1)
    .assign(Rel=lambda df: df.Rel.replace({'NARROWER': 'RN', 'BROADER': 'RB', 'EQUIVALENT': 'EQ', 'EQUAL': 'EQ'}))
    .assign(Voc_Mapped=lambda df: df.Voc_Mapped.replace({'SNOMED': 'SNOMEDCT_US'}))
    [['Code', 'Rel', 'Code_Mapped', 'Voc_Mapped']]
)

unresolved = ~manual_mapped_concepts.Rel.isin(['RN', 'RB', 'EQ'])
if unresolved.any():
   print("There are", unresolved.sum(), "unresolved manually mapped codes")
   print(manual_mapped_concepts[unresolved].to_string())

sks = (
    sks.set_index('Code')
    .combine_first(manual_mapped_concepts.set_index('Code'))
    .reset_index()
)

unmapped = sks.Code_Mapped.isna()

if unmapped.any():
    print("There are", unmapped.sum(), "unmapped codes, written to", unmapped_filename)
    sks[unmapped].to_csv(unmapped_filename, index=False)
else:
    print("All mapped!")

cols = {
    'Code': 'code',
    'Term': 'term',
    'Code_Mapped': 'umls_code',
    'Voc_Mapped': 'umls_sab',
    'Rel': 'rel',
}

(sks
 .rename(cols, axis=1)
 [cols.values()]
 .to_csv(output_filename, index=False))
# print("Copying to clipboard...")
# (sks["Prefix Code Term StartDate Voc_Mapped Code_Mapped Term_Mapped Suffix_Mapped".split()]
#  .to_clipboard(index=False))
