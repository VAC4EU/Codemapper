import sys
import polars as pl
from polars.testing import assert_frame_equal
from io import StringIO
from typing import NoReturn
import sys
import argparse
from vocs import medcodeid
from vocs import icd10da

CODES_COLS = ['code', 'term', 'rel', 'umls_sab', 'umls_code']
MANUAL_COLS = ['code', 'umls_sab', 'umls_code', 'cui']
MRCONSO_COLS = ['cui', 'sab', 'code']

RESULT_COLS = ['code', 'term', 'rel', 'umls_sab', 'umls_code', 'cui', 'criterion']
UNMAPPED_COLS = ['code', 'umls_sab', 'umls_code']

def die(*args) -> NoReturn:
    print(*args, file=sys.stderr)
    sys.exit(1)


def read_mrconso(filename: str) -> pl.DataFrame:
    return (
        pl.read_csv(filename, infer_schema=False)
        [MRCONSO_COLS]
        .filter(pl.col("code") != "NOCODE")
        .unique()
    )


def read_manual(filename: str | None) -> pl.DataFrame:
    if filename is not None:
        return (
            pl.read_csv(filename, infer_schema=False)
            [MANUAL_COLS]
        )
    else:
        schema = {col: pl.String for col in MANUAL_COLS}
        return pl.DataFrame(schema=schema)
    

def mrconso_filename(umls_version: str) -> str:
    return f"../umls/{umls_version}/mrconso-{umls_version}.csv"


def output_filename(umls_version: str, voc: str, voc_version: str) -> str:
    return f"output/{voc}-{voc_version}-{umls_version}.csv"


def gen(codes: pl.DataFrame, manual: pl.DataFrame, mrconso: pl.DataFrame) -> tuple[pl.DataFrame, pl.DataFrame]:
    manual = (
        manual
        .join(
            mrconso.rename({'cui': 'cui_mrconso'}),
            left_on=('umls_sab', 'umls_code'),
            right_on=('sab', 'code'),
            how='left',
            coalesce=True
        )
        ['code', 'umls_sab', 'umls_code', 'cui', 'cui_mrconso']
    )

    manual_no_cui = manual.filter(pl.col("cui_mrconso").is_null() & pl.col("cui").is_null())
    if len(manual_no_cui) > 0:
        print("!!! Manual mapping with invalid UMLS sab/code or CUI !!!") 
        print(manual_no_cui)

    joined = (
        codes
        .join(
            mrconso
            .rename({'cui': 'cui_mrconso'}),
            left_on=('umls_sab', 'umls_code'),
            right_on=('sab', 'code'),
            how='left',
            coalesce=True
        )
        ['code', 'term', 'rel', 'umls_sab', 'umls_code', 'cui_mrconso']
        .join(
            manual.rename(lambda col: col + '_manual'),
            left_on='code',
            right_on='code_manual',
            how='left',
            coalesce=True,
        )
    )

    code_sab_manual = pl.col("cui_manual").is_not_null() | pl.col("cui_mrconso_manual").is_not_null()
    joined = (
        joined
        ['code', 'term', 'rel', 'umls_sab', 'umls_code', 'cui_mrconso',
         'umls_sab_manual', 'umls_code_manual', 'cui_manual', 'cui_mrconso_manual' ]
        .rename({"umls_sab": "umls_sab_codes", "umls_code": "umls_code_codes"})
        .with_columns(
            cui = pl.coalesce("cui_manual", "cui_mrconso_manual", "cui_mrconso"),
            umls_sab = (pl.when(code_sab_manual)
                        .then(pl.col("umls_sab_manual"))
                        .otherwise(pl.col("umls_sab_codes"))),
            umls_code = (pl.when(code_sab_manual)
                         .then(pl.col("umls_code_manual"))
                         .otherwise(pl.col("umls_code_codes"))),
            criterion = pl.coalesce(
                pl.when(pl.col("cui_manual").is_not_null()).then(pl.lit("manual_cui")),
                pl.when(pl.col("cui_mrconso_manual").is_not_null()).then(pl.lit("manual_sab_code")),
                pl.lit("codes_sab_code")
            )
        )
    )

    unmapped = joined['cui'].is_null() | ~joined['rel'].is_in(['EQ', 'RN'])
    unmapped_res = (
        joined.filter(unmapped)
        [UNMAPPED_COLS]
        .unique()
    )
    res = (
        joined.filter(~unmapped)
        [RESULT_COLS]
    )
    # .sort(pl.col('code').cast(pl.Int64))
    return (res, unmapped_res)


