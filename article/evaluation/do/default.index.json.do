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

#!/usr/bin/env python3
import json, yaml
from pathlib import Path
import comap
import redo

def index(casedef):
    text = casedef['name'] + ' ' + casedef['definition']
    spans = comap.peregrine_index(text)
    for span in spans:
        span['cui'] = comap.cui_of_id(span['id'])
    return {
        'spans': spans,
    }

if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'case-definitions' / (event + '.yaml')) as f:
        casedef = yaml.load(f)

    result = index(casedef)

    with redo.output() as f:
        json.dump(result, f)
