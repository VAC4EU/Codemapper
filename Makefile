.PHONY: deploy-dev deploy-testing deploy-production

SERVER=advance
USER?=tomcat
LOCAL_TOMCAT?=/var/lib/tomcat9/

deploy-production:
	mvn -P production clean package
	scp target/codemapper.war $(SERVER):/tmp/
	echo -n "deploy what? > "; \
	read resp; \
	[ "$$resp" = "production" ]
	ssh -t $(SERVER) \
	  sudo -u tomcat8 \
	  cp /tmp/codemapper.war /var/lib/tomcat8/webapps

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
