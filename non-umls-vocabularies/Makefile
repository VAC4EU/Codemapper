UMLSVERSION=umls2024ab

.PHONY: mrconso.csv
mrconso.csv:
	psql $(UMLSVERSION) \
	  -c "COPY (SELECT DISTINCT cui, sab, code, str, lat, tty FROM mrconso ORDER BY sab, code) TO STDOUT DELIMITER ',' CSV HEADER" \
	  > $@

VOCS = ICD10DA MEDCODEID RCD2 ICDO3
EXPORTS = $(addprefix export/, $(addsuffix .csv, $(VOCS)))

export/non-umls.csv: $(EXPORTS)
	cat $^ > $@
	cat $^|gsed 's/,exact term\|,ICD10AM without M\|,code reference//' > $@

.SECONDEXPANSION:
$(EXPORTS): export/%.csv: $$*/$$*.csv export/ids.txt
	ID=$(shell grep "$*" export/ids.txt|cut -d, -f1); \
	tail -n+2 $< | sed -e "s/^/$${ID},/" > $@

.PHONY:
import: export/non-umls.csv
	psql codemapper -c "COPY non_umls_codes (voc_id,code,term,rel,umls_code,umls_sab,cui,criterion) FROM STDIN with (format csv);" < $<
