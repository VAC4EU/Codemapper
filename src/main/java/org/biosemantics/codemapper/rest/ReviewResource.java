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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;
import org.biosemantics.codemapper.review.ReviewApi.TopicInfo;

@Path("review")
public class ReviewResource {
  @GET
  @Path("topics/{mappingUUID}")
  @Produces(MediaType.APPLICATION_JSON)
  public AllTopics getTopicsByCui(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingUUID") String mappingUUID) {
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingUUID, ProjectPermission.Editor);
      return CodeMapperApplication.getReviewApi().getAll(mappingUUID, user.getUsername());
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic/{mappingUUID}")
  @Produces(MediaType.APPLICATION_JSON)
  public int postNewTopic(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingUUID") String mappingUUID,
      @QueryParam("cui") String cui,
      @QueryParam("sab") String sab,
      @QueryParam("code") String code,
      @FormParam("heading") String heading) {
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingUUID, ProjectPermission.Editor);
      return CodeMapperApplication.getReviewApi()
          .newTopic(mappingUUID, cui, sab, code, heading, user.getUsername(), null);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("message/{mappingUUID}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void newMessage(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingUUID") String mappingUUID,
      @PathParam("topicId") int topicId,
      @FormParam("content") String content) {
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingUUID, ProjectPermission.Editor);
      TopicInfo topic = CodeMapperApplication.getReviewApi().getTopicInfo(topicId);
      if (!topic.mappingUUID.equals(mappingUUID)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      CodeMapperApplication.getReviewApi()
          .newMessage(mappingUUID, topicId, content, user.getUsername(), null);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic-resolve/{mappingUUID}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void resolveTopic(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingUUID") String mappingUUID,
      @PathParam("topicId") int topicId) {
    try {
      TopicInfo topic = CodeMapperApplication.getReviewApi().getTopicInfo(topicId);
      if (!topic.mappingUUID.equals(mappingUUID)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      MappingInfo mapping = CodeMapperApplication.getPersistencyApi().getMappingInfo(mappingUUID);
      ProjectPermission perm = user.getProjectPermissions().get(mapping.projectName);
      String createdBy = CodeMapperApplication.getReviewApi().getTopicCreatedBy(topicId);
      if (!perm.implies(ProjectPermission.Editor)
          && createdBy != null
          && !user.getUsername().equals(createdBy)) {
        throw new UnauthorizedException();
      }
      CodeMapperApplication.getReviewApi().resolveTopic(topicId, user.getUsername(), null);
      CodeMapperApplication.getReviewApi().resetReadMarkers(topicId);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic-mark-read/{mappingUUID}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void markRead(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingUUID") String mappingUUID,
      @PathParam("topicId") int topicId) {
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingUUID, ProjectPermission.Editor);
      TopicInfo topic = CodeMapperApplication.getReviewApi().getTopicInfo(topicId);
      if (!topic.mappingUUID.equals(mappingUUID)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      CodeMapperApplication.getReviewApi().markRead(topicId, user.getUsername());
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topics/{mappingUUID}")
  @Produces(MediaType.APPLICATION_JSON)
  public void saveReviews(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingUUID") String mappingUUID,
      @FormParam("allTopics") String allTopicsJson) {
    try {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingUUID, ProjectPermission.Editor);
      ObjectMapper mapper = new ObjectMapper();
      mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
      AllTopics allTopics = mapper.readValue(allTopicsJson, AllTopics.class);
      // logger.info("Save reviews with messages " + allTopics.numMessages());
      CodeMapperApplication.getPersistencyApi().ensureUsers(allTopics.allUsers());
      CodeMapperApplication.getReviewApi().saveReviews(mappingUUID, allTopics);
    } catch (CodeMapperException | JsonProcessingException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }
}
