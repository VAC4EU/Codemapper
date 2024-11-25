
## Show residuals

I.e. false negative codes that are in UMLS and inclusion codes.

(needs jq >=1.5)

    jq 'map_values(map_values(map_values(.error_analysis.fn_inclusion_in_umls)))' safeguard.evaluations.json
