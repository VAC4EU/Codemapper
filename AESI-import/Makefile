
.PHONY: norm
norm: AESI-norm.py AESI
	python3 $^ AESI-$@

.PHONY: dedup
dedup: AESI-dedup.py AESI-norm table.csv ../umls/2024AA/META/MRCUI.RRF
	python3 $^ AESI-$@

.PHONY: final
final: AESI-final.py AESI-norm/index.csv AESI-dedup
	python3 $^ AESI-$@

table.csv: table.py ../non-umls-vocabularies/mrconso.csv ../non-umls-vocabularies/export/non-umls.csv ../non-umls-vocabularies/export/ids.txt
	python3 $^ $@
