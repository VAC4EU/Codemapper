# Integrate non-UMLS with CodeMapper

Requirement:

- https://docs.astral.sh/uv/guides/install-python/
- `../umls/${UMLS_VERSION}/mrconso-${UMLS_VERSION}.csv`
- `resources/CPRD/CPRD_CodeBrowser_${CPRD_VERSION}_Aurum/CPRDAurumMedical.txt`

```shell
$ uv run non-umls.py --umls 2025AB MEDCODEID --voc-version 202506
```

Creates

- output/MEDCODEID-202506-2025AB.csv

Use `SELECT non_umls_import_csv(7, 'path/to/output/MEDCODEID-202506-2025AB.csv');`
from `non-umls.sql` to import into the database.
