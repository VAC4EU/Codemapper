.PHONY: default
default: norm dedup final

.PHONY: setup
setup:
	pip3 install -r requirements.txt

NAME ?= B_to_C_Sima

.PHONY: norm
norm: AESI-norm.py codelist-sets/$(NAME)
	mkdir -p results/$(NAME)-$@
	python3 $^ results/$(NAME)-$@

.PHONY: dedup
dedup: AESI-dedup.py results/$(NAME)-norm table.csv ../umls/2024AB/META/MRCUI.RRF
	mkdir -p results/$(NAME)-$@
	python3 $^ results/$(NAME)-$@

.PHONY: final
final: AESI-final.py results/$(NAME)-norm/index.csv results/$(NAME)-dedup
	mkdir -p results/$(NAME)-$@
	python3 $^ results/$(NAME)-$@

table.csv: table.py ../non-umls-vocabularies/mrconso.csv ../non-umls-vocabularies/export/non-umls.csv ../non-umls-vocabularies/export/ids.txt
	python3 $^ $@
