.PHONY: deploy-dev deploy-testing deploy-production

SERVER=advance
USER?=tomcat
LOCAL_TOMCAT?=/var/lib/tomcat9/

deploy-production:
	@printf "Deploy what? > "; read resp; [ "$$resp" = "production" ]
	mvn -P production clean package
	scp target/codemapper.war $(SERVER):/tmp/
	ssh -t $(SERVER) \
	  sudo -u tomcat8 \
	  cp /tmp/codemapper.war /var/lib/tomcat8/webapps


.PHONY: deploy-production-all
deploy-production-all:
	@printf "Deploy what? > "; read resp; [ "$$resp" = "production" ]
	mvn -P production clean package
	make -C $(FRONTEND) dist-production
	rsync -zrv --delete \
	  target/codemapper.war \
	  $(FRONTEND)/dist-production \
	  $(SERVER):/tmp/
	ssh -t $(SERVER) sudo sh -c \
	  "'sudo -u tomcat8 cp /var/lib/tomcat8/webapps/codemapper.war /home/bb/codemapper-production-$(date +%FT%T); sudo -u tomcat8 cp /tmp/codemapper.war /var/lib/tomcat8/webapps && sudo -u www-data rsync --delete -avz /tmp/dist-production/ /var/www/codemapper-frontend'"

deploy-testing:
	mvn -P testing clean package
	scp target/codemapper-testing.war $(SERVER):/tmp/
	ssh -t $(SERVER) \
	  sudo -u tomcat8 \
	  cp /tmp/codemapper-testing.war /var/lib/tomcat8/webapps
# sh -c 'cp /tmp/codemapper-testing.war /var/lib/tomcat8/webapps && tail -fn 0 /var/lib/tomcat8/logs/catalina.out' 

deploy-dev:
	mvn -P dev package
	sudo -u $(USER) cp target/codemapper-dev.war $(LOCAL_TOMCAT)/webapps

test:
	cd src/main/resources; hurl --variables-file hurl-variables.txt tests.hurl

FRONTEND=src/main/frontend

deploy-testing-all:
	mvn -P testing clean package
	make -C $(FRONTEND) dist-testing
	rsync -zrv --delete \
	  target/codemapper-testing.war \
	  $(FRONTEND)/dist-testing \
	  $(SERVER):/tmp/
	ssh -t $(SERVER) sudo sh -c "'sudo -u tomcat8 cp /tmp/codemapper-testing.war /var/lib/tomcat8/webapps && sudo -u www-data rsync --delete -avz /tmp/dist-testing/ /var/www/codemapper-frontend-testing'"
