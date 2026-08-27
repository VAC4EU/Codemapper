export interface EdfTemplate {
  name: string;
  content: string;
}

export const EDF_TEMPLATES: EdfTemplate[] = [
  {
    name: 'None',
    content: '',
  },
  {
    name: 'Clinical event/medical condition',
    content: `## Clinical Definition

## Synonyms

_(lay terms or acronyms for the event)_

## What must be excluded

_(Explicitly describe conditions, diagnoses, subtypes, historical conditions, suspected cases, sequelae, or related disorders that should not be included in the event definition. Clearly explain the rationale for each exclusion.)_

## Differential Diagnosis

_(Lists conditions that may be clinically confused with the target condition and must be excluded from the list.)_

## Candidate Codes

_(e.g., ICD10CM, SNOMED CT, or codelists from existing Phenotype libraries, e.g, Sentinel, DARWIN)_

## Algorithm Proposal (if applicable)

_(If this event/condition is part of an algorithm, describe the proposed algorithm, including any code combinations, temporal criteria, laboratory tests, procedures, medications, or other logic required to show how this codelist relates to that algorithm)_
`,
  },
  {
    name: 'Medicinal product',
    content: `## Active substance of interest

_(Indicate whether the definition applies to the drug alone, or in combination with other products)_
    
## Therapeutic areas

_(Please specify whether it refers to a single therapeutic area or multiple therapeutic areas)_

## Route of administration
_(Specify the route(s) of administration, e.g., oral, intravenous, subcutaneous. If this is not applicable, just state "Any")_

## Strength

_(Please indicate whether specific strengths or dose ranges are intended to identify particular therapeutic indications (e.g., low-dose aspirin for prophylactic cardiovascular disease (<300 mg) versus high-dose aspirin for anti-inflammatory use (>300 mg)). If not applicable, state "Any")_
: Doses are relevant only for PRODCODEIDs

## What must be excluded

_(Explicitly define products that may contain the active substance that should NOT be included in the phenotype; including exclusions based on dose/strength, route of administration, combination therapy, or intended indication.)_`,
  },
];
