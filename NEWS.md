
[//]: # (pandoc -i NEWS.md -o src/main/frontend/src/app/mapping/news-view/news-view.component.html)
   
<menu-banner>
  <!-- <mat-icon>notifications</mat-icon> -->
  CodeMapper: News
</menu-banner>

<section class="center-content">

Testing
-------

- import a mapping from a CSV file
- remap a mapping using the latest UMLS data
- download all mappings of a project
- rename mappings
- review on codes
- view, select and tag codes per coding system, and create custom codes
- view coding systems, and create custom coding systems
- integration of non-umls coding systems (ICD10DA, RCD2, MEDCODEID)
- complete overhaul of the user interface

October 4, 2023
----

- update UMLS to version 2023AA
- update SNOMED-CT transitive closures to version 202309

May 8, 2023
----

Logic change:

- exclude terms when their types are classified as obsolete, entry_term, or
  attribute in
  <https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/abbreviations.html#tty_class>

Bugfix:

- exclude unselected codes from download

Feature:

- include creation date in Excel download

April 10, 2023
----

- improved review functionality
- upgrade UMLS to version 2022AB, SNOMED-CT descendents to version 20230301

September 19, 2022
------------------

- faster retrieval of descendant codes for the other UMLS vocabularies
- bug fix: repeat codes for different tags in download

September 14, 2022
------------------

- faster and more reliable retrieval of descendant codes for SNOMED-CT

July 3, 2022
--------------

- update UMLS to version 2022AA
- optional download of descendant codes

June 10, 2022
--------------

- disabled descendant codes in download due to an server error in the SNOMED-CT API used by CodeMapper

May 1, 2022
--------------

Features

- include descendant codes when dowloading a mapping to a file (retrieved from the Snowstorm API for SNOMED-CT, and from the UMLS otherwise)
- download mappings as text file (tab-separated values/TSV)

Bug fixes

- descriptive message instead of error when creating the mapping before
  searching concepts

January 20, 2022
----------------

Feature

- (this) news page

Bug fix

- scroll only concepts grid, keep operation buttons and column headers

November 1, 2021
----------------

Bug fixes

- keep concept search constantly working
- prevent content trimming in embedding on vac4eu.org website
- sort projects and case definitions in overview
- avoid vertical scroll in mapping

October 19, 2021
----------------

Bug fix

- output each line of the textual case definition in an individual line during
  Excel export to obey limit on text size

April 2019
----------

Feature

- Administration interface

since 2019
----------

Development under the VAC4EU project.

2017
----

Published as

> Becker BFH, Avillach P, Romio S, van Mulligen EM, Weibel D, Sturkenboom MCJM,
> Kors J: CodeMapper: *Semi-automatic coding of case definitions. A contribution
> from the ADVANCE project.* Pharmacoepidemiology and Drug Safety 2017.
> <doi:10.1002/pds.4245>

2015 - 2018
-----------

Development under the IMI ADVANCE project at the Erasmus Medical Center,
Rotterdam.

</section>
