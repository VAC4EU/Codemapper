
RCD2-codes.csv: RCD2-codes.py
	python3 $^ $@

RCD2.csv: ../link-cuis.py RCD2-codes.csv ../mrconso.csv
	python3 $^ $@

# add the vocabulary id
RCD2_%.csv: RCD2.csv
	sed -e 's/^/$*,/' -e '1 s/^$*/voc_id/' $< > $@
