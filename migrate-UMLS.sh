#!/bin/sh

set -euo pipefail

die() {
    echo $@ # >&2
    exit 1
}

download() {
    if [ -z "$API_KEY" ]; then
        die "API_KEY missing"
    fi
    if [ $# -ne 1 -o "${1:-}" = "-h" ]; then
        die "usage: $0 download UMLSVERSION"
    fi
    VERSION=$0
    URL="https://download.nlm.nih.gov/umls/kss/$VERSION/umls-$VERSION-full.zip"
    curl -OJ "https://uts-ws.nlm.nih.gov/download?url=$URL&apiKey=$API_KEY"
    unzip "umls-$VERSION-full.zip"
}

subset() {
    if [ $# -ne 2 -o "${1:-}" = "-h" ]; then
        die "usage: $0 subset UMLSVERSION path/to/UMLS/VERSION-full"
    fi
    VERSION=$1
    DIR=$2
    cd "$DIR"
    unzip -o mmsys.zip
    echo "Now create the UMLS subset using 'umls/uts-umls.prop'"

    # ./run_$(host).sh

    METADIR=/d1/UMLS
    DESTDIR=/d1/UMLS/METASUBSET
    MMSYS_HOME=/d1/UMLS/MMSYS
    CLASSPATH=${MMSYS_HOME}:$MMSYS_HOME/lib/jpf-boot.jar
    JAVA_HOME=$MMSYS_HOME/jre/linux
    CONFIG_FILE=/d1/umls/config.properties
    export METADIR
    export DESTDIR
    export MMSYS_HOME
    export CLASSPATH
    export JAVA_HOME
    cd $MMSYS_HOME
    $JAVA_HOME/bin/java \
        -Djava.awt.headless=true \
        -Djpf.boot.config=$MMSYS_HOME/etc/subset.boot.properties \
        -Dlog4j.configuration=$MMSYS_HOME/etc/subset.log4j.properties \
        -Dinput.uri=$METADIR \
        -Doutput.uri=$DESTDIR \
        -Dmmsys.config.uri=$CONFIG_FILE \
        -Xms300M \
        -Xmx1000M \
        org.java.plugin.boot.Boot
}

FILES=(MRCONSO MRDEF MRHIER MRSAB MRSTY MRCUI)

zipumls() {
    ZIP=$(realpath $(dirname "$1"))/$(basename "$1")
    DIR="$2"
    cd $(dirname "$DIR")
    files=(${FILES[@]/#/$(basename "$DIR")/META/})
    files=(${files[@]/%/.RRF})
    zip -o "$ZIP" "${files[@]}"
}

GRANTDB="
grant connect to codemapper;
grant usage on schema public to codemapper;
grant select on all tables in schema public to codemapper;
"

createdb() {
    echo $# -- ${1:-}
    if [ $# -ne 1 -o "${1:-}" = "-h" ]; then
        die "usage: $0 createdb dbname"
    fi
    DBNAME=$1
    echo "create database '$GRANTDB';" | psql
    echo "$GRANTDB" | psql "$DBNAME"
}

populate() {
    if [ $# -ne 2 -o "${1:-}" = "-h" ]; then
        die "usage: $0 populate dbname path/to/UMLS/VERSION-codemapper"
    fi
    DBNAME=$1
    UMLSDIR=2
    echo
    echo CREATE AND FILL TABLES
    sed "s|@META@|$UMLSDIR/META|" umls-tables.sql|psql umlsXXXX
    echo
    echo CREATE INDEXES
    cat umls-indexes.sql|psql umlsXXXX
}

dumpsql() {
    if [ $# -ne 2 -o "${1:-}" = "-h" ]; then
        die "usage: $0 dumpsql dbname path/to/umls-version.sql.gz"
    fi
    DBNAME=$1
    FILE=$2
    pg_dump --no-owner "$DBNAME" | gzip > "$FILE"

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
