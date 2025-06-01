# UMLS update

On a machine with graphical interface:

```shell
export UMLS_VERSION=2025AA
umls/migrate.sh download
umls/migrate.sh subset
umls/migrate.sh createdb
umls/migrate.sh populate
umls/migrate.sh dumpsql
rsync -av umls-$UMLS_VERSION.sql.gz $SERVER
```

On the server:

```shell
umls/migrate.sh createdb
gunzip -c umls-$UMLS_VERSION.sql.gz | psql umls-$UMLS_VERSION
```

Set `codemapper-umls-version=$UMLS_VERSION` and
`umls-db-uri=jdbc:.../umls-$UMLS_VERSION` in `code-mapper.properties` and
re-deploy.
