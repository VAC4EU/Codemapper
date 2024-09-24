SUFFIX ?=

# A mapping from ICD10DA codes to any UMLS code
ICD10DA-codes$(SUFFIX).csv: ./ICD10DA-codes.py SKSComplete$(SUFFIX).txt ../mrconso.csv manual-mapped$(SUFFIX).csv ../../ohdsi-vocabulary/CONCEPT.csv
	python3 $^ unmapped.csv $@

ICD10DA$(SUFFIX).csv: ../link-cuis.py ICD10DA-codes$(SUFFIX).csv ../mrconso.csv
	python3 $^ $@

../umls-vocabularies.csv:
	make -C $(dir $@) $(not-dir $@)

# add the vocabulary id
ICD10DA_%.csv: ICD10DA.csv
	sed -e 's/^/$*,/' -e '1 s/^$*/voc_id/' $< > $@

SKSComplete.txt:
	curl -o $@ https://filer.sundhedsdata.dk/sks/data/skscomplete/SKScomplete.txt 

.PHONY: import
import: ICD10DA.csv
	cat $^ | sudo -u postgres psql codemapper_testing_20230410 \
	  -c "copy non_umls_codes (voc_id,code,term,cui,rel,mapped_code,mapped_sab) from stdin with (format csv, header);"
