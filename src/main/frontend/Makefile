TESTING_BASE_HREF = https://app.vac4eu.org/codemapper-testing/

.PHONY: dist-testing
dist-testing:
	ng build --configuration testing --base-href $(TESTING_BASE_HREF) --output-path $@

.PHONY: deploy-testing
deploy-testing: dist-testing
	rsync -zrv --delete dist-testing advance:/tmp
	ssh -t advance sudo rsync -avz --delete /tmp/dist-testing/ /var/www/ui-2023-testing
