
UMLS_FULL=$(UMLS_VERSION)-full
UMLS_FULL_ZIP=umls-$(UMLS_FULL).zip

DBNAME=umls-$(UMLS_VERSION)

UMLS_FULL_URL = https://download.nlm.nih.gov/umls/kss/$(UMLS_VERSION)/$(UMLS_FULL_ZIP)
UTS_DOWNLOAD = https://uts-ws.nlm.nih.gov/download

.PHONY: check
check:
	test -n "$(UMLS_VERSION)"
.PHONY: download
download: $(UMLS_VERSION)/$(UMLS_FULL)

$(UMLS_VERSION)/$(UMLS_FULL_ZIP): check
	@mkdir -p $(UMLS_VERSION)
	curl -o $@ "$(UTS_DOWNLOAD)?url=$(UMLS_FULL_URL)&apiKey=$(API_KEY)"

$(UMLS_VERSION)/$(UMLS_FULL): $(UMLS_VERSION)/$(UMLS_FULL_ZIP)
	unzip -d $(UMLS_VERSION) $<
	touch $@

$(UMLS_VERSION)/$(UMLS_FULL)/jre/macos/bin/java: $(UMLS_VERSION)/$(UMLS_FULL)/mmsys.zip
	cd $(UMLS_VERSION)/$(UMLS_FULL) && unzip mmsys.zip

.PHONY: subset
subset: $(UMLS_VERSION)/subset

$(UMLS_VERSION)/$(UMLS_VERSION)-subset: $(UMLS_VERSION)/$(UMLS_FULL)/jre/macos/bin/java
	cd $(UMLS_VERSION)/$(UMLS_FULL) && jre/macos/bin/java  \
	  -cp .:lib/jpf-boot.jar \
	  -Dfile.encoding=UTF-8 -Xms1000M -Xmx2000M  \
	  -Dscript_type=.sh \
	  -Dunzip.native=true -Dunzip.path=/usr/bin/unzip \
	  -Xdock:name=MetamorphoSys -Xdock:icon=config/icons/nlmlogo-small.gif \
	  -Dapple.awt.fileDialogForDirectories=true -Dapple.laf.useScreenMenuBar=true \
	  -Dmmsys.config.uri=../codemapper-mmsys.prop \
	  org.java.plugin.boot.Boot

.PHONY: tables
tables: $(UMLS_VERSION)/$(UMLS_VERSION)-tables 

MRFILENAMES = MRCONSO MRCUI MRDEF MRHIER MRREL MRSAB MRSTY

$(UMLS_VERSION)/$(UMLS_VERSION)-tables:
	mkdir $@
	cp $(patsubst %, $< $(UMLS_VERSION)/$(UMLS_VERSION)-subset/$(UMLS_VERSION)/META/%.RRF, $(MRFILENAMES)) $@

.PHONY: clean-subset
clean-subset:
	cd $(UMLS_VERSION) && \
	  [ -e $(UMLS_VERSION)-subset ] && \
	  zip -r $(UMLS_VERSION)-subset.zip $(UMLS_VERSION)-subset && \
	  rm -rf $(UMLS_VERSION)-subset 
	@echo "$(UMLS_VERSION)/$(UMLS_VERSION)-full are not needed anymore either and can be removed to save space"

.PHONY: db
db:
	echo 'create database "$(DBNAME)";' | psql | grep 'CREATE DATABASE'
	sed "s|@TABLES@|$(shell realpath $(UMLS_VERSION)/$(UMLS_VERSION)-tables)|" db.sql | psql "$(DBNAME)"
	echo 'grant usage on schema public to codemapper;' | psql | grep 'GRANT'
	echo 'grant select on all tables in schema public to codemapper;' | psql | grep 'GRANT'


.PHONY: dumpsql
dumpsql: $(UMLS_VERSION)/$(UMLS_VERSION)/$(DBNAME).sql.gz

$(UMLS_VERSION)/$(DBNAME).sql.gz:
	pg_dump --no-owner "$(DBNAME)" | gzip > "$(UMLS_VERSION)/$(DBNAME).sql.gz"

.PHONY: print-import-command
print-import-command:
	@echo "Copy $@ to the server and run the following commands:"
	@echo
	@echo "gunzip -c $(DBNAME).sql.gz | sudo -u postgres psql $(DBNAME)"
	@echo "'grant usage on schema public to codemapper;' | sudo -u postgres | grep 'GRANT'"
	@echo "'grant select on all tables in schema public to codemapper;' | sudo -u postgres psql | grep 'GRANT'"

.PHONY: mrconso
mrconso: $(UMLS_VERSION)/mrconso-$(UMLS_VERSION).csv
$(UMLS_VERSION)/mrconso-$(UMLS_VERSION).csv: check
	psql $(DBNAME) -c \
	  "COPY (SELECT DISTINCT cui, sab, code, str, lat, tty FROM mrconso ORDER BY sab, code) TO STDOUT DELIMITER ',' CSV HEADER" \
	  > "$@"
