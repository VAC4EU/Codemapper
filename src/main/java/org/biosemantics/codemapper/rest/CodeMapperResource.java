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
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.servlet.http.HttpServletRequest;
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
import org.biosemantics.codemapper.UtsApi;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.descendants.DescendantsApi;
import org.biosemantics.codemapper.descendants.DescendantsApi.Descendants;
import org.biosemantics.codemapper.descendants.DescendantsApi.GeneralDescender;
import org.biosemantics.codemapper.descendants.DescendantsCache;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.rest.WriteCsvApi.Mapping;

@Path("code-mapper")
public class CodeMapperResource {

  private static Logger logger = LogManager.getLogger(CodeMapperResource.class);

  private static final String VERSION = "$Revision$";

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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getServerInfo();
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("autocomplete")
  @Produces(MediaType.APPLICATION_JSON)
  public List<UmlsConcept> getConceptCompletions(
      @Context User user,
      @QueryParam("str") String str,
      @QueryParam("codingSystems") List<String> codingSystems) {
    AuthentificationApi.assertAuthentificated(user);
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getCompletions(str, codingSystems);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getCodeCompletions(str, codingSystem);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("coding-systems")
  @Produces(MediaType.APPLICATION_JSON)
  public Collection<CodingSystem> getCodingSystems(@Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getCodingSystems();
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getCuisByCodes(codes, codingSystem);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      Map<String, UmlsConcept> concepts = umls.getConcepts(cuis, codingSystems, ignoreTermTypes);
      return new LinkedList<>(concepts.values());
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getNarrower(cuis, codingSystems);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      return umls.getBroader(cuis, codingSystems);
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("search-uts")
  @Produces(MediaType.APPLICATION_JSON)
  public List<String> searchConcepts(@FormParam("query") String query, @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try (UtsApi uts = CodeMapperApplication.getUtsApi()) {
      return uts.searchConcepts(query, CodeMapperApplication.getUmlsVersion());
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
      @FormParam("filterSystem") String system,
      @FormParam("filterEventAbbreviation") String eventAbbreviation,
      @FormParam("filterType") String type,
      @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi umls = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {
      if (format == null || format.isEmpty() || format.equals("csv_compat")) {
        ImportedMapping imported =
            umls.importCompatCSV(
                new StringReader(csvContent),
                commentColumns,
                ignoreTermTypes,
                system,
                eventAbbreviation,
                type);
        return new ImportResult(true, imported, null);
      } else {
        return new ImportResult(false, null, "unexpected format: " + format);
      }
    } catch (CodeMapperException e) {
      return new ImportResult(false, null, e.getMessage());
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
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
      @QueryParam("filename") final String filename0,
      @QueryParam("project") final String projectName,
      @QueryParam("mappings") final List<String> rawMappingConfigs,
      @QueryParam("content") final String content) {
    String result =
        postCodeListsCSV(request, user, filename0, projectName, rawMappingConfigs, content);
    String suffix = "";
    switch (content) {
      case "codelist":
        break;
      case "metadata":
        suffix = " - meta";
        break;
      case "coding_systems":
        suffix = " - coding systems";
        break;
    }
    String filename = String.format("%s%s.%s", filename0, suffix, WriteCsvApi.FILE_EXTENSION);
    String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
    return Response.ok()
        .header("Content-Disposition", contentDisposition)
        .type(WriteCsvApi.MIME_TYPE)
        .entity(result)
        .build();
  }

  @POST
  @Path("code-lists-csv")
  @Produces({WriteCsvApi.MIME_TYPE})
  public String postCodeListsCSV(
      @Context HttpServletRequest request,
      @Context User user,
      @FormParam("filename") final String filename0,
      @FormParam("project") final String projectName,
      @FormParam("mappings") final List<String> rawMappingConfigs,
      @FormParam("content") final String content) {
    try (PersistencyApi persistencyApi = CodeMapperApplication.createPersistencyApi()) {
      AuthentificationApi.assertProjectRolesImplies(
          user, projectName, ProjectPermission.Reviewer, persistencyApi);
      logger.info(
          String.format(
              "Download code lists as CSV %s: %s",
              projectName, String.join(", ", rawMappingConfigs)));
      OutputStream output = new ByteArrayOutputStream();
      List<MappingConfig> mappingConfigs = new LinkedList<>();
      for (String rawMappingConfig : rawMappingConfigs) {
        String[] parts = rawMappingConfig.split("@", 2);
        MappingConfig config = new MappingConfig();
        config.shortkey = rawMappingConfig;
        if (parts.length == 2) {
          try {
            config.version = Integer.parseInt(parts[1]);
            config.shortkey = parts[0];
          } catch (NumberFormatException e) {
            throw CodeMapperException.user("could not parse mapping config: " + rawMappingConfig);
          }
        }
        mappingConfigs.add(config);
      }
      Collection<Mapping> mappings = getMappings(projectName, mappingConfigs, persistencyApi);
      try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
          GeneralDescender generalDescender = CodeMapperApplication.createGeneralDescender();
          DescendantsApi descendantsApi =
              CodeMapperApplication.createDescendantsApi(nonUmlsTargets, generalDescender);
          DescendantsCache descendantsCacheApi = CodeMapperApplication.createDescendantsCacheApi();
          UmlsApi umlsApi = CodeMapperApplication.createUmlsApi(nonUmlsTargets); ) {
        switch (content) {
          case "codelist":
            {
              addDescendants(mappings, descendantsApi, descendantsCacheApi, umlsApi);
              new WriteCsvApi().writeProjectCSV(output, projectName, mappings, true);
              break;
            }
          case "metadata":
            {
              new WriteCsvApi().writeMetaCSV(output, projectName, mappings);
              break;
            }
          case "coding_systems":
            {
              new WriteCsvApi().writeCodingSystems(output, mappings);
              break;
            }
          default:
            throw CodeMapperException.user("unexpected content: " + content);
        }
      } catch (IOException e) {
        throw CodeMapperException.server("could not write codelist CSV", e);
      }
      return output.toString();
    } catch (CodeMapperException e) {
      throw e.asWebApplicationException();
    } catch (Exception e1) {
      e1.printStackTrace();
      return null;
    }
  }

  public static String slugify(String str) {
    return str.toLowerCase()
        .replaceAll("[_ ]", "-")
        .replaceAll("[^a-z0-9-]", "")
        .replaceAll("-+", "-")
        .replaceAll("^-|-$", "");
  }

  Collection<Mapping> getMappings(
      String projectName, Collection<MappingConfig> mappingConfigs, PersistencyApi persistencyApi)
      throws CodeMapperException {
    List<Mapping> mappings = new LinkedList<>();
    for (MappingConfig config : mappingConfigs) {
      Mapping mapping = new Mapping();
      mapping.info = persistencyApi.getMappingInfo(config.shortkey);
      if (config.version == null) {
        mapping.revision = persistencyApi.getLatestRevision(config.shortkey);
      } else {
        mapping.revision = persistencyApi.getRevision(config.shortkey, config.version);
      }
      if (mapping.revision == null) {
        String msg =
            "Invalid version for mapping \""
                + mapping.info.mappingName
                + "\" (the mapping may not have a version yet).";
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

  void addDescendants(
      Collection<Mapping> mappings,
      DescendantsApi descendantsApi,
      DescendantsCache descendantsCacheApi,
      UmlsApi api)
      throws CodeMapperException {
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
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        GeneralDescender generalDescender = CodeMapperApplication.createGeneralDescender();
        DescendantsApi descendants =
            CodeMapperApplication.createDescendantsApi(nonUmlsTargets, generalDescender)) {
      return descendants
          .getDescendantCodes(codesByVoc)
          .getOrDefault(codingSystem, new Descendants());
    } catch (Exception e) {
      logger.error("Cannot get descendants", e);
      throw new InternalServerErrorException(e);
    }
  }
}
