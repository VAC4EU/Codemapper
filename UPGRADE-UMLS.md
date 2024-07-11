# UMLS update procedure

The following steps are necessary to upgrade the UMLS version. The `$VERSION` in
these steps is a string `yyyyXX`, e.g. `2022aa`.

1. Download https://download.nlm.nih.gov/umls/kss/$VERSION/umls-$VERSION-metathesaurus.zip and extract, or
   ```
   read API_KEY
   VERSION=2023AA
   URL=https://download.nlm.nih.gov/umls/kss/$VERSION/umls-$VERSION-full.zip
   curl -OJ "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=URL"
   unzip umls-$VERSION-full.zip
   cd $VERSION-full
   unzip mmsys.zip
   # use mmsys to subset UMLS
   psql -c "create database UMLS$VERSION"
   sed 's|@META@|/path/to/umls/YEAR/META|' umls-tables.sql|psql UMLS$VERSION
   psql UMLS$VERSION < umls-indices.sql
   ```
2. 
2. Setup data
   ```
   unzip umls-$VERSION-full.zip $VERSION-full/'*'-meta.nlm
   cd $VERSION-full
   for f in *.nlm; unzip $f
   for table in MRCONSO MRREL; zcat $table.RRF.??.gz > $table.RRF
   for table in MRDEF MRSAB MRSTY; zcat $table.RRF.gz > $table.RRF
   UMLSMETA=$(pwd)
   ```
3. Add transitive closures for UMLS
   ```
   cd src/main/resources/umls-transitive-closure
   cargo run --release -- --mrconso $UMLSMETA/MRCONSO.RRF --mrrel $UMLSMETA/MRREL.RRF --sabs "$(cat sabs.txt)" --write-auis --output $UMLSMETA/TC.RRF
   ```
     <!-- (the vocabularies in `sabs.txt` should match those used with the `UmlsTCDescender` in `CodeMapperApplication`) -->
   <!-- - `sed "s!{{TRANSITIVE_CLOSURE}}!$TCRRF!" | psql $UMLSDB` -->
4. Create database
   ```sql
   -- CREATE USER codemapper WITH LOGIN;
   -- \password codemapper
   DB=umls$(echo $VERSION|tr '[:upper:]' '[:lower:]')
   sudo -u postgres psql -c "create database $DB"
   sudo -u postgres psql $DB < src/main/resources/umls-tables.sql
   ```
3. Copy RRF data into table, drop dummy column
   ```shell
   cd ~postgres
   import_table() {
       table=$1
       echo Import table $table ...
       cat | sudo -u postgres psql $DB \
           -c "\COPY $table FROM STDIN WITH DELIMITER AS '|' NULL AS '' CSV QUOTE AS E'\b' ESCAPE '\'"
       case "$table" in
         MR*) echo sudo -u postgres psql $DB \
                -c "ALTER TABLE $table DROP COLUMN dummy" ;;
       esac
   }
   for table in MRCONSO MRREL; ( zcat $UMLSMETA/$table.RRF.??.gz | import_table for )
   $table table in MRDEF MRSAB MRSTY TC; ( zcat $UMLSMETA/$table.RRF.gz | import_table $table )
   ```
   If certain lines have formatting problems and are dispensable: `sed -i '$d' $UMLSMETA/$table.RRF`
4. Create indices
   ```sql
   sudo -u postgres psql $DB < src/main/resources/umls-indexes.sql
   ```
7. Add transitive closures for SNOMED-CT
   ```
   cd comap/src/main/resources/snomedct-transitive-closure
   version=202309
   sudo -u postgres psql -c "create database snomedct_us_$version"
   sudo -u postgres psql -c "create database snomedct_spa_$version"

   # US
   VERSION=US1000124_20230901T120000Z
   URL=https://download.nlm.nih.gov/mlb/utsauth/USExt/SnomedCT_ManagedServiceUS_PRODUCTION_$VERSION.zip
   wget -O $(basename $URL) "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=$URL"

   # Spa
   VERSION=20230930T120000Z
   URL=https://download.nlm.nih.gov/umls/kss/IHTSDO2023/Spanish/SnomedCT_SpanishRelease-es_PRODUCTION_$VERSION.zip
   wget -O $(basename $URL) "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=$URL" 
   # https://github.com/WestCoastInformatics/SNOMED-CT-Transitive-Closure
   export CLASSPATH=.../SNOMEDCT-TRANSITIVE-CLOSURE/target/classes

   ./Single.sh SnomedCT_ManagedServiceUS_PRODUCTION_*.zip snomedct_us_$version
   ./International.sh SnomedCT_InternationalRF2_PRODUCTION_*.zip SnomedCT_SpanishRelease-es_PRODUCTION_*.zip snomedct_spa_$version
       ```
   
   - follow instructions in `src/main/resources/snomedct-transitive-closure/README.md`
7. 
```
   for db in $DB snomedct_us_$version snomedct_spa_$version; do
   sudo -u postgres psql -c "grant connect on database $db to codemapper"
   sudo -u postgres psql $db -c "grant usage on schema public to codemapper"
   sudo -u postgres psql $db -c "grant select on all tables in schema public to codemapper"
   done
```
8. Reflect the version update in the variables `codemapper-umls-version` and
   `umls-db-uri` in `code-mapper-*.properties`. This will result in an update of
   `src/main/resources/code-mapper.properties`.
9. Set permissions
   ```sql
   grant usage on schema public to codemapper;
   grant select on all tables in schema public to codemapper;
   ```
