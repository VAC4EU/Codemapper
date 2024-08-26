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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.StringReader;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.xml.bind.annotation.XmlRootElement;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.UmlsApi.ImportedMapping;
import org.biosemantics.codemapper.UmlsConcept;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.descendants.DescendantsApi;
import org.biosemantics.codemapper.descendants.DescendantsApi.Descendants;
import org.biosemantics.codemapper.descendants.DescendantsCache;
import org.biosemantics.codemapper.persistency.MappingRevision;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;
import org.biosemantics.codemapper.rest.WriteCsvApi.Mapping;

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
  @Path("server-info")
  public ServerInfo versionInfo(@Context User user) {
    return api.getServerInfo();
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

  @GET
  @Path("export-mapping-csv")
  @Produces({WriteCsvApi.MIME_TYPE})
  public Response getMappingCSV(
      @Context HttpServletRequest request,
      @Context User user,
      @QueryParam("mappingShortkey") final String mappingShortkey,
      @DefaultValue("-1") @QueryParam("version") Integer version,
      @QueryParam("url") final String url,
      @QueryParam("includeDescendants") final boolean includeDescendants) {
    try {
      MappingInfo info =
          AuthentificationApi.assertMappingProjectRolesImplies(
              user, mappingShortkey, ProjectPermission.Editor);
      logger.debug(String.format("Download mapping as CSV %s (%s)", mappingShortkey, user));
      PersistencyApi persistencyApi = CodeMapperApplication.getPersistencyApi();
      final MappingRevision revision =
          version == -1
              ? persistencyApi.getLatestRevision(info.mappingShortkey)
              : persistencyApi.getRevision(info.mappingShortkey, version);
      String filename =
          String.format(
              "%s - %s v%d.%s",
              info.projectName,
              info.mappingName,
              revision.getVersion(),
              WriteCsvApi.FILE_EXTENSION);
      String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
      OutputStream output = new ByteArrayOutputStream();
      Mapping mapping = new Mapping();
      mapping.info = info;
      mapping.revision = revision;
      mapping.data = revision.parseMappingData();
      if (includeDescendants) {
        DescendantsApi descendantsApi = CodeMapperApplication.getDescendantsApi();
        DescendantsCache descendantsCacheApi = CodeMapperApplication.getDescendantsCacheApi();
        Map<String, Collection<String>> codes = mapping.data.getCodesByVoc();
        Map<String, CodingSystem> codingSystems =
            api.getCodingSystems().stream()
                .collect(Collectors.toMap(CodingSystem::getAbbreviation, v -> v));
        mapping.descendants =
            descendantsCacheApi.getDescendantsAndCache(codes, codingSystems, descendantsApi, api);
      } else {
        mapping.descendants = Collections.emptyMap();
      }
      WriteCsvApi writeApi = new WriteCsvApi();
      try {
        writeApi.writeMappingCSV(output, mapping, url);
      } catch (IOException e) {
        throw CodeMapperException.server("could not write CSV", e);
      }

      return Response.ok()
          .header("Content-Disposition", contentDisposition)
          .type(WriteCsvApi.MIME_TYPE)
          .entity(output.toString())
          .build();
    } catch (CodeMapperException e) {
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .type(MediaType.TEXT_PLAIN)
          .entity(e.getMessage())
          .build();
    }
  }

  @GET
  @Path("export-project-csv")
  @Produces({WriteCsvApi.MIME_TYPE})
  public Response getProjectCSV(
      @Context HttpServletRequest request,
      @Context User user,
      @QueryParam("project") final String project,
      @QueryParam("url") final String url,
      @QueryParam("mappings") final List<String> mappingShortkeys,
      @QueryParam("includeDescendants") final boolean includeDescendants) {
    boolean ignoreMappingFailures = false;
    logger.debug(String.format("Download project as CSV %s", project));
    DateTimeFormatter formatter = DateTimeFormatter.ISO_DATE_TIME;
    String formattedTime = ZonedDateTime.now(ZoneOffset.UTC).withNano(0).format(formatter);
    String filename = String.format("%s %s.%s", project, formattedTime, WriteCsvApi.FILE_EXTENSION);
    String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
    try {
      AuthentificationApi.assertProjectRolesImplies(user, project, ProjectPermission.Editor);
      OutputStream output = new ByteArrayOutputStream();
      PersistencyApi persistencyApi = CodeMapperApplication.getPersistencyApi();
      DescendantsApi descendantsApi = CodeMapperApplication.getDescendantsApi();
      WriteCsvApi writeApi = new WriteCsvApi();
      Collection<Mapping> mappings = new LinkedList<>();
      for (MappingInfo info : persistencyApi.getMappingInfos(project)) {
        if (!mappingShortkeys.contains(info.mappingShortkey)) {
          continue;
        }
        Mapping mapping = new Mapping();
        mapping.info = info;
        mapping.revision = persistencyApi.getLatestRevision(mapping.info.mappingShortkey);
        if (mapping.revision == null) {
          String msg =
              "Please save mapping \""
                  + info.mappingName
                  + "\" to enable the download (the mapping has no revision yet).";
          logger.warn(msg);
          if (ignoreMappingFailures) {
            continue;
          }
          throw CodeMapperException.user(msg);
        } else {
          try {
            mapping.data = mapping.revision.parseMappingData();
          } catch (CodeMapperException e) {
            String msg = "Could not parse mapping \"" + info.mappingName + "\": " + e;
            logger.warn(msg, e);
            if (ignoreMappingFailures) {
              continue;
            }
            throw e;
          }
          if (includeDescendants) {
            mapping.descendants = descendantsApi.getDescendantCodes(mapping.data.getCodesByVoc());
          } else {
            mapping.descendants = Collections.emptyMap();
          }
          mappings.add(mapping);
        }
      }
      try {
        writeApi.writeProjectCSV(output, project, mappings, formattedTime, url);
      } catch (IOException e) {
        throw CodeMapperException.server("could not write CSV", e);
      }
      return Response.ok()
          .header("Content-Disposition", contentDisposition)
          .type(WriteCsvApi.MIME_TYPE)
          .entity(output.toString())
          .build();
    } catch (CodeMapperException e) {
      System.out.println("ERROR " + e.getMessage());
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .type(MediaType.TEXT_PLAIN)
          .entity(e.getMessage())
          .build();
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
