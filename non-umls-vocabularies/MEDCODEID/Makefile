
MEDCODEID-codes.csv: MEDCODEID-codes.py
	python3 $^ $@

MEDCODEID.csv: ../link-cuis.py MEDCODEID-codes.csv ../mrconso.csv
	python3 $^ $@

# add the vocabulary id
MEDCODEID_%.csv: MEDCODEID.csv
	sed -e 's/^/$*,/' -e '1 s/^$*/voc_id/' $< > $@
