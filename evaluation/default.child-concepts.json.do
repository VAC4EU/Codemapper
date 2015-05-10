#!/usr/bin/env python3

import json
import yaml
import comap
import redo

(project, outcome_id) = redo.base.split('.')

with redo.ifchange(semantic_types='config/semantic_types.yaml',
                   coding_systems='config/coding_systems.yaml',
                   concepts=redo.base + '.concepts.json') as files:
    coding_systems = yaml.load(files['coding_systems'])
    semantic_types = yaml.load(files['semantic_types'])
    concepts = json.load(files['concepts'])

cuis = [c['cui'] for c in concepts]

client = comap.ComapClient()

hyponyms_by_cui = client.hyponyms(cuis, coding_systems)

with redo.output() as f:
    json.dump(hyponyms_by_cui, f)