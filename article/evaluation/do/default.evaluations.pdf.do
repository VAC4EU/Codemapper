# Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
# 
# This program shall be referenced as “Codemapper”.
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

# -*- mode: sh -*-
path=$(dirname $1)
export PYTHONPATH=$path/lib
export COMAP_PROJECT=$(basename $2)
target_variation="3-RN-CHD-RB-PAR.expand"

redo-ifchange "$path/$COMAP_PROJECT.$target_variation.error-analyses.yaml" \
              "$path/$COMAP_PROJECT.types-distrs.json" \
              "$path/$COMAP_PROJECT.evaluations.csv" \
              "$path/$COMAP_PROJECT.code-stats.csv"

dir=$(mktemp -d "$COMAP_PROJECT.evaluation.XXXXX")
jupyter-nbconvert --execute --to pdf --output "$dir/evaluation" "$path/lib/CoMap evaluation.ipynb"

mv "$dir/evaluation.pdf" $3
echo rm -rf "$dir"


