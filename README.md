# ADVANCE CodeMapper

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

The CodeMapper web application uses Java servlet version 3.0.1, which requires Tomcat7.

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

##### Database UMLS-ext (optional)

The database `UMLS-ext` contains data complementary to the UMLS, such as the mapping from
Read CTv3 (`RCD`) to Read-v2 (`RCD2`). The original mapping files
(`nhs_datamigration_22.0.0_20161001000001`) are distributed by the Health and Social Care
Information Centre at [Digital NHS TRUD](https://isd.digital.nhs.uk/).

- Table `ctv3rctmap_uk` for mapping Read-CTv3 to Read-v2 from file
  `nhs_datamigration_22.0.0_20161001000001/Mapping Tables/Updated/Clinically Assured`

      CREATE TABLE `ctv3rctmap_uk_YYYMMDD` (`MAPID` varchar(38), `V2_CONCEPTID` varchar(5), `V2_TERMID` varchar(5), `CTV3_TERMID` varchar(5), `CTV3_TERMTYP` varchar(1), `CTV3_CONCEPTID` varchar(5), `USE_CTV3_TERMID` varchar(5), `STAT` varchar(1), `MAPTYP` varchar(3), `MAPSTATUS` int(11), `EFFECTIVEDATE` int(11), `ISASSURED` int(11)) ENGINE=InnoDB DEFAULT CHARSET=latin1;

      database=umls_ext
      file=ctv3rctmap_uk_YYYMMDD.txt
      mysqlimport --delete \
          --columns=$(head -n1 "$file"|sed "s/$(printf '\t')/,/g") \
          --ignore-lines=1 --lines-terminated-by='\r\n' \
          --local "$database" "$file"

- Table `Corev2` for Read-v2 labels from file `NHS-READv2-20.0.0/V2/Unified/Corev2.all`

      CREATE TABLE `Corev2` (`CODE` VARCHAR(5), `DESCRIPTION` VARCHAR(100), `C3` VARCHAR(100), `C4` VARCHAR(250), `C5` VARCHAR(20), `C6` INTEGER, `C7` VARCHAR(20), `C8` VARCHAR(2), `C9` VARCHAR(20), `C10` VARCHAR(2), `C11` VARCHAR(10), `C12` VARCHAR(2), `C13` VARCHAR(2));

  	  mysqlimport --delete \
          --columns=CODE,DESCRIPTION,C3,C4,C5,C6,C7,C8,C9,C10,C11,C12,C13 \
          --fields-enclosed-by='"' --fields-terminated-by=',' --lines-terminated-by='\r\n' \
          --local "$database" Corev2.all

## Management

The Python script [src/main/tools/manage.py](src/main/tools/manage.py) is used for
managing a running CodeMapper instance. It allows to 

- Create users
- Create projects
- Assign users to projects
- Copd and move mappings

Use `./manage.py --help` for a full description of functionality and options.

Several other scripts are available for post-processing mappings. Please refer to the
[src/main/tools/README.md](src/main/tools/README.md) for details.
