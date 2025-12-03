import polars as pl

def read_fwf(filename: str, cols: list[tuple[str, tuple[int, int]]]) -> pl.DataFrame:
    with open(filename, encoding='iso-8859-1') as f:
        full_str = pl.Series('full_str', f.readlines())
    return (
        pl.DataFrame([
            full_str
            .str.slice(start, length)
            .str.strip_chars_end()
            .alias(name)
            for (name, (start, length)) in cols
        ])
    )

indexes = [0, 4, 23, 31, 39, 47, 179, 187, 214]
lengths = (j-i for (i, j) in zip(indexes[:-1], indexes[1:]))
prefix_ixs, code_ixs, date1_ixs, _, _, term_ixs, _, _ = zip(indexes[:-1], lengths)
sks_cols = [
    ('prefix', prefix_ixs),
    ('code', code_ixs),
    ('start_date', date1_ixs),
    ('term', term_ixs),
]

is_non_empty = pl.col('code').str.len_chars() > 1
is_diagnosis = pl.col('prefix') == 'diaD'
is_custom = pl.col('code').str.starts_with('U')
code_dot = pl.concat_str([
    pl.col('code').str.slice(0,3),
    pl.lit('.'),
    pl.col('code').str.slice(3),
])

def read(sks_complete: str, mrconso: pl.DataFrame):
    df = (
        read_fwf(sks_complete, sks_cols)
        .filter(is_non_empty & is_diagnosis & ~is_custom)
        .drop('prefix')
        .unique('code', keep='last')
        .with_columns(code_dot=code_dot)
    )
    # icd10 = mrconso.filter(pl.col("sab") == "ICD10")["code", "str"]
    # icd10cm = mrconso.filter(pl.col("sab") == "ICD10CM")["code", "str"]

    return df
