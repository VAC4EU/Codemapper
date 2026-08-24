FRONTEND=src/main/frontend

.PHONY: news
news:
	pandoc -i NEWS.md -o src/main/frontend/src/app/mapping/news-view/news-view.component.html

.PHONY: deploy-codemapper
deploy-codemapper:
	@printf "Deploy what? > "; read resp; [ "$$resp" = "codemapper" ]
	mvn -P codemapper clean package
	scp target/codemapper.war codemapper:/tmp/
	ssh -t codemapper \
	  sudo cp /tmp/codemapper.war /opt/tomcat-8/webapps

.PHONY: deploy-codemapper-all
deploy-codemapper-all:
	@printf "Deploy what? > "; read resp; [ "$$resp" = "codemapper" ]
	mvn -P codemapper clean package
	make -C $(FRONTEND) dist-codemapper
	rsync -zrv --delete target/codemapper.war $(FRONTEND)/dist-codemapper codemapper:/tmp/
	ssh -t codemapper sudo sh -c \
	  "'cp /opt/tomcat-8/webapps/codemapper.war /home/bb/codemapper-$(shell date +%FT%T).war && sudo -u tomcat cp /tmp/codemapper.war /opt/tomcat-8/webapps/ && sudo -u caddy rsync --delete -avz /tmp/dist-codemapper/browser/ /var/www/codemapper'"

test:
	mvn test -DskipTests=false
	cd src/main/frontend; ng test --watch=false
	#cd src/main/resources; hurl --variables-file hurl-variables.txt tests.hurl
