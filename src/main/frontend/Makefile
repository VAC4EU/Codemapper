CODEMAPPER_BASE_HREF = https://codemapper.vac4eu.org/

.PHONY: dist-codemapper
dist-codemapper:
	ng build --configuration codemapper --base-href $(CODEMAPPER_BASE_HREF) --output-path $@

.PHONY: deploy-codemapper
deploy-codemapper: dist-codemapper
	@printf "Deploy what? > "; read resp; [ "$$resp" = "codemapper" ]
	rsync -zrv --delete dist-codemapper codemapper:/tmp
	@# Get rid of the angular browser/ subdirectory
	ssh -t codemapper \
	  sudo -u caddy rsync -avz --delete /tmp/dist-codemapper/browser/ /var/www/codemapper

CODEMAPPER_TESTING_BASE_HREF = https://app.vac4eu.org/codemapper-testing/

.PHONY: dist-testing
dist-testing:
	ng build --configuration testing --base-href https://app.vac4eu.org/codemapper-testing/ --output-path $@
