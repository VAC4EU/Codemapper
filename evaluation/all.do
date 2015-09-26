# -*- mode: sh -*-

export PYTHONPATH=$PWD/lib
export COMAP_PROJECT=safeguard
redo-ifchange $COMAP_PROJECT.evaluations.xls $COMAP_PROJECT.evaluations.csv $COMAP_PROJECT.code-stats.csv
ipython nbconvert --execute --to pdf --output "CoMap evaluation - $COMAP_PROJECT" \
        "lib/CoMap evaluation.ipynb"
