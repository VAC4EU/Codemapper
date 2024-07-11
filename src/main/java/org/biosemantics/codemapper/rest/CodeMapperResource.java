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

package org.biosemantics.codemapper.rest;

import java.io.IOException;
import java.io.OutputStream;
import java.io.StringReader;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;
import javax.xml.bind.annotation.XmlRootElement;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.MappingData;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.UmlsApi.ImportedMapping;
import org.biosemantics.codemapper.UmlsConcept;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.descendants.DescendersApi.Descendants;
import org.biosemantics.codemapper.persistency.MappingRevision;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;

@Path("code-mapper")
public class CodeMapperResource {

  private static Logger logger = LogManager.getLogger(CodeMapperResource.class);

  private static final String VERSION = "$Revision$";

  private UmlsApi api = CodeMapperApplication.getUmlsApi();

  @GET
  @Path("version")
  @Produces(MediaType.APPLICATION_JSON)
  public String version(@Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    return VERSION;
  }

  @GET
  @Path("version-info")
  public VersionInfo versionInfo(@Context User user) {
    return api.getVersionInfo();
  }

  @GET
  @Path("autocomplete")
  @Produces(MediaType.APPLICATION_JSON)
  public List<UmlsConcept> getConceptCompletions(
      @Context User user,
      @QueryParam("str") String str,
      @QueryParam("codingSystems") List<String> codingSystems) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getCompletions(str, codingSystems);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @GET
  @Path("autocomplete-code")
  @Produces(MediaType.APPLICATION_JSON)
  public Collection<UmlsConcept> getCodeCompletions(
      @Context User user,
      @QueryParam("str") String str,
      @QueryParam("codingSystem") String codingSystem) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getCodeCompletions(str, codingSystem);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @GET
  @Path("coding-systems")
  @Produces(MediaType.APPLICATION_JSON)
  public List<CodingSystem> getCodingSystems(@Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getCodingSystems();
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @POST
  @Path("cuis-for-codes")
  @Produces(MediaType.APPLICATION_JSON)
  public Collection<String> getCuisForCodes(
      @FormParam("codes") List<String> codes,
      @FormParam("codingSystem") String codingSystem,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getCuisByCodes(codes, codingSystem);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @POST
  @Path("umls-concepts")
  @Produces(MediaType.APPLICATION_JSON)
  public List<UmlsConcept> getUmlsConcepts(
      @FormParam("cuis") List<String> cuis,
      @FormParam("codingSystems") List<String> codingSystems,
      @FormParam("ignoreTermTypes") List<String> ignoreTermTypes,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      Map<String, UmlsConcept> concepts = api.getConcepts(cuis, codingSystems, ignoreTermTypes);
      return new LinkedList<>(concepts.values());
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @GET
  @Path("config")
  @Produces(MediaType.APPLICATION_JSON)
  public Response getConfig(@Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    Map<String, String> config = new TreeMap<>();
    config.put("peregrineResourceUrl", CodeMapperApplication.getPeregrineResourceUrl());
    return Response.ok(config).build();
  }

  @POST
  @Path("narrower-concepts")
  @Produces(MediaType.APPLICATION_JSON)
  public Collection<UmlsConcept> getNarrower(
      @FormParam("cuis") List<String> cuis,
      @FormParam("codingSystems") List<String> codingSystems,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getNarrower(cuis, codingSystems);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @POST
  @Path("broader-concepts")
  @Produces(MediaType.APPLICATION_JSON)
  public Collection<UmlsConcept> getBroader(
      @FormParam("cuis") List<String> cuis,
      @FormParam("codingSystems") List<String> codingSystems,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getBroader(cuis, codingSystems);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @POST
  @Path("search-uts")
  @Produces(MediaType.APPLICATION_JSON)
  public List<String> searchConcepts(@FormParam("query") String query, @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return CodeMapperApplication.getUtsApi()
          .searchConcepts(query, CodeMapperApplication.getUmlsVersion());
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    }
  }

  @XmlRootElement
  class ImportResult {
    boolean success;
    ImportedMapping imported;
    String error;

    public ImportResult() {}

    public ImportResult(boolean success, ImportedMapping imported, String error) {
      this.success = success;
      this.imported = imported;
      this.error = error;
    }
  }

  @POST
  @Path("import-csv")
  @Produces(MediaType.APPLICATION_JSON)
  public ImportResult importCSV(
      @FormParam("csvContent") String csvContent,
      @FormParam("commentColumns") List<String> commentColumns,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      ImportedMapping imported = api.importCSV(new StringReader(csvContent), commentColumns);
      return new ImportResult(true, imported, null);
    } catch (CodeMapperException e) {
      return new ImportResult(false, null, e.getMessage());
    }
  }

  public Response getCaseDefinition(
      final MappingInfo mapping,
      Integer version,
      String url,
      final WriteTsvApi writeApi,
      final boolean includeDescendants) {
    try {
      PersistencyApi persistencyApi = CodeMapperApplication.getPersistencyApi();
      final MappingRevision revision =
          version == -1
              ? persistencyApi.getLatestRevision(mapping.mappingUUID)
              : persistencyApi.getRevision(mapping.mappingUUID, version);
      MappingData data = revision.parseMappingData();

      final Map<String, Descendants> descendants;
      if (includeDescendants) {
        Map<String, Collection<String>> codesByVoc = new HashMap<>();
        for (String voc : data.getVocabularies().keySet()) {
          Map<String, Code> codes = data.getCodes().get(voc);
          if (codes != null) {
            codesByVoc.put(voc, codes.keySet());
          }
        }
        descendants = CodeMapperApplication.getDescendantsApi().getDescendantCodes(codesByVoc);
      } else {
        descendants = new HashMap<String, Descendants>();
      }
      final List<Comment> comments = persistencyApi.getComments(mapping.mappingUUID);
      String filename =
          String.format(
              "%s - %s v%d.%s",
              mapping.projectName,
              mapping.mappingName,
              revision.getVersion(),
              WriteTsvApi.FILE_EXTENSION);
      String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
      return Response.ok(
              new StreamingOutput() {
                @Override
                public void write(OutputStream output) throws IOException, WebApplicationException {
                  writeApi.write(
                      output, data, descendants, comments, mapping, revision.getVersion(), url);
                }
              },
              WriteTsvApi.MIME_TYPE)
          .header("Content-Disposition", contentDisposition)
          .build();
    } catch (CodeMapperException e) {
      e.printStackTrace();
      logger.error("Cannot load mapping " + mapping.mappingUUID, e);
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("export-csv")
  @Produces({WriteTsvApi.MIME_TYPE})
  public Response getCaseDefinitonTsv(
      @Context HttpServletRequest request,
      @Context User user,
      @QueryParam("mappingUUID") final String mappingUUID,
      @DefaultValue("-1") @QueryParam("version") Integer version,
      @QueryParam("url") final String url,
      @QueryParam("includeDescendants") final boolean includeDescendants) {
    try {
      MappingInfo mapping =
          AuthentificationApi.assertMappingProjectRolesImplies(
              user, mappingUUID, ProjectPermission.Editor);
      logger.debug(String.format("Download case definition as TSV %s (%s)", mappingUUID, user));
      return getCaseDefinition(
          mapping, version, url, CodeMapperApplication.getWriteTsvApi(), includeDescendants);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("descendants")
  @Produces({"text/json"})
  public Descendants getDescendants(
      @Context HttpServletRequest request,
      @Context User user,
      @QueryParam("codingSystem") String codingSystem,
      @QueryParam("codes") List<String> codes) {
    AuthentificationApi.assertAuthentificated(user);
    Map<String, Collection<String>> codesByVoc = new HashMap<>();
    codesByVoc.put(codingSystem, codes);
    try {
      return CodeMapperApplication.getDescendantsApi()
          .getDescendantCodes(codesByVoc)
          .getOrDefault(codingSystem, new Descendants());
    } catch (CodeMapperException e) {
      logger.error("Cannot get descendants", e);
      throw new InternalServerErrorException(e);
    }
  }
}
