/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
package org.biosemantics.codemapper;

import java.util.LinkedList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.Invocation.Builder;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.xml.bind.annotation.XmlRootElement;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.glassfish.jersey.client.ClientConfig;

import jersey.repackaged.com.google.common.base.Objects;


public class UtsApi {

    private static Logger logger = LogManager.getLogger(UtsApi.class);
    
    private static String LOGIN_URL = "https://utslogin.nlm.nih.gov/cas/v1";
    private static String REST_URL = "https://uts-ws.nlm.nih.gov/rest";
    private static String SERVICE = "http://umlsks.nlm.nih.gov";
    
    private static Pattern TGT_PATTERN = Pattern.compile(".*/api-key/(?<key>[^\"]*).*");
    
    private String apiKey;
    private String tgt;
    
    private Client client;
    private WebTarget loginTarget;
    private WebTarget restTarget;
    
    public UtsApi(String apiKey) {
        this.apiKey = apiKey;

        ClientConfig clientConfig = new ClientConfig();
        client = ClientBuilder.newClient(clientConfig);
        loginTarget = client.target(LOGIN_URL);
        restTarget = client.target(REST_URL);
        setTGT();
    }
    
    private void setTGT() {
        Form form = new Form()
                .param("apikey", apiKey);
        Response response = loginTarget
                .path("api-key")
                .request()
                .post(Entity.form(form));
        if (response.getStatusInfo().getFamily().equals(Response.Status.Family.SUCCESSFUL)) {
            String string = response.readEntity(String.class);
            Matcher matcher = TGT_PATTERN.matcher(string);
            if (matcher.matches()) {
                logger.debug("Received TGT");
                this.tgt = matcher.group("key");
            } else {
                logger.error("Cannot login: Does not match pattern: " + string);
            }
        } else {
            logger.error("Cannot login: " + response.getStatusInfo());
        }
    }
    
    private String getTicket() {
        for (int retry=0; retry<2; retry++, setTGT()) {
            Form form = new Form()
                .param("service", SERVICE);
            Builder request = loginTarget
                .path("api-key")
                .path(tgt)
                .request();
            Response response = request.post(Entity.form(form));
            switch (response.getStatusInfo().getFamily()) {
                case SUCCESSFUL:
                	logger.debug("Retrieved ticket");
                    return response.readEntity(String.class);
                case CLIENT_ERROR:
                    logger.error(String.format("No TGT/ticket (retry %d): %s", retry, response.getStatusInfo()));
                    break;
                default:
                    logger.debug("Request: " + request);
                    logger.error("Error while getting ticket (" +
                            response.getStatusInfo() + "): " + response.readEntity(String.class));
                    return null;
            }
        }
        return null;
    }
    
    
    @XmlRootElement
    public static class SearchResults {
        public int pageNumber;
        public int pageSize;
        public Result result;
    }
    
    @XmlRootElement
    public static class Result {
        public String classType;
        public List<SearchResult> results;
    }
    
    @XmlRootElement
    public static class SearchResult {
        public String name;
        public String rootSource;
        public String ui;
        public String uri;
        public SearchResult() {}
        public SearchResult(String ui, String name) {
            this.ui = ui;
            this.name = name;
        }
        @Override
        public boolean equals(Object obj) {
            if (obj == this) return true;
            if (!(obj instanceof SearchResult)) {
                return false;
            }
            SearchResult result = (SearchResult) obj;
            return Objects.equal(name, result.name) &&
                    Objects.equal(rootSource, result.rootSource) &&
                    Objects.equal(ui, result.ui) &&
                    Objects.equal(uri, result.uri);
        }
        
    }

    public List<String> searchConcepts(String query, String umlsVersion) throws CodeMapperException {
        List<String> cuis = new LinkedList<>();
        for (int pageNumber = 1;; pageNumber++) {
        	logger.debug("Search concepts page " + pageNumber);
            String ticket = getTicket();
            WebTarget target = 
            		restTarget
                    .path("search")
                    .path(umlsVersion)
                    .queryParam("ticket", ticket)
                    .queryParam("string", query)
//                    .queryParam("pageSize", 100)
                    .queryParam("pageNumber", pageNumber);
            Response response = target.request(MediaType.APPLICATION_JSON).get();
            response.bufferEntity();
            if (response.getStatusInfo().getFamily() == Status.Family.SUCCESSFUL) {
            	SearchResults results = response.readEntity(SearchResults.class);
            	if (results.result.results.isEmpty() 
            			|| (results.result.results.size() == 1 
            			    && results.result.results.get(0).ui.equals("NONE")
            			    && results.result.results.get(0).name.equals("NO RESULTS")))
            	{
            		logger.debug("Search found " + cuis.size() + " concepts");
            		return cuis;
            	}
            	for (SearchResult result: results.result.results) {
            		cuis.add(result.ui);
            	}
            } else {
                logger.debug("Request : " + target);
            	throw CodeMapperException.server("Cannot search: " 
            			+ response.readEntity(String.class)
            			+ "(" + response.getStatusInfo() + ")");
            }
        }
    }
    
    public static void main(String[] args) throws CodeMapperException {
        UtsApi utsApi = new UtsApi("UTS-API-KEY");
        System.out.println(utsApi.searchConcepts("GBS", "UMLS2020AB"));
    }
}
