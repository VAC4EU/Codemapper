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
