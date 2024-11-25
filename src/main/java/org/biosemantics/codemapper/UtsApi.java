// This file is part of CodeMapper.
//
// Copyright 2022-2024 VAC4EU - Vaccine monitoring Collaboration for Europe.
// Copyright 2017-2021 Erasmus Medical Center, Department of Medical Informatics.
//
// CodeMapper is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option) any
// later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package org.biosemantics.codemapper;

import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.xml.bind.annotation.XmlRootElement;
import jersey.repackaged.com.google.common.base.Objects;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

public class UtsApi {

  private static Logger logger = LogManager.getLogger(UtsApi.class);

  private static String LOGIN_URL = "https://utslogin.nlm.nih.gov/cas/v1";
  private static String REST_URL = "https://uts-ws.nlm.nih.gov/rest";
  private static String SERVICE = "http://umlsks.nlm.nih.gov";

  private static Pattern TGT_PATTERN =
      Pattern.compile(".*/api-key/(?<key>[^\"]*).*", Pattern.DOTALL);

  private String apiKey;
  private String tgt;
  private Date tgtDate;

  public UtsApi(String apiKey) {
    this.apiKey = apiKey;
  }

  private void setTGT() throws CodeMapperException {
    tgt = null;
    tgtDate = null;
    WebTarget target = ClientBuilder.newClient().target(LOGIN_URL).path("api-key");
    Form form = new Form().param("apikey", apiKey);
    Response response = target.request().post(Entity.form(form));
    if (response.getStatusInfo().getFamily().equals(Response.Status.Family.SUCCESSFUL)) {
      String string = response.readEntity(String.class);
      Matcher matcher = TGT_PATTERN.matcher(string);
      if (matcher.matches()) {
        logger.debug("Received TGT");
        this.tgt = matcher.group("key");
        this.tgtDate = new Date();
      } else {
        logger.debug("Cannot login: " + target + " POST " + form.asMap());
        throw CodeMapperException.server("Cannot get TGT: Does not match pattern: " + string);
      }
    } else {
      logger.debug("Cannot login: " + target + " POST " + form.asMap());
      throw CodeMapperException.server("Cannot get TGT: " + response.getStatusInfo());
    }
  }

  private void assureTGT() throws CodeMapperException {
    if (tgt == null
        || tgtDate == null
        || new Date().getTime() - tgtDate.getTime() >= 8 * 60 * 60 * 1000) {
      setTGT();
    }
  }

  private String getTicket() throws CodeMapperException {
    assureTGT();
    WebTarget target = ClientBuilder.newClient().target(LOGIN_URL).path("tickets").path(tgt);
    Form form = new Form().param("service", SERVICE);
    Response response = target.request().post(Entity.form(form));
    switch (response.getStatusInfo().getFamily()) {
      case SUCCESSFUL:
        logger.debug("Retrieved ticket");
        return response.readEntity(String.class);
      case CLIENT_ERROR:
        logger.debug("Request: " + target + " POST " + form.asMap());
        throw CodeMapperException.server(
            String.format("No TGT/ticket: %s", response.getStatusInfo()));
      default:
        logger.debug("Request: " + target + " POST " + form.asMap());
        throw CodeMapperException.server(
            "Error while getting ticket ("
                + response.getStatusInfo()
                + "): "
                + response.readEntity(String.class));
    }
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
      return Objects.equal(name, result.name)
          && Objects.equal(rootSource, result.rootSource)
          && Objects.equal(ui, result.ui)
          && Objects.equal(uri, result.uri);
    }
  }

  public List<String> searchConcepts(String query, String umlsVersion) throws CodeMapperException {
    List<String> cuis = new LinkedList<>();
    for (int pageNumber = 1; ; pageNumber++) {
      logger.debug("Search concepts page " + pageNumber);
      String ticket = getTicket();
      WebTarget target =
          ClientBuilder.newClient()
              .target(REST_URL)
              .path("search")
              .path(umlsVersion)
              .queryParam("ticket", ticket)
              .queryParam("string", query)
              .queryParam("pageSize", 100)
              .queryParam("pageNumber", pageNumber);
      Response response = target.request(MediaType.APPLICATION_JSON).get();
      response.bufferEntity();
      if (response.getStatusInfo().getFamily() != Status.Family.SUCCESSFUL) {
        logger.debug("Cannot search: " + target);
        throw CodeMapperException.server(
            "Cannot search: "
                + response.readEntity(String.class)
                + "("
                + response.getStatusInfo()
                + ")");
      }
      SearchResults results = response.readEntity(SearchResults.class);
      if (results.result.results.isEmpty()
          || (results.result.results.size() == 1
              && results.result.results.get(0).ui.equals("NONE")
              && results.result.results.get(0).name.equals("NO RESULTS"))) {
        logger.debug("Search found " + cuis.size() + " concepts");
        return cuis;
      }
      for (SearchResult result : results.result.results) {
        cuis.add(result.ui);
      }
    }
  }

  public static void main(String[] args) throws CodeMapperException {
    Configurator.setAllLevels(logger.getName(), Level.DEBUG);
    CodeMapperApplication.initialize();
    UtsApi utsApi = CodeMapperApplication.getUtsApi();
    System.out.println(utsApi.searchConcepts("pertussis", CodeMapperApplication.getUmlsVersion()));
  }
}
