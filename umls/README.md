# UMLS update

On a machine with graphical interface:

```shell

$ export UMLS_VERSION=2025AA
$ export API_KEY=...
$ make download
$ make subset
- Click "Install"
- Select output folder "$UMLS_VERSION-codemapper"
- Only Metathesaurus
- select properties "codemapper-mmsys.prop"
- check vocabularies
$ make tables
$ make db
$ make dumpsql
$ rsync -av $UMLS_VERSION/UMLS-$UMLS_VERSION.sql.gz $SERVER
```

On the server:

```shell
createdb UMLS-$UMLS_VERSION
gunzip -c UMLS-$UMLS_VERSION.sql.gz | psql UMLS-$UMLS_VERSION
```

Set `codemapper-umls-version=$UMLS_VERSION` and
`umls-db-uri=jdbc:.../umls-$UMLS_VERSION` in `code-mapper.properties` and
re-deploy.
