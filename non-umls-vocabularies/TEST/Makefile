
# add the vocabulary id
TEST_%.csv: TEST.csv
	sed -e 's/^/$*,/' -e '1 s/^$*/voc_id/' $< > $@

TESTold_%.csv: TESTold.csv
	sed -e 's/^/$*,/' -e '1 s/^$*/voc_id/' $< > $@
