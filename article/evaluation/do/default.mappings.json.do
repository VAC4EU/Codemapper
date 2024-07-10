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
from pathlib import Path
import yaml, json
import redo
import comap
from data import Mappings, Mapping, Databases
from normalize import get_normalizer
import utils

logger = utils.get_logger(__name__)

def expand(codes, coding_system):
    codes_with_wildcards = {code for code in codes if 'x' in code}
    codes_without_wildcards = {code for code in codes if 'x' not in code}
    if not codes_with_wildcards:
        return codes
    else:
        query = "SELECT code FROM MRCONSO WHERE sab = %s AND (" +\
                " OR ".join(["code LIKE %s"] * len(codes_with_wildcards)) +\
                ")"
        codes_with_sql_wildcards = [
            c.replace('x', '_')
            for c in codes_with_wildcards
        ]
        with comap.get_umls_db().cursor() as cursor:
            cursor.execute(query, [coding_system] + codes_with_sql_wildcards)
            codes_expanded = set()
            for code, in cursor.fetchall():
                codes_expanded.add(code)
        return codes_without_wildcards | codes_expanded


def process(mappings, databases):
    result = Mappings()
    for event in mappings.events():
        mapping = mappings.get(event)
        result_mapping = Mapping()
        for database in databases.databases():
            logger.debug('Process {} {}'.format(database, event))
            coding_system = databases.coding_system(database)
            normalizer = get_normalizer(coding_system)
            codes = mapping.codes(database)
            if codes is None:
                result_mapping.add(database, None)
            else:
                codes1 = normalizer(codes)
                codes2 = expand(codes1, coding_system)
                result_mapping.add(database, codes2)
                logger.debug('Include: {}'.format(codes))
                if not (codes == codes1 == codes2):
                    logger.debug('Normalized: {}'.format(codes1))
                    logger.debug('Expanded: {}'.format(codes2))
            exclusion_codes = mapping.exclusion_codes(database)
            if exclusion_codes is None:
                result_mapping.add_exclusion(database, None)
            else:
                exclusion_codes1 = normalizer(exclusion_codes)
                exclusion_codes2 = expand(exclusion_codes1, coding_system)
                result_mapping.add_exclusion(database, exclusion_codes2)
                logger.debug('Exclude: {}'.format(exclusion_codes))
                if not (exclusion_codes == exclusion_codes1 == exclusion_codes2):
                    logger.debug('Normalized: {}'.format(exclusion_codes1))
                    logger.debug('Expande: {}'.format(exclusion_codes2))
        result.add(event, result_mapping)
    return result


if redo.running():

    project, = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        events = config['events']

    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings0 = Mappings.of_raw_data(yaml.load(f), events, databases)

    mappings = process(mappings0, databases)

    with redo.output() as f:
        json.dump(mappings.to_data(), f)
