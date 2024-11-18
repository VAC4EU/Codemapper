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
    ./run_$(host).sh
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

grantdb() {
    echo $# -- ${1:-}
    if [ $# -ne 1 -o "${1:-}" = "-h" ]; then
        die "usage: $0 grantdb dbname"
    fi
    DBNAME=$1
    echo "$GRANTDB" | psql "$DBNAME"
}

populate() {
    if [ $# -ne 1 -o "${1:-}" = "-h" ]; then
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

subcommand=$1
shift 1

case "$subcommand" in
    download)
        download "$@"
        ;;
    subset)
        subset "$@"
        ;;
    grantdb)
        grantdb "$@"
        ;;
    populate)
        populate "$@"
        ;;
    zipumls)
        zipumls "$@"
        ;;
    *)
        die "usage: $command download|subset|populate -h"
        ;;
esac
