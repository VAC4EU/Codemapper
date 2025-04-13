.PHONY: default
default: norm dedup final

CODELISTS ?= codelists
RESULTS ?= results

.PHONY: setup
setup:
	pip3 install -r requirements.txt

NAME ?= B_to_C_Sima

.PHONY: norm
norm: AESI-norm.py $(CODELISTS)/$(NAME)
	mkdir -p $(RESULTS)/$(NAME)/$@
	python3 $^ $(RESULTS)/$(NAME)/$@

.PHONY: dedup
dedup: AESI-dedup.py $(RESULTS)/$(NAME)/norm table.csv.parquet ../umls/2024AB/META/MRCUI.RRF
	mkdir -p $(RESULTS)/$(NAME)/$@
	python3 $^ $(RESULTS)/$(NAME)/$@

.PHONY: final
final: AESI-final.py $(RESULTS)/$(NAME)/norm/index.csv $(RESULTS)/$(NAME)/dedup
	mkdir -p $(RESULTS)/$(NAME)/$@
	python3 $^ $(RESULTS)/$(NAME)/$@

table.csv table.csv.parquet: table.py ../non-umls-vocabularies/mrconso.csv ../non-umls-vocabularies/export/non-umls.csv
	python3 $^ $@
