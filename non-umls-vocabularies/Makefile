UMLSVERSION=umls2024ab

.PHONY: mrconso.csv
mrconso.csv:
	psql $(UMLSVERSION) \
	  -c "COPY (SELECT DISTINCT cui, sab, code, str, lat, tty FROM mrconso ORDER BY sab, code) TO STDOUT DELIMITER ',' CSV HEADER" \
	  > $@

.PHONY: export/non-umls.csv
export/non-umls.csv:
	psql -h 127.0.0.1 -U codemapper -W codemapper \
	  -c "COPY (SELECT * FROM non_umls_latest_codes) TO STDOUT WITH CSV HEADER" \
	  > $@

VOCS = ICD10DA MEDCODEID RCD2 ICDO3
EXPORTS = $(addprefix export/, $(addsuffix .csv, $(VOCS)))


.SECONDEXPANSION:
$(EXPORTS): export/%.csv: $$*/$$*.csv export/ids.txt
	ID=$(shell grep "$*" export/ids.txt|cut -d, -f1); \
	tail -n+2 $< | sed -e "s/^/$${ID},/" > $@

.PHONY:
import: export/non-umls.csv
	psql codemapper -c "COPY non_umls_codes (voc_id,code,term,rel,umls_code,umls_sab,cui,criterion) FROM STDIN with (format csv);" < $<
