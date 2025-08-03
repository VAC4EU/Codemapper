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
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
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
  public Collection<CodingSystem> getCodingSystems(@Context User user) {
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
  public static class ImportResult {
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
      @FormParam("format") String format,
      @FormParam("ignoreTermTypes") List<String> ignoreTermTypes,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      if (format == null || format.isEmpty() || format.equals("csv_compat")) {
        ImportedMapping imported =
            api.importCompatCSV(new StringReader(csvContent), commentColumns, ignoreTermTypes);
        return new ImportResult(true, imported, null);
      } else {
        return new ImportResult(false, null, "unexpected format: " + format);
      }
    } catch (CodeMapperException e) {
      return new ImportResult(false, null, e.getMessage());
    }
  }

  static class MappingConfig {
    String shortkey;
    Integer version;
  }

  @GET
  @Path("code-lists-csv")
  @Produces({WriteCsvApi.MIME_TYPE})
  public Response getCodeListsCSV(
      @Context HttpServletRequest request,
      @Context User user,
      @QueryParam("project") final String projectName,
      @QueryParam("mappings") final List<String> rawMappingConfigs,
      @QueryParam("format") final String format) {
    try {
      AuthentificationApi.assertProjectRolesImplies(user, projectName, ProjectPermission.Reviewer);
      logger.debug(String.format("Download code lists as CSV %s", projectName));
      OutputStream output = new ByteArrayOutputStream();
      List<MappingConfig> mappingConfigs = new LinkedList<>();
      for (String rawMappingConfig : rawMappingConfigs) {
        String[] parts = rawMappingConfig.split("@");
        MappingConfig config = new MappingConfig();
        config.shortkey = rawMappingConfig;
        if (parts.length == 2) {
          try {
            config.version = Integer.parseInt(parts[1]);
            config.shortkey = parts[0];
          } catch (NumberFormatException e) {
          }
        }
        mappingConfigs.add(config);
      }
      Collection<Mapping> mappings = getMappings(projectName, mappingConfigs);
      try {
        if (format.equals("csv_meta")) {
          new WriteCsvApi().writeMetaCSV(output, projectName, mappings);
        } else {
          addDescendants(mappings);
          boolean compatibilityFormat;
          switch (format) {
            case "csv":
              compatibilityFormat = false;
              break;
            case "csv_compat":
              compatibilityFormat = true;
              break;
            default:
              throw CodeMapperException.user("unexpected format: " + format);
          }
          new WriteCsvApi().writeProjectCSV(output, projectName, mappings, compatibilityFormat);
        }
      } catch (IOException e) {
        throw CodeMapperException.server("could not write code lists CSV", e);
      }
      String metaSuffix = format.equals("csv_meta") ? " - meta" : "";
      String filename;
      if (mappings.size() == 1) {
        Mapping mapping = mappings.stream().findFirst().get();
        String name =
            Arrays.asList(
                    mapping.info.meta.system, mapping.info.mappingName, mapping.info.meta.type)
                .stream()
                .filter(s -> s != null)
                .collect(Collectors.joining("_"));
        filename = String.format("%s%s.%s", name, metaSuffix, WriteCsvApi.FILE_EXTENSION);
      } else {
        filename =
            String.format(
                "%s (%d mappings)%s.%s",
                projectName, mappings.size(), metaSuffix, WriteCsvApi.FILE_EXTENSION);
      }
      String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
      return Response.ok()
          .header("Content-Disposition", contentDisposition)
          .type(WriteCsvApi.MIME_TYPE)
          .entity(output.toString())
          .build();
    } catch (CodeMapperException e) {
      System.out.println("ERROR " + e.getMessage());
      throw e.asWebApplicationException();
    }
  }

  public static String slugify(String str) {
    return str.toLowerCase()
        .replaceAll("[_ ]", "-")
        .replaceAll("[^a-z0-9-]", "")
        .replaceAll("-+", "-")
        .replaceAll("^-|-$", "");
  }

  Collection<Mapping> getMappings(String projectName, Collection<MappingConfig> mappingConfigs)
      throws CodeMapperException {
    PersistencyApi persistencyApi = CodeMapperApplication.getPersistencyApi();
    List<Mapping> mappings = new LinkedList<>();
    for (MappingInfo info : persistencyApi.getMappingInfos(projectName)) {
      Optional<MappingConfig> config =
          mappingConfigs.stream().filter(c -> c.shortkey.equals(info.mappingShortkey)).findFirst();
      if (!config.isPresent()) continue;
      Mapping mapping = new Mapping();
      mapping.info = info;
      if (config.get().version == null) {
        mapping.revision = persistencyApi.getLatestRevision(info.mappingShortkey);
      } else {
        mapping.revision = persistencyApi.getRevision(info.mappingShortkey, config.get().version);
      }
      if (mapping.revision == null) {
        String msg =
            "Please save mapping \""
                + mapping.info.mappingName
                + "\" to enable the download (the mapping has no revisions yet).";
        logger.warn(msg);
        throw CodeMapperException.user(msg);
      }
      try {
        mapping.data = mapping.revision.parseMappingData();
      } catch (CodeMapperException e) {
        String msg = "Could not parse mapping \"" + mapping.info.mappingName + "\": " + e;
        logger.warn(msg, e);
        throw e;
      }
      mapping.includeDescendants = mapping.data.getMeta().isIncludeDescendants();
      mappings.add(mapping);
    }
    mappings.sort(Comparator.comparing(m -> m.info.mappingName));
    return mappings;
  }

  void addDescendants(Collection<Mapping> mappings) throws CodeMapperException {
    DescendantsApi descendantsApi = CodeMapperApplication.getDescendantsApi();
    DescendantsCache descendantsCacheApi = CodeMapperApplication.getDescendantsCacheApi();
    for (Mapping mapping : mappings) {
      if (mapping.includeDescendants) {
        Map<String, Collection<String>> codes = mapping.data.getCodesByVoc();
        Map<String, CodingSystem> codingSystems =
            api.getCodingSystems().stream()
                .collect(Collectors.toMap(CodingSystem::getAbbreviation, v -> v));
        mapping.descendants =
            descendantsCacheApi.getDescendantsAndCache(codes, codingSystems, descendantsApi, api);
      } else {
        mapping.descendants = Collections.emptyMap();
      }
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
      throw e.asWebApplicationException();
    }
  }
}
