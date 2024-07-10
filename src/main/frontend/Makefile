TESTING_BASE_HREF = https://app.vac4eu.org/codemapper-testing/

.PHONY: dist-ui-2023-testing
dist-ui-2023-testing:
	ng build --configuration testing --base-href $(TESTING_BASE_HREF) --output-path $@

.PHONY: deploy-testing
deploy-testing: dist-ui-2023-testing
	rsync -zrv dist-ui-2023-testing advance:/tmp
	ssh -t advance sudo rsync -avz /tmp/dist-ui-2023-testing/ /var/www/ui-2023-testing
