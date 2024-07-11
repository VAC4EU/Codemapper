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
import os
import json, yaml
from data import Mappings, Dnf, Databases, Cosynonyms
from utils import get_logger
import redo

logger = get_logger(__name__)

def dnf_of_cosynonyms(cosynonyms):
    """
    Just a test for Dnf.of_cosynonyms
    >>> cosynonyms = {
    ...     'A': {
    ...         'V1': {'C1', 'C2', 'C5'},
    ...         'V2': {'C3', 'C4'},
    ...     },
    ...     'B': {
    ...         'V1': {'C1', 'C3', 'C5'},
    ...         'V2': {'C3'},
    ...     }
    ... }
    >>> dnf = {
    ...     frozenset({'A', 'B'}): {
    ...         'V1': {'C1', 'C5'},
    ...         'V2': {'C3'}
    ...     },
    ...     frozenset({'A'}): {
    ...         'V1': {'C2'},
    ...         'V2': {'C4'},
    ...     },
    ...     frozenset({'B'}): {
    ...         'V1': {'C3'},
    ...     }
    ... }
    >>> dnf_of_cosynonyms(cosynonyms).disjunction() == dnf
    True
    """
    return Dnf.of_cosynonyms(cosynonyms)




if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        events = config['events']

    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))
        mapping = mappings.get(event)

    with redo.ifchange('{}.{}.cosynonyms.json'.format(project, event)) as f:
        cosynonyms = Cosynonyms.of_data(json.load(f))

    dnf = cosynonyms.to_dnf()
    assert cosynonyms.equals(dnf.to_cosynonyms()) # Just checking ...

    with redo.output() as f:
        json.dump(dnf.to_data(), f)

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(report=True)
