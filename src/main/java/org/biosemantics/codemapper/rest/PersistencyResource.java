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

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.SecurityContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.MappingRevision;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;
import org.biosemantics.codemapper.persistency.PersistencyApi.ProjectInfo;

@Path("persistency")
public class PersistencyResource {

  private static Logger logger = LogManager.getLogger(PersistencyResource.class);

  private @Context SecurityContext sc;

  private PersistencyApi api = CodeMapperApplication.getPersistencyApi();

  @GET
  @Path("projects")
  @Produces(MediaType.APPLICATION_JSON)
  public Collection<ProjectInfo> getProjectPermissions(
      @Context HttpServletRequest request, @Context User user) {
    AuthentificationApi.assertAuthentificated(user);
    try {
      return api.getProjectInfos(user.getUsername());
    } catch (CodeMapperException e) {
      System.err.println("Couldn't get projects");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("projects/{project}/users")
  @Produces(MediaType.APPLICATION_JSON)
  public Map<String, Set<ProjectPermission>> getUsersOfProject(
      @PathParam("project") String project,
      @Context HttpServletRequest request,
      @Context User user) {
    AuthentificationApi.assertProjectRolesImplies(user, project, ProjectPermission.Editor);
    try {
      return api.getUsersOfProject(project);
    } catch (CodeMapperException e) {
      System.err.println("Couldn't get case definitions");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("projects/{project}/mappings")
  @Produces(MediaType.APPLICATION_JSON)
  public List<MappingInfo> getCaseDefinitionNames(
      @PathParam("project") String project, @Context User user) {
    AuthentificationApi.assertProjectRolesImplies(user, project, ProjectPermission.Editor);
    try {
      return api.getMappingInfos(project);
    } catch (CodeMapperException e) {
      System.err.println("Couldn't get case definitions");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("mapping/{mappingShortkey}/legacy")
  @Produces(MediaType.APPLICATION_JSON)
  public String getCaseDefinition(
      @PathParam("mappingShortkey") String mappingShortkey, @Context User user) {
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Editor);
      String stateJson = api.getCaseDefinition(mappingShortkey);
      if (stateJson != null) return stateJson;
      else throw new NotFoundException();
    } catch (CodeMapperException e) {
      System.err.println("Couldn't get case definition");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("mapping/{mappingShortkey}/info")
  @Produces(MediaType.APPLICATION_JSON)
  public MappingInfo getMappingInfo(
      @PathParam("mappingShortkey") String mappingShortkey, @Context User user) {
    try {
      return AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Editor);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("projects/{projectName}/mapping/{mappingName}/info-old-name")
  public MappingInfo getMappingInfoByName(
      @PathParam("projectName") String projectName,
      @PathParam("mappingName") String mappingName,
      @Context User user) {
    try {
      AuthentificationApi.assertProjectRolesImplies(user, projectName, ProjectPermission.Editor);
      return api.getMappingInfoByOldName(projectName, mappingName);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("mapping/{mappingShortkey}/latest-revision")
  @Produces(MediaType.APPLICATION_JSON)
  public MappingRevision getLatestRevision(
      @PathParam("mappingShortkey") String mappingShortkey, @Context User user) {
    logger.info(String.format("Get latest revision %s (%s)", mappingShortkey, user));
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Editor);
      MappingRevision mappingJson = api.getLatestRevision(mappingShortkey);
      if (mappingJson != null) return mappingJson;
      else throw new NotFoundException();
    } catch (CodeMapperException e) {
      System.err.println("Couldn't get case definition");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @GET
  @Path("mapping/{mappingShortkey}/revisions")
  @Produces(MediaType.APPLICATION_JSON)
  public List<MappingRevision> getRevisions(
      @PathParam("mappingShortkey") String mappingShortkey, @Context User user) {
    logger.info(String.format("Get revisions %s (%s)", mappingShortkey, user));

    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Editor);
      return api.getRevisions(mappingShortkey);
    } catch (CodeMapperException e) {
      System.err.println("Couldn't get case definition revisions");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("mapping")
  @Produces(MediaType.APPLICATION_JSON)
  public MappingInfo saveCaseDefinitionRevision(
      @FormParam("projectName") String projectName,
      @FormParam("mappingName") String mappingName,
      @Context User user) {
    logger.info(String.format("Create mapping %s/%s (%s)", projectName, mappingName, user));
    AuthentificationApi.assertProjectRolesImplies(user, projectName, ProjectPermission.Admin);
    try {
      return api.createMapping(projectName, mappingName);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("mapping/{mappingShortkey}/save-revision")
  @Produces(MediaType.APPLICATION_JSON)
  public int saveCaseDefinitionRevision(
      @PathParam("mappingShortkey") String mappingShortkey,
      @FormParam("mapping") String mappingJson,
      @FormParam("summary") String summary,
      @Context User user) {
    logger.info(String.format("Save case definition revision %s (%s)", mappingShortkey, user));
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Editor);
      return api.saveRevision(mappingShortkey, user.getUsername(), summary, mappingJson);
    } catch (CodeMapperException e) {
      System.err.println("Couldn't save case definition revision");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("mapping/{mappingShortkey}/name")
  @Produces(MediaType.APPLICATION_JSON)
  public void setMappingName(
      @PathParam("mappingShortkey") String mappingShortkey,
      @FormParam("name") String name,
      @Context User user) {
    logger.info(String.format("Set mapping name %s (%s)", mappingShortkey, user));
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Admin);
      api.setName(mappingShortkey, name);
    } catch (CodeMapperException e) {
      System.err.println("Couldn't save case definition revision");
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }
}
