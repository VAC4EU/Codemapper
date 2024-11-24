# CodeMapper

CodeMapper assists in the creation of code sets from case definitions, for several coding
systems simultaneously while keeping a record of the complete mapping process. Its
workflow is structured in three steps:

A [presentation](https://docs.google.com/presentation/d/1vo94NxADoJAMTQDbzK7QRDy9IvfMHZdBiyzdsqecJA0/edit?usp=sharing)
describes the concepts, and shows the user interface with a walk-through. More details
about the background, implementation, and effectiveness of the approach are documented in
our article:

> Becker BFH, Avillach P, Romio S, van Mulligen EM, Weibel D, Sturkenboom MCJM, Kors J:
> CodeMapper: Semi-automatic coding of case definitions. A contribution from the ADVANCE
> project. Pharmacoepidemiology and Drug Safety 2017. doi:10.1002/pds.4245
> ([link](http://onlinelibrary.wiley.com/doi/10.1002/pds.4245/full))

## Components

- `src/main/java`: backend (J2EE)
- `src/main/frontend/`: frontend (Angular)
- `AESI-import/`: normalization of mapping files in Excel format
- `non-umls/`: integration of non-UMLS coding systems
