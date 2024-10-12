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

## Installation

The installation of CodeMapper requires two Java web applications which can be deployed on
a java web application server like Tomcat (version 7 is required by CodeMapper). Note that
the use of Peregrine requires at least 5GB RAM.

### Peregrine

The war file and the ontology file can be requested from the authors. Peregrine is
configured by its parameters in the file `WEB-INF/web.xml`. The path of the ontology file
is read from parameter `ontology.file`, and the path of the properties file of the LVG
installation (part of the UMLS) is read from parameter `lvg.properties.filename`.

Peregrine is only required for the automatic indexing of case definitions in the first tab
of the application. Concepts can be added in the second tab without Peregrine.

Peregrine can deployed with jetty to control its memory consumptions and to separate its
runtime from the other webapps by using the following command:

    JETTY_VERSION=7.6.9.v20130131
    UMLS_VERSION=2014AB
    PEREGRINE_VERSION=2.0.2
    java -Xmx5000m -jar jetty-runner-${JETTY_VERSION}.jar --port 8081 --log yyyy_mm_dd-requests.log --out yyyy_mm_dd-output.log --path UMLS${UMLS_VERSION}_ADVANCE UMLS${UMLS_VERSION}_ADVANCE\#\#${PEREGRINE_VERSION}.war

### CodeMapper

#### Configuration

CodeMapper reads its configuration from the file
[src/main/resources/code-mapper.properties](src/main/resources/code-mapper.properties) (in
`WEB-INF/classes` in the war file). Please edit after installation of Peregrine and
creation of the databases accordingly.

#### Compilation

Building CodeMapper requires `maven3`. Then just run

    mvn package

and the war-file will be build in directory `target`.

All properties required to initialise database connections and external APIs are
read from a properties file.

There are three profiles, which determine the final name of the `.war` file and
the properties file:

| Profile       | Final name         | Properties                       |   |
|---------------|--------------------|----------------------------------|---|
| dev (default) | codemappper-dev    | codemapper-dev.properties        |   |
| testing       | codemapper-testing | codemapper-production.properties |   |
| production    | codemapper         | codemapper-production.properties |   |

While running, CodeMapper is configured to print debugging information to
`${sys:catalina.base}/logs/code-mapper.log`, i.e.,
`/var/log/tomcat*/code-mapper.log`.

#### Requirements

The CodeMapper web application uses Java servlet version 3.0.1, which requires Tomcat7.

CodeMapper requires to run tomcat using Java 8, otherwise it will fail to authenticate
with the UMLS API due to unsupported certificate protocols.

#### Databases

CodeMapper uses three databases:

##### UMLS

1. Download the UMLS from <https://uts.nlm.nih.gov> using your UMLS license.
2. Use Metamorphosis (included in the download) to generate a subset of the UMLS.
3. Load the UMLS data into the database using the generated MySQL scripts.

##### CodeMapper

CodeMapper requires a database for storing the mappings, workspaces and users. The
databases can be created using the script
[src/main/resources/user-tables.sql](src/main/resources/user-tables.sql).

## External services

Access to the external service Snowstorm and UTS are configured through the
`.properties` file.