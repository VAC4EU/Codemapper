POST {{URL}}/rest/authentification/login
Content-Type: application/x-www-form-urlencoded
`username={{USERNAME}}&password={{PASSWORD}}`
HTTP 200

GET {{URL}}/rest/authentification/user
HTTP 200
[Asserts]
jsonpath "$.username" == {{USERNAME}}

# UMLS version
GET {{URL}}/rest/code-mapper/server-info
HTTP 200
[Asserts]
jsonpath "$.umlsVersion" == "2025AA"

# Non-UMLS vocabularies included
GET {{URL}}/rest/code-mapper/coding-systems
HTTP 200
[Asserts]
jsonpath "$[*]" count > 100
jsonpath "$[*].abbreviation" contains "TEST"

# Non-UMLS codes included
GET {{URL}}/rest/code-mapper/autocomplete-code?str=333&codingSystem=TEST
HTTP 200
[Asserts]
jsonpath "$" count == 2
jsonpath "$[*].sourceConcepts[*].codingSystem" count == 4
jsonpath "$[0].sourceConcepts[0].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[1].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[2].codingSystem" == "TEST"
jsonpath "$[1].sourceConcepts[0].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[0].id" matches "^333"
jsonpath "$[0].sourceConcepts[1].id" matches "^333"
jsonpath "$[0].sourceConcepts[2].id" matches "^333"
jsonpath "$[1].sourceConcepts[0].id" matches "^333"

# Non-UMLS umls concepts
POST {{URL}}/rest/code-mapper/umls-concepts
Content-Type: application/x-www-form-urlencoded
`cuis=C0001122&codingSystems=TEST`
HTTP 200
[Asserts]
jsonpath "$[*]" count == 1
jsonpath "$[0].cui" == "C0001122"
jsonpath "$[0].sourceConcepts" count == 1
jsonpath "$[0].sourceConcepts[0].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[0].cui" == "C0001122"
jsonpath "$[0].sourceConcepts[0].id" == "30"

# Non-umls descendants (by concept)
GET {{URL}}/rest/code-mapper/descendants?codingSystem=TEST&codes=30
HTTP 200
[Asserts]
jsonpath "$[*]" count == 1
jsonpath "$[*]" count == 1
jsonpath "$['30']" count == 2
jsonpath "$['30'][1].id" == "32"
jsonpath "$['30'][0].id" == "31"

# UMLS narrower
POST {{URL}}/rest/code-mapper/narrower-concepts
Content-Type: application/x-www-form-urlencoded
`codingSystems=ICD10CM&cuis=C2889165`
HTTP 200
[Asserts]
jsonpath "$[*]" count == 9
jsonpath "$[0].sourceConcepts[0].id" == "M05.2"
jsonpath "$[0].sourceConcepts[1].id" == "M05.20"
jsonpath "$[1].sourceConcepts[0].id" == "M05.21"
jsonpath "$[2].sourceConcepts[0].id" == "M05.22"
jsonpath "$[3].sourceConcepts[0].id" == "M05.23"
jsonpath "$[4].sourceConcepts[0].id" == "M05.24"
jsonpath "$[5].sourceConcepts[0].id" == "M05.25"
jsonpath "$[6].sourceConcepts[0].id" == "M05.26"
jsonpath "$[7].sourceConcepts[0].id" == "M05.27"
jsonpath "$[8].sourceConcepts[0].id" == "M05.29"

# UMLS descendants
GET {{URL}}/rest/code-mapper/descendants?codingSystem=ICD10CM&codes=M05.2
Content-Type: application/x-www-form-urlencoded
`codingSystem=ICD10CM&codes=M05.2`
HTTP 200
[Asserts]
jsonpath "$['M05.2'][*]" count == 30
jsonpath "$['M05.2'][0].id"  == "M05.20"
jsonpath "$['M05.2'][1].id"  == "M05.21"
jsonpath "$['M05.2'][2].id"  == "M05.211"
jsonpath "$['M05.2'][3].id"  == "M05.212"
jsonpath "$['M05.2'][4].id"  == "M05.219"
jsonpath "$['M05.2'][5].id"  == "M05.22"
jsonpath "$['M05.2'][6].id"  == "M05.221"
jsonpath "$['M05.2'][7].id"  == "M05.222"
jsonpath "$['M05.2'][8].id"  == "M05.229"
jsonpath "$['M05.2'][9].id"  == "M05.23"
jsonpath "$['M05.2'][10].id" == "M05.231"
jsonpath "$['M05.2'][11].id" == "M05.232"
jsonpath "$['M05.2'][12].id" == "M05.239"
jsonpath "$['M05.2'][13].id" == "M05.24"
jsonpath "$['M05.2'][14].id" == "M05.241"
jsonpath "$['M05.2'][15].id" == "M05.242"
jsonpath "$['M05.2'][16].id" == "M05.249"
jsonpath "$['M05.2'][17].id" == "M05.25"
jsonpath "$['M05.2'][18].id" == "M05.251"
jsonpath "$['M05.2'][19].id" == "M05.252"
jsonpath "$['M05.2'][20].id" == "M05.259"
jsonpath "$['M05.2'][21].id" == "M05.26"
jsonpath "$['M05.2'][22].id" == "M05.261"
jsonpath "$['M05.2'][23].id" == "M05.262"
jsonpath "$['M05.2'][24].id" == "M05.269"
jsonpath "$['M05.2'][25].id" == "M05.27"
jsonpath "$['M05.2'][26].id" == "M05.271"
jsonpath "$['M05.2'][27].id" == "M05.272"
jsonpath "$['M05.2'][28].id" == "M05.279"
jsonpath "$['M05.2'][29].id" == "M05.29"

POST {{URL}}/rest/code-mapper/umls-concepts
Content-Type: application/x-www-form-urlencoded
`codingSystems=ICD10CM&cuis=C2889165`
HTTP 200
[Asserts]
jsonpath "$[*]" count == 1
jsonpath "$[0].cui" == "C2889165"
jsonpath "$[0].preferredName" == "Rheumatoid vasculitis with rheumatoid arthritis of unspecified site"
jsonpath "$[0].sourceConcepts[*]" count == 2
jsonpath "$[0].sourceConcepts[0].id" == "M05.2"
jsonpath "$[0].sourceConcepts[0].codingSystem" == "ICD10CM"
jsonpath "$[0].sourceConcepts[1].id" == "M05.20"
jsonpath "$[0].sourceConcepts[1].codingSystem" == "ICD10CM"

GET {{URL}}/rest/code-mapper/autocomplete-code?str=M05.2
HTTP 200
[Asserts]
jsonpath "$[*]" count == 14
jsonpath "$[0].cui" == "C2889165"
