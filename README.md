# CodeMapper

CodeMapper assists in the creation of code sets from case definitions, for
several coding systems simultaneously while keeping a record of the complete
mapping process. More
details about the background, implementation, and effectiveness of the approach
are documented in our article:

> Becker BFH, Avillach P, Romio S, van Mulligen EM, Weibel D, Sturkenboom MCJM, Kors J:
> CodeMapper: Semi-automatic coding of case definitions. A contribution from the ADVANCE
> project. Pharmacoepidemiology and Drug Safety 2017. doi:10.1002/pds.4245
> ([link](http://onlinelibrary.wiley.com/doi/10.1002/pds.4245/full))

## Deployment

CodeMapper is available at <https://app.vac4eu.org/codemapper/>.

## Components

- `src/main/java`: backend (J2EE)
- `src/main/frontend/`: frontend (Angular)
- `AESI-import/`: normalization of mapping files in Excel format
- `non-umls/`: integration of non-UMLS coding systems
