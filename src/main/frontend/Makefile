TESTING_BASE_HREF = https://app.vac4eu.org/codemapper-testing/
PRODUCTION_BASE_HREF = https://app.vac4eu.org/codemapper/
CODEMAPPER_BASE_HREF = https://codemapper.vac4eu.org/

.PHONY: dist-testing
dist-testing:
	ng build --configuration testing --base-href $(TESTING_BASE_HREF) --output-path $@

.PHONY: deploy-testing
deploy-testing: dist-testing
	rsync -zrv --delete dist-testing advance:/tmp
	ssh -t advance sudo -u www-data rsync -avz --delete /tmp/dist-testing/browser/ /var/www/codemapper-frontend-testing

.PHONY: dist-production
dist-production:
	ng build --configuration production --base-href $(PRODUCTION_BASE_HREF) --output-path $@

.PHONY: deploy-production
deploy-production: dist-production
	@printf "Deploy what? > "; read resp; [ "$$resp" = "production" ]
	rsync -zrv --delete dist-production advance:/tmp
	@# Get rid of the angular browser/ subdirectory
	ssh -t advance sudo -u www-data rsync -avz --delete /tmp/dist-production/browser/ /var/www/codemapper-frontend

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