def parse_args():
    if len(sys.argv) == 2 and sys.argv[1] == "run-test":
        return argparse.Namespace(run_tests=True)

    description = """Import non-UMLS vocabularies into a CodeMapper-compatible CSV format. If the first and only argument is `run-test` the tests are executed."""
    epilog = f"""Reads {mrconso_filename("UMLS_VERSION")}. Creates an output
    file at {output_filename("UMLS_VERSION", "VOC", "VOC_VERSION")}.
    """

    parser = argparse.ArgumentParser(description=description, epilog=epilog)
    parser.add_argument("--umls-version", help="UMLS version", required=True)
    parser.add_argument("--voc-version", type=int, help="vocabulary version", required=True)
    parser.add_argument("--manual", help="manual mappings", nargs='?')
    subparsers = parser.add_subparsers(dest="voc")
    subparsers.add_parser('MEDCODEID')
    icd10da = subparsers.add_parser('ICD10DA')
    icd10da.add_argument('--sks-complete', required=True)
    return parser.parse_args(namespace=argparse.Namespace(run_tests=False))


def read(args, mrconso):
    match args.voc:
        case "MEDCODEID":
            return medcodeid.read(args.voc_version)
        case "ICD10DA":
            return icd10da.read(args.sks_complete, mrconso)
        case _:
            die("unexpected subcommand")


def main():
    args = parse_args()
    if args.run_tests:
        run_tests()
        return
    manual = read_manual(args.manual)
    mrconso = read_mrconso(mrconso_filename(args.umls_version))
    codes = read(args, mrconso)[CODES_COLS]
    (res, unmapped) = gen(codes, manual, mrconso)
    filename = output_filename(args.umls_version, args.voc, args.voc_version)
    with open(filename, 'x') as file:
        res.write_csv(file, include_header=False)
    print(f"Written {len(res)} codes to {filename}.")
    if len(unmapped) > 0:
        unmapped_filename = filename.replace('.csv', '-unmapped.csv')
        unmapped.write_csv(unmapped_filename)
        print(f"Written {len(unmapped)} unmapped codes to {unmapped_filename}.")


def run_tests():
    print("Running tests")
    codes_csv = """
code,term,rel,umls_sab,umls_code
x1,in mrconso,EQ,V,v1
x2,unmapped,EQ,V,v2
x3,manual cui,EQ,V,v3
x4,manual sab code,EQ,V,v4
""".strip()
    mrconso_csv = """
sab,code,cui
V,v1,C1
V,v3,C222
V,v4,C333
W,w1,C3
""".strip()
    manual_csv = """
code,umls_sab,umls_code,cui
x3,,,C2
x4,W,w1,
x6,U,u1,
""".strip()
    res_csv = """
code,term,rel,umls_sab,umls_code,cui,criterion
x1,in mrconso,EQ,V,v1,C1,codes_sab_code
x3,manual cui,EQ,,,C2,manual_cui
x4,manual sab code,EQ,W,w1,C3,manual_sab_code
""".strip()
    unmapped_csv = """
code,umls_sab,umls_code
x2,V,v2
""".strip()

    mrconso = pl.read_csv(StringIO(mrconso_csv), infer_schema=False)[MRCONSO_COLS]
    codes = pl.read_csv(StringIO(codes_csv), infer_schema=False)[CODES_COLS]
    manual = pl.read_csv(StringIO(manual_csv), infer_schema=False)[MANUAL_COLS]

    (res, unmapped) = gen(codes, manual, mrconso)

    expected_res = pl.read_csv(StringIO(res_csv), infer_schema=False)[RESULT_COLS]
    expected_unmapped = pl.read_csv(StringIO(unmapped_csv), infer_schema=False)[UNMAPPED_COLS]

    print("mrconso", mrconso)
    print("codes", codes)
    print("manual", manual)

    print("res", res)
    assert_frame_equal(res, expected_res)

    print("unmapped", unmapped)
    assert_frame_equal(unmapped, expected_unmapped)

    print("Tests OK")


if __name__ == "__main__":
    main()
