.PHONY: setup
setup:
	pip3 install -r requirements.txt

ORIGINAL = B_to_C_Sima

.PHONY: norm
norm: AESI-norm.py $(ORIGINAL)
	python3 $^ AESI-$@

.PHONY: dedup
dedup: AESI-dedup.py AESI-norm table.csv ../umls/2024AB/META/MRCUI.RRF
	python3 $^ AESI-$@

.PHONY: final
final: AESI-final.py AESI-norm/index.csv AESI-dedup
	python3 $^ AESI-$@

table.csv: table.py ../non-umls-vocabularies/mrconso.csv ../non-umls-vocabularies/export/non-umls.csv ../non-umls-vocabularies/export/ids.txt
	python3 $^ $@
