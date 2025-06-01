#!/bin/bash

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

die() {
    echo $@ # >&2
    exit 1
}

SUBSET_DIR=$UMLS_VERSION-subset
CODEMAPPER_DIR=$UMLS_VERSION-codemapper
DBNAME=umls-$UMLS_VERSION

if [ -z "$UMLS_VERSION" ]; then
    die "UMLS_VERSION missing"
fi

if [ ! -n "${API_KEY+set}" ]; then
    API_KEY=$(cat api-key)
fi

download() {
    FILENAME=umls-$UMLS_VERSION-full.zip
    URL="https://download.nlm.nih.gov/umls/kss/$UMLS_VERSION/$FILENAME"
    curl -o "$FILENAME" "https://uts-ws.nlm.nih.gov/download?url=$URL&apiKey=$API_KEY"
    unzip "$FILENAME"
}

subset() {
    pushd $UMLS_VERSION-full
    unzip -o mmsys.zip
    jre/macos/bin/java  \
        -cp .:lib/jpf-boot.jar \
        -Dfile.encoding=UTF-8 -Xms1000M -Xmx2000M  \
        -Dscript_type=.sh \
        -Dunzip.native=true -Dunzip.path=/usr/bin/unzip \
        -Xdock:name=MetamorphoSys -Xdock:icon=config/icons/nlmlogo-small.gif \
        -Dapple.awt.fileDialogForDirectories=true -Dapple.laf.useScreenMenuBar=true \
        -Dmmsys.config.uri=../codemapper-mmsys.prop \
        org.java.plugin.boot.Boot
    popd
    mkdir -p $CODEMAPPER_DIR
    cp \
        $SUBSET_DIR/MRCONSO.RRF \
        $SUBSET_DIR/MRCUI.RRF \
        $SUBSET_DIR/MRDEF.RRF \
        $SUBSET_DIR/MRHIER.RRF \
        $SUBSET_DIR/MRREL.RRF \
        $SUBSET_DIR/MRSAB.RRF \
        $SUBSET_DIR/MRSTY.RRF \
      $CODEMAPPER_DIR
    echo "$PWD/$UMLS_VERSION-full and $PWD/$SUBSET_DIR are not needed anymore and can be removed to save space"
}

GRANTDB="
grant usage on schema public to codemapper;
grant select on all tables in schema public to codemapper;
"

createdb() {
    echo Create database \"$DBNAME\"
    echo "create database \"$DBNAME\";" | psql
    echo "$GRANTDB" | psql "$DBNAME"
}

populate() {
    echo
    echo LOAD TABLES
    dir=$(realpath $UMLS_VERSION-codemapper)
    sed "s|@META@|$dir|" ../src/main/resources/umls-tables.sql|psql "$DBNAME"
    echo
    echo CREATE INDEXES
    cat ../src/main/resources/umls-indexes.sql|psql "$DBNAME"
}

dumpsql() {
    pg_dump --no-owner "$DBNAME" | gzip > "$DBNAME.sql.gz"
}

# used in non-umls-vocabularies
mrconso() {
    psql $DBNAME -c \
         "COPY (SELECT DISTINCT cui, sab, code, str, lat, tty FROM mrconso ORDER BY sab, code) TO STDOUT DELIMITER ',' CSV HEADER" \
    > mrconso-$UMLS_VERSION.csv
}

subcommand=$1
shift 1

case "${subcommand:-}" in
    download)
        download "$@"
        ;;
    subset)
        subset "$@"
        ;;
    createdb)
        createdb "$@"
        ;;
    populate)
        populate "$@"
        ;;
    dumpsql)
        dumpsql "$@"
        ;;
    mrconso)
        mrconso "$@"
        ;;
    *)
        echo "Usage:"
        echo "1. download the UMLS distribution file"
        echo "2. create the CodeMapper subset of the UMLS"
        echo "3. create the SQL database and grant permissions to codemapper"
        echo "4. populate the SQL database with the CodeMapper subset"
        echo "5. dump the SQL database for transfer to the server"
        die "usage: $0 download|subset|createdb|populate|dumpsql -h"
        ;;
esac
