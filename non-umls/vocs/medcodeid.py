import polars as pl
import argparse

CPRD_AURUM_COLUMNS = {
    'MedCodeId': 'code',
    'SnomedCTConceptId': 'umls_code',
    'Term': 'term',
}

def cprd_aurum_filename(version: str) -> str:
    return f"resources/CPRD/CPRD_CodeBrowser_{version}_Aurum/CPRDAurumMedical.txt"

def read(cprd_version: str=""):
    filename = cprd_aurum_filename(cprd_version)
    return (
        pl.read_csv(filename, infer_schema=False, separator='\t', quote_char=None) 
        .rename(CPRD_AURUM_COLUMNS)
        .with_columns(umls_sab=pl.lit('SNOMEDCT_US'), rel=pl.lit('EQ'))
        ['code', 'term', 'rel', 'umls_sab', 'umls_code']
    )

def arg_parse():
    parser = argparse.ArgumentParser()
    parser.add_argument("cprd-aurum")
    return parser
