import sys
import pandas as pd
from collections import defaultdict

def make_table(mrconso_filename, non_umls_filename, voc_ids_filename):
    dtype = defaultdict(lambda: str, {'sab': "category"})
    names = ['cui', 'sab', 'code', 'str', 'tty']
    mrconso = pd.read_csv(mrconso_filename, dtype=dtype)[names]
    print("mrconso", len(mrconso))
    non_umls_ids = pd.read_csv(voc_ids_filename, dtype=dtype, header=None).set_index(0)[1]
    non_umls_names = ['voc_id', 'code', 'str', 'rel', 'umls_code', 'umls_sab', 'cui']
    non_umls = (
        pd.read_csv(non_umls_filename, names=non_umls_names, dtype=str)
        .assign(sab=lambda df: df.voc_id.replace(non_umls_ids))
        .assign(tty='unknown')
        [names]
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

[_, mrconso_filename, non_umls_filename, voc_ids_filename, out_filename] = sys.argv

table = make_table(mrconso_filename, non_umls_filename, voc_ids_filename)
table.to_csv(out_filename, index=False)
