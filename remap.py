import sys
import pandas as pd
import psycopg2
import psycopg2.extras
from collections import namedtuple
from unidecode import unidecode

input_filename = sys.argv[1]
output_filename = sys.argv[2]

IGNORE_TTYS = set("AA,AD,AM,AS,AT,CE,EP,ES,ETAL,ETCF,ETCLIN,ET,EX,GT,IS,IT,LLTJKN1,LLTJKN,LLT,LO,MP,MTH_ET,MTH_IS,MTH_LLT,MTH_LO,MTH_OAF,MTH_OAP,MTH_OAS,MTH_OET,MTH_OET,MTH_OF,MTH_OL,MTH_OL,MTH_OPN,MTH_OP,OAF,OAM,OAM,OAP,OAS,OA,OET,OET,OF,OLC,OLG,OLJKN1,OLJKN1,OLJKN,OLJKN,OL,OL,OM,OM,ONP,OOSN,OPN,OP,PCE,PEP,PHENO_ET,PQ,PXQ,PXQ,SCALE,TQ,XQ".split(","))

def remap(cursor, cuis, sabs):
    query = f"""
    SELECT DISTINCT cui, sab, code, str, tty
    FROM MRCONSO
    WHERE cui = ANY(%s)
    AND sab = ANY(%s)
    AND suppress != 'Y'
    AND tty != ANY(%s)
    ORDER BY cui, sab, code, str
    """
    cursor.execute(query, (list(cuis), list(sabs), list(IGNORE_TTYS)))
    return pd.DataFrame(cursor.fetchall())

def rcd3_to_rcd2(cursor, codes):
    if not codes:
        return {}
    query = f"""
    select ctv3_conceptid, v2_conceptid
    from ctv3rctmap_uk_20161001
    where ctv3_conceptid = any(%s)
    and maptyp != 'n'
    and mapstatus = 1
    and isassured = 1
    and v2_conceptid not in ('_DRUG', '_NONE')
    order by ctv3_conceptid
    """
    cursor.execute(query, (list(codes), ))
    return pd.DataFrame(cursor.fetchall())

data = pd.read_csv(input_filename, dtype=str)

conn = psycopg2.connect(database="umls2023aa")   
conn_rcd = psycopg2.connect(database="umls-ext-mappings")   

with conn_rcd.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor_rcd:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
        sabs = set(data['coding_system']) | set(['RCD'])
        cuis = set(data['concept'].dropna())

        rows = remap(cursor, cuis, sabs)
        print(rows.head())

        ctv3 = rows[rows.sab == 'RCD'].code.drop_duplicates()
        print(len(ctv3))
        v2 = rcd3_to_rcd2(cursor_rcd, list(ctv3))
        print(v2.head())

        rows = (
            rows[rows.sab == 'RCD']
            .merge(v2, how='inner', left_on='code', right_on='ctv3_conceptid')
            .assign(sab='RCD2')
            .drop(['code', 'ctv3_conceptid'], axis=1)
            .rename({'v2_conceptid': 'code'}, axis=1)
        )
        print(rows.head())

        data.groupby('event_definition')

# {event: {cui: list(row)}}
missing = {}
for (event, event_group) in data.groupby('event_definition'):
    for (cui, cui_group) in event_group.groupby('concept'):
        for r in rows[rows.cui == cui]:
